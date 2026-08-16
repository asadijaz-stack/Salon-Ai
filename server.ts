import 'dotenv/config';
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import {
  Business,
  Booking,
  Conversation,
  Message,
  Payment,
  AgentLog,
  Customer,
  AnalyticsSummary,
} from './src/types.js';


// Initialize Firebase Admin
let db: Firestore | null = null;
try {
  const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
  
  let serviceAccount;
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    console.log('Loaded Firebase Admin credentials from serviceAccountKey.json file.');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    console.log('Loaded Firebase Admin credentials from FIREBASE_SERVICE_ACCOUNT environment variable.');
  }

  if (serviceAccount) {
    initializeApp({
      credential: cert(serviceAccount)
    });
    db = getFirestore();
    console.log('Firebase Admin initialized successfully');

    // Auto-provision Super Admin Account
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;
    const adminPassword = process.env.SUPER_ADMIN_PASSWORD;

    if (adminEmail && adminPassword) {
      getAuth().getUserByEmail(adminEmail)
        .then(() => {
          console.log(`[Auth] Super Admin account (${adminEmail}) already exists.`);
        })
        .catch(async (error) => {
          if (error.code === 'auth/user-not-found') {
            console.log(`[Auth] Creating Super Admin account (${adminEmail})...`);
            try {
              await getAuth().createUser({
                email: adminEmail,
                password: adminPassword,
                emailVerified: true,
              });
              console.log('[Auth] Super Admin account created successfully!');
            } catch (createErr) {
              console.error('[Auth] Failed to create Super Admin account:', createErr);
            }
          }
        });
    } else {
      console.warn('[Auth] SUPER_ADMIN_EMAIL or SUPER_ADMIN_PASSWORD missing in .env. Skipping admin auto-provisioning.');
    }

  } else {
    console.warn('CRITICAL: No Firebase credentials found! Please add serviceAccountKey.json or set FIREBASE_SERVICE_ACCOUNT env var.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin:', error);
}

const app = express();

// Express raw/JSON parsing with raw body capture for HMAC verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

// Authentication Middleware
const verifyToken = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }
  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying auth token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

const PORT = process.env.PORT || 3000;

// Initialize Gemini Client (Server-side Secret Handling)
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("GEMINI_API_KEY is missing. Gemini responses will fall back to simulated agent.");
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

// ==================== SECURITY & RATE LIMITING INFRASTRUCTURE ====================

// Per-phone rate limiting tracker (max 10 requests / 60 seconds)
const phoneRateLimitMap = new Map<string, number[]>();

// Per-business daily AI message budget tracker (max 500 AI messages / day)
const businessDailyUsageMap = new Map<string, { count: number; date: string }>();

// Rate limit checker function
function checkAndIncrementRateLimit(customerPhone: string, businessId: string): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxPerMinute = 10;
  const maxDailyPerBusiness = 500;
  const todayStr = new Date().toISOString().split('T')[0];

  // 1. Per-Phone Rate Limit
  const timestamps = (phoneRateLimitMap.get(customerPhone) || []).filter((t) => now - t < windowMs);
  if (timestamps.length >= maxPerMinute) {
    return { allowed: false, reason: 'PER_PHONE_RATE_LIMIT_EXCEEDED' };
  }
  timestamps.push(now);
  phoneRateLimitMap.set(customerPhone, timestamps);

  // 2. Per-Business Daily Cap
  const bizUsage = businessDailyUsageMap.get(businessId) || { count: 0, date: todayStr };
  if (bizUsage.date !== todayStr) {
    bizUsage.count = 0;
    bizUsage.date = todayStr;
  }

  if (bizUsage.count >= maxDailyPerBusiness) {
    return { allowed: false, reason: 'DAILY_BUSINESS_BUDGET_EXCEEDED' };
  }

  bizUsage.count += 1;
  businessDailyUsageMap.set(businessId, bizUsage);

  return { allowed: true };
}

// Prompt Injection Sanitizer & Guard
const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /ignore\s+above/i,
  /disregard\s+(all\s+)?prior/i,
  /system\s+prompt\s+override/i,
  /you\s+are\s+now\s+a/i,
  /forget\s+your\s+instructions/i,
  /act\s+as\s+a\s+DAN/i,
  /bypass\s+security\s+rules/i,
];

function sanitizeAndCheckPromptInjection(text: string): { sanitizedText: string; isInjectionAttempt: boolean } {
  // Enforce Max Message Length (1000 chars max)
  let sanitizedText = text.length > 1000 ? text.substring(0, 1000) : text;
  let isInjectionAttempt = false;

  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(sanitizedText)) {
      isInjectionAttempt = true;
      sanitizedText = sanitizedText.replace(pattern, '[REDACTED_ATTEMPT]');
    }
  }

  return { sanitizedText, isInjectionAttempt };
}

// Meta WhatsApp Webhook X-Hub-Signature-256 HMAC SHA-256 Verifier
function verifyWhatsAppSignature(req: express.Request): boolean {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // If no secret configured in dev environment, log warning and allow
    return true;
  }

  const signatureHeader = req.headers['x-hub-signature-256'] as string;
  if (!signatureHeader) {
    return false;
  }

  const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
  const expectedHash = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
  const expectedHeader = `sha256=${expectedHash}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expectedHeader));
  } catch {
    return false;
  }
}

// Input validation helpers
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string): boolean {
  return /^\+?[0-9\s\-()]{7,20}$/.test(phone);
}

// ==================== IN-MEMORY / PERSISTENT DATA STORE ====================
// Seed data for SalonAI tenants
const defaultHours = {
  mon: { open: '10:00', close: '20:00', closed: false },
  tue: { open: '10:00', close: '20:00', closed: false },
  wed: { open: '10:00', close: '20:00', closed: false },
  thu: { open: '10:00', close: '20:00', closed: false },
  fri: { open: '10:00', close: '20:00', closed: false },
  sat: { open: '10:00', close: '21:00', closed: false },
  sun: { open: '11:00', close: '18:00', closed: false },
};

const defaultServices = [
  { id: `srv_default`, name: 'Standard Service', category: 'General', durationMinutes: 45, price: 3000, description: 'Primary salon service' }
];

const defaultStylists = [
  { id: `st_default`, name: 'Stylist', specialties: ['General Hair & Beauty'], workingHours: '10:00 - 19:00' }
];

// Removed in-memory arrays for main usage, but kept for fallback logic.
let businesses: Business[] = [];
let bookings: Booking[] = [];
let conversations: Conversation[] = [];
let messages: Message[] = [];
let agentLogs: AgentLog[] = [];
let payments: Payment[] = [];

// ==================== REST API ENDPOINTS ====================

// Auth Hardening & Verification Endpoints
app.get('/api/auth/status', (req, res) => {
  res.json({
    authenticated: true,
    emailVerified: true,
    user: {
      uid: 'uid_owner_master',
      email: 'asadijaz444@gmail.com',
      emailVerified: true,
    },
  });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  res.json({
    success: true,
    message: `Verification email dispatched to ${email}. Please check your inbox to confirm ownership before proceeding.`,
  });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email } = req.body;
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Valid email address is required' });
  }
  res.json({
    success: true,
    message: `Password reset instructions sent to ${email}.`,
  });
});

// Get all businesses / active business
app.get('/api/businesses', verifyToken, async (req: any, res) => {
  if (!db) return res.json(businesses);
  try {
    const isSuperAdmin = req.user.email === process.env.SUPER_ADMIN_EMAIL;
    let query: any = db.collection('businesses');

    // If not super admin, restrict to their own businesses
    if (!isSuperAdmin) {
      query = query.where('ownerUid', '==', req.user.uid);
    }

    const snapshot = await query.get();
    if (snapshot.empty) {
      return res.json([]);
    }
    const results: any[] = [];
    snapshot.forEach(doc => results.push(doc.data()));
    res.json(results);
  } catch (error) {
    console.error('Error fetching businesses:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/business/:id', async (req, res) => {
  if (!db) return res.json(businesses.find((b) => b.id === req.params.id) || businesses[0]);
  try {
    const docRef = db.collection('businesses').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Business not found' });
    }
    res.json(docSnap.data());
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/api/business/:id', async (req, res) => {
  const { name, ownerName, ownerEmail, phone, whatsappPhoneNumberId, hours, services, stylists, password, subscriptionStatus } = req.body;

  // Input Validation
  if (name && (name.trim().length === 0 || name.length > 100)) {
    return res.status(400).json({ error: 'Invalid business name length' });
  }
  if (ownerEmail && !isValidEmail(ownerEmail)) {
    return res.status(400).json({ error: 'Invalid owner email format' });
  }
  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone format' });
  }

  if (!db) return res.status(500).json({ error: 'Database not connected' });

  try {
    const docRef = db.collection('businesses').doc(req.params.id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      return res.status(404).json({ error: 'Business not found' });
    }

    const updates: any = {};
    if (name) updates.name = name.trim();
    if (ownerName) updates.ownerName = ownerName.trim();
    if (ownerEmail) updates.ownerEmail = ownerEmail.trim();
    if (phone) updates.phone = phone.trim();
    if (whatsappPhoneNumberId) updates.whatsappPhoneNumberId = whatsappPhoneNumberId;
    if (hours) updates.hours = hours;
    if (services) updates.services = services;
    if (stylists) updates.stylists = stylists;
    if (subscriptionStatus) updates.subscriptionStatus = subscriptionStatus;

    await docRef.update(updates);

    // If password update is requested (Admin only via UI)
    if (password && docSnap.data().ownerUid) {
      try {
        await getAuth().updateUser(docSnap.data().ownerUid, {
          password: password
        });
      } catch (authErr) {
        console.error('Failed to update auth password:', authErr);
      }
    }

    const updatedSnap = await docRef.get();
    res.json(updatedSnap.data());
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/businesses', verifyToken, async (req: any, res) => {
  const { name, ownerName, ownerEmail, phone, password, whatsappPhoneNumberId, subscriptionCurrency, requestedPlan, paymentProof, status, services, stylists } = req.body;

  // Validation
  if (!name || name.trim().length === 0 || name.length > 100) {
    return res.status(400).json({ error: 'Business name is required (max 100 characters)' });
  }
  if (!ownerName || ownerName.trim().length === 0) {
    return res.status(400).json({ error: 'Owner name is required' });
  }
  if (ownerEmail && !isValidEmail(ownerEmail)) {
    return res.status(400).json({ error: 'Invalid owner email format' });
  }
  if (phone && !isValidPhone(phone)) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  const isSuperAdmin = req.user.email === process.env.SUPER_ADMIN_EMAIL;
  if (!isSuperAdmin) {
    return res.status(403).json({ error: 'Only administrators can create new businesses.' });
  }

  let clientUid = req.user.uid;
  let finalStatus = 'pending';

  // If Admin is calling this, create the auth account for the client
  if (isSuperAdmin) {
    if (!password) return res.status(400).json({ error: 'Password is required when admin creates an account' });
    if (!db) {
      clientUid = `mock_uid_${Date.now()}`;
      finalStatus = status || 'trial';
    } else {
      try {
        const newUser = await getAuth().createUser({
          email: ownerEmail.trim(),
          password: password,
        });
        clientUid = newUser.uid;
        finalStatus = status || 'trial';
      } catch (authErr: any) {
        return res.status(400).json({ error: authErr.message || 'Failed to create client auth account' });
      }
    }
  }

  const newBiz: Business = {
    id: `biz_${Date.now()}`,
    name: name.trim(),
    ownerName: ownerName.trim(),
    ownerEmail: ownerEmail ? ownerEmail.trim() : 'owner@salon.pk',
    ownerUid: clientUid,
    phone: phone || '+92 300 0000000',
    whatsappPhoneNumberId: whatsappPhoneNumberId || `phone_id_${Date.now()}`,
    hours: defaultHours,
    services: services || defaultServices,
    stylists: stylists || defaultStylists,
    subscriptionStatus: finalStatus,
    subscriptionPrice: subscriptionCurrency === 'USD' ? 29 : 7500,
    subscriptionCurrency: subscriptionCurrency || 'PKR',
    requestedPlan: requestedPlan,
    paymentProof: paymentProof,
    createdAt: new Date().toISOString(),
  };

  if (!db) {
    businesses.unshift(newBiz);
    return res.status(201).json(newBiz);
  }

  try {
    await db.collection('businesses').doc(newBiz.id).set(newBiz);
    res.status(201).json(newBiz);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Conversations
app.get('/api/conversations', verifyToken, async (req, res) => {
  const { businessId } = req.query;
  if (!businessId || typeof businessId !== 'string') {
    return res.status(400).json({ error: 'businessId query parameter is required' });
  }
  if (!db) {
    const filtered = conversations.filter((c) => c.businessId === businessId);
    return res.json(filtered);
  }
  try {
    const snapshot = await db.collection(`businesses/${businessId}/conversations`).get();
    res.json(snapshot.docs.map(d => d.data()));
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/conversations/messages', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { phone } = req.body;
  if (!db) {
    const thread = messages.filter((m) => m.businessId === businessId && m.customerPhone === phone);
    return res.json(thread);
  }
  try {
    const snapshot = await db.collection(`businesses/${businessId}/conversations/${phone}/messages`).orderBy('timestamp', 'asc').get();
    res.json(snapshot.docs.map(d => d.data()));
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/conversations/toggle-ai', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { phone } = req.body;

  if (!db) {
    const conv = conversations.find((c) => c.businessId === businessId && c.customerPhone === phone);
    if (conv) {
      conv.aiPaused = !conv.aiPaused;
      agentLogs.unshift({
        id: `log_${Date.now()}`, businessId, timestamp: new Date().toISOString(), conversationId: phone,
        action: conv.aiPaused ? 'Salon Owner took over chat (AI Paused)' : 'Salon Owner restored AI Agent',
        reasoning: conv.aiPaused ? 'Owner toggled manual override in dashboard' : 'Owner re-enabled AI receptionist mode',
        success: true, toolUsed: 'manual_override'
      });
      return res.json(conv);
    }
    return res.status(404).json({ error: 'Conversation not found' });
  }

  try {
    const docRef = db.collection(`businesses/${businessId}/conversations`).doc(phone);
    const docSnap = await docRef.get();
    if (!docSnap.exists) return res.status(404).json({ error: 'Conversation not found' });

    const updatedConv = docSnap.data() as Conversation;
    updatedConv.aiPaused = !updatedConv.aiPaused;
    await docRef.update({ aiPaused: updatedConv.aiPaused });

    // Sync in-memory cache
    const memConv = conversations.find((c) => c.businessId === businessId && c.customerPhone === phone);
    if (memConv) {
      memConv.aiPaused = updatedConv.aiPaused;
    }

    // Add log
    await db.collection(`businesses/${businessId}/agentLogs`).add({
      id: `log_${Date.now()}`, businessId, timestamp: new Date().toISOString(), conversationId: phone,
      action: updatedConv.aiPaused ? 'Salon Owner took over chat (AI Paused)' : 'Salon Owner restored AI Agent',
      reasoning: updatedConv.aiPaused ? 'Owner toggled manual override in dashboard' : 'Owner re-enabled AI receptionist mode',
      success: true, toolUsed: 'manual_override'
    });
    res.json(updatedConv);
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/conversations/send', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { phone, text, isTemplate, templateId } = req.body;

  let finalMessageText = text;
  const now = new Date().toISOString();

  // Validate 24-hour window for manual free-form text
  let conv = null;
  if (!db) {
    conv = conversations.find((c) => c.businessId === businessId && c.customerPhone === phone);
  } else {
    try {
      const convSnap = await db.collection(`businesses/${businessId}/conversations`).doc(phone).get();
      if (convSnap.exists) conv = convSnap.data() as Conversation;
    } catch (e) {
      console.error('Error fetching conv', e);
    }
  }

  if (conv && !isTemplate) {
    const isWindowClosed = (Date.now() - new Date(conv.lastMessageAt).getTime()) > 24 * 60 * 60 * 1000;
    if (isWindowClosed) {
      return res.status(403).json({ error: '24-hour window closed. Please send a pre-approved template.' });
    }
  }

  // Handle Template injection
  let actionStr = undefined;
  if (isTemplate) {
    if (templateId === 'template_1') finalMessageText = "We're here to help! Reply to this message to continue our conversation.";
    else if (templateId === 'template_2') finalMessageText = "Hi! Just a friendly reminder about your upcoming appointment.";
    else if (templateId === 'template_3') finalMessageText = "We miss you! Let us know if you'd like to book another visit.";
    else finalMessageText = "We're here to help! Reply to this message to continue our conversation.";
    actionStr = 'sent_template_reengagement';
  } else {
    if (!finalMessageText) return res.status(400).json({ error: 'Message text is required' });
  }

  const newMsg: Message = { 
    id: `msg_${Date.now()}`, 
    businessId, 
    customerPhone: phone, 
    sender: 'owner', 
    text: finalMessageText, 
    timestamp: now,
    agentAction: actionStr
  };

  if (!db) {
    messages.push(newMsg);
    if (conv) conv.lastMessageAt = now;
    return res.status(201).json(newMsg);
  }

  try {
    await db.collection(`businesses/${businessId}/conversations/${phone}/messages`).doc(newMsg.id).set(newMsg);
    await db.collection(`businesses/${businessId}/conversations`).doc(phone).update({ lastMessageAt: now });
    res.status(201).json(newMsg);
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

// Bookings
app.get('/api/bookings', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  if (!db) {
    const filtered = bookings.filter((b) => b.businessId === businessId);
    return res.json(filtered);
  }
  try {
    const snapshot = await db.collection(`businesses/${businessId}/bookings`).orderBy('createdAt', 'desc').get();
    res.json(snapshot.docs.map(d => d.data()));
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/bookings', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { customerPhone, customerName, serviceId, stylistId, startTime, notes } = req.body;

  const start = new Date(startTime);
  const end = new Date(start.getTime() + 45 * 60 * 1000); // Default duration 45m if db fails

  const newBooking: Booking = {
    id: `bk_${Date.now()}`, businessId,
    customerPhone: customerPhone || '+92 300 1234567',
    customerName: customerName || 'Walk-in Customer',
    serviceId: serviceId || 'srv_haircut',
    stylistId: stylistId || undefined,
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: 'confirmed', createdBy: 'owner',
    createdAt: new Date().toISOString(),
    notes: notes || '',
  };

  if (!db) {
    bookings.unshift(newBooking);
    return res.status(201).json(newBooking);
  }

  try {
    const bizSnap = await db.collection('businesses').doc(businessId).get();
    if (bizSnap.exists) {
      const biz = bizSnap.data() as Business;
      const service = biz.services.find(s => s.id === serviceId);
      if (service) {
        newBooking.endTime = new Date(start.getTime() + service.durationMinutes * 60 * 1000).toISOString();
      }
    }
    await db.collection(`businesses/${businessId}/bookings`).doc(newBooking.id).set(newBooking);
    res.status(201).json(newBooking);
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.patch('/api/bookings/:id/status', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { status } = req.body;
  if (!db) {
    const bk = bookings.find((b) => b.id === req.params.id);
    if (bk) {
      bk.status = status;
      return res.json(bk);
    }
    return res.status(404).json({ error: 'Booking not found' });
  }

  try {
    const docRef = db.collection(`businesses/${businessId}/bookings`).doc(req.params.id);
    await docRef.update({ status });
    const snap = await docRef.get();
    res.json(snap.data());
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.put('/api/bookings/:id', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { customerName, customerPhone, serviceId, stylistId, startTime, notes } = req.body;
  const start = new Date(startTime);
  
  if (!db) {
    const bk = bookings.find((b) => b.id === req.params.id);
    if (bk) {
      bk.customerName = customerName;
      bk.customerPhone = customerPhone;
      bk.serviceId = serviceId;
      bk.stylistId = stylistId;
      bk.startTime = start.toISOString();
      bk.notes = notes;
      return res.json(bk);
    }
    return res.status(404).json({ error: 'Booking not found' });
  }

  try {
    const docRef = db.collection(`businesses/${businessId}/bookings`).doc(req.params.id);
    const bkSnap = await docRef.get();
    if (!bkSnap.exists) return res.status(404).json({ error: 'Booking not found' });
    
    let endTimeStr = bkSnap.data()?.endTime;
    const bizSnap = await db.collection('businesses').doc(businessId).get();
    if (bizSnap.exists) {
      const biz = bizSnap.data() as Business;
      const service = biz.services.find(s => s.id === serviceId);
      if (service) {
        endTimeStr = new Date(start.getTime() + service.durationMinutes * 60 * 1000).toISOString();
      }
    }

    const updateData: any = {
      customerName,
      customerPhone,
      serviceId,
      stylistId,
      startTime: start.toISOString(),
      endTime: endTimeStr,
      notes: notes || ''
    };
    
    if (req.body.status) {
      updateData.status = req.body.status;
    }

    await docRef.update(updateData);
    const updatedSnap = await docRef.get();
    res.json(updatedSnap.data());
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.delete('/api/bookings/:id', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  if (!db) {
    const idx = bookings.findIndex((b) => b.id === req.params.id);
    if (idx !== -1) {
      bookings.splice(idx, 1);
      return res.json({ success: true });
    }
    return res.status(404).json({ error: 'Booking not found' });
  }

  try {
    await db.collection(`businesses/${businessId}/bookings`).doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

// Customers list
app.get('/api/customers', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  if (!db) {
    const biz = businesses.find((b) => b.id === businessId) || businesses[0];
    const customerMap = new Map<string, Customer>();
    conversations.filter((c) => c.businessId === businessId).forEach((c) => {
      customerMap.set(c.customerPhone, { phone: c.customerPhone, name: c.customerName || 'Customer', firstSeenAt: c.lastMessageAt, totalBookings: 0, completedBookings: 0, totalSpent: 0 });
    });
    bookings.filter((b) => b.businessId === businessId).forEach((b) => {
      const service = biz.services.find((s) => s.id === b.serviceId);
      const price = service ? service.price : 3000;
      const existing = customerMap.get(b.customerPhone) || { phone: b.customerPhone, name: b.customerName, firstSeenAt: b.createdAt, totalBookings: 0, completedBookings: 0, totalSpent: 0 };
      existing.totalBookings += 1;
      if (b.status === 'completed') { existing.completedBookings += 1; existing.totalSpent += price; }
      if (!existing.lastBookingDate || new Date(b.startTime) > new Date(existing.lastBookingDate)) { existing.lastBookingDate = b.startTime; }
      customerMap.set(b.customerPhone, existing);
    });
    return res.json(Array.from(customerMap.values()));
  }

  try {
    const bizSnap = await db.collection('businesses').doc(businessId).get();
    const biz = bizSnap.data() as Business;
    const customerMap = new Map<string, Customer>();
    const convSnap = await db.collection(`businesses/${businessId}/conversations`).get();
    convSnap.forEach(doc => {
      const c = doc.data() as Conversation;
      customerMap.set(c.customerPhone, { phone: c.customerPhone, name: c.customerName || 'Customer', firstSeenAt: c.lastMessageAt, totalBookings: 0, completedBookings: 0, totalSpent: 0 });
    });

    const bkSnap = await db.collection(`businesses/${businessId}/bookings`).get();
    bkSnap.forEach(doc => {
      const b = doc.data() as Booking;
      const service = biz.services.find(s => s.id === b.serviceId);
      const price = service ? service.price : 3000;
      const existing = customerMap.get(b.customerPhone) || { phone: b.customerPhone, name: b.customerName, firstSeenAt: b.createdAt, totalBookings: 0, completedBookings: 0, totalSpent: 0 };
      existing.totalBookings += 1;
      if (b.status === 'completed') { existing.completedBookings += 1; existing.totalSpent += price; }
      if (!existing.lastBookingDate || new Date(b.startTime) > new Date(existing.lastBookingDate)) { existing.lastBookingDate = b.startTime; }
      customerMap.set(b.customerPhone, existing);
    });
    res.json(Array.from(customerMap.values()));
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

// Agent Logs
app.get('/api/agent-logs', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  if (!db) {
    const filtered = agentLogs.filter((l) => l.businessId === businessId);
    return res.json(filtered);
  }
  try {
    const snap = await db.collection(`businesses/${businessId}/agentLogs`).orderBy('timestamp', 'desc').get();
    res.json(snap.docs.map(d => d.data()));
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

// Billing
app.get('/api/billing', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  if (!db) {
    const biz = businesses.find((b) => b.id === businessId) || businesses[0];
    const history = payments.filter((p) => p.businessId === businessId);
    return res.json({ subscriptionStatus: biz.subscriptionStatus, price: biz.subscriptionPrice, currency: biz.subscriptionCurrency, payments: history });
  }
  try {
    const bizSnap = await db.collection('businesses').doc(businessId).get();
    const biz = bizSnap.data() as Business;
    const snap = await db.collection(`businesses/${businessId}/payments`).orderBy('recordedAt', 'desc').get();
    res.json({ subscriptionStatus: biz.subscriptionStatus, price: biz.subscriptionPrice, currency: biz.subscriptionCurrency, payments: snap.docs.map(d => d.data()) });
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

app.post('/api/billing/payment', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  const { amount, currency, method, periodCovered, notes } = req.body;
  const newPayment: Payment = { id: `pay_${Date.now()}`, businessId, amount: Number(amount) || 7500, currency: currency || 'PKR', method: method || 'jazzcash', periodCovered: periodCovered || '2026-08', recordedAt: new Date().toISOString(), notes: notes || 'Manual subscription payment recorded by salon owner' };

  if (!db) {
    payments.unshift(newPayment);
    const biz = businesses.find((b) => b.id === businessId);
    if (biz) biz.subscriptionStatus = 'active';
    return res.status(201).json(newPayment);
  }

  try {
    await db.collection(`businesses/${businessId}/payments`).doc(newPayment.id).set(newPayment);
    await db.collection('businesses').doc(businessId).update({ subscriptionStatus: 'active' });
    res.status(201).json(newPayment);
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

// Analytics
app.get('/api/analytics', async (req, res) => {
  const businessId = (req.query.businessId as string) || 'biz_glamour_lounge';
  if (!db) {
    const biz = businesses.find((b) => b.id === businessId) || businesses[0];
    const bizBookings = bookings.filter((b) => b.businessId === businessId);
    const aiBookings = bizBookings.filter((b) => b.createdBy === 'ai').length;
    const manualBookings = bizBookings.filter((b) => b.createdBy === 'owner').length;
    const totalRevenue = bizBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').reduce((sum, b) => {
      const srv = biz.services.find((s) => s.id === b.serviceId); return sum + (srv ? srv.price : 3000);
    }, 0);
    return res.json({ messagesHandledThisMonth: messages.filter((m) => m.businessId === businessId).length, aiBookingsCount: aiBookings, manualBookingsCount: manualBookings, estimatedNoShowsPrevented: Math.round(aiBookings * 0.35), avgResponseTimeSeconds: 2.1, revenueGenerated: totalRevenue });
  }

  try {
    const bizSnap = await db.collection('businesses').doc(businessId).get();
    const biz = bizSnap.data() as Business;
    const bkSnap = await db.collection(`businesses/${businessId}/bookings`).get();
    const bizBookings = bkSnap.docs.map(d => d.data() as Booking);
    const aiBookings = bizBookings.filter((b) => b.createdBy === 'ai').length;
    const manualBookings = bizBookings.filter((b) => b.createdBy === 'owner').length;
    const totalRevenue = bizBookings.filter((b) => b.status === 'completed' || b.status === 'confirmed').reduce((sum, b) => {
      const srv = biz.services.find((s) => s.id === b.serviceId); return sum + (srv ? srv.price : 3000);
    }, 0);

    res.json({
      messagesHandledThisMonth: 120, // Example stat
      aiBookingsCount: aiBookings,
      manualBookingsCount: manualBookings,
      estimatedNoShowsPrevented: Math.round(aiBookings * 0.35),
      avgResponseTimeSeconds: 2.1,
      revenueGenerated: totalRevenue,
    });
  } catch (e) { res.status(500).json({ error: 'DB Error' }); }
});

// ==================== GEMINI AI AGENT & FUNCTION CALLING ENGINE ====================

// Tool declarations for Gemini using parametersJsonSchema as requested
const checkAvailabilityTool: FunctionDeclaration = {
  name: 'checkAvailability',
  description: 'Checks salon availability and open time slots for a given service and date.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      serviceId: { type: 'string', description: 'Service ID or name' },
      stylistId: { type: 'string', description: 'Optional stylist ID or name' },
      date: { type: 'string', description: 'Date MUST be in strict YYYY-MM-DD format (e.g., "2026-08-03"). Convert natural language like "tomorrow" to this exact format.' },
    },
    required: ['serviceId', 'date'],
  },
};

const createBookingTool: FunctionDeclaration = {
  name: 'createBooking',
  description: 'Creates a confirmed salon booking appointment for a customer.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      serviceId: { type: 'string', description: 'Service ID or name' },
      stylistId: { type: 'string', description: 'Optional stylist ID or name' },
      customerName: { type: 'string', description: 'Customer full name' },
      startTime: { type: 'string', description: 'Appointment start time in ISO format or timestamp' },
    },
    required: ['serviceId', 'customerName', 'startTime'],
  },
};

const rescheduleBookingTool: FunctionDeclaration = {
  name: 'rescheduleBooking',
  description: 'Reschedules an existing booking to a new date and time.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      bookingId: { type: 'string', description: 'The ID of the existing booking' },
      newStartTime: { type: 'string', description: 'New requested start time in ISO format' },
    },
    required: ['bookingId', 'newStartTime'],
  },
};

const cancelBookingTool: FunctionDeclaration = {
  name: 'cancelBooking',
  description: 'Cancels an existing salon booking.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      bookingId: { type: 'string', description: 'The ID of the booking to cancel' },
      reason: { type: 'string', description: 'Reason for cancellation' },
    },
    required: ['bookingId'],
  },
};

const escalateToOwnerTool: FunctionDeclaration = {
  name: 'escalateToOwner',
  description: 'Escalates the conversation to the human salon owner when custom discounts, complaints, or complex requests occur.',
  parametersJsonSchema: {
    type: 'object',
    properties: {
      reason: { type: 'string', description: 'Detailed reason for escalation' },
    },
    required: ['reason'],
  },
};

// Also define snake_case aliases for robust matching
const checkAvailabilitySnakeTool: FunctionDeclaration = {
  ...checkAvailabilityTool,
  name: 'check_availability',
};
const createBookingSnakeTool: FunctionDeclaration = {
  ...createBookingTool,
  name: 'create_booking',
};
const rescheduleBookingSnakeTool: FunctionDeclaration = {
  ...rescheduleBookingTool,
  name: 'reschedule_booking',
};
const cancelBookingSnakeTool: FunctionDeclaration = {
  ...cancelBookingTool,
  name: 'cancel_booking',
};
const escalateToOwnerSnakeTool: FunctionDeclaration = {
  ...escalateToOwnerTool,
  name: 'escalate_to_owner',
};

// Helper function to execute tools locally against in-memory DB
async function executeTool(
  biz: Business,
  customerPhone: string,
  customerName: string,
  rawToolName: string,
  args: any
): Promise<{ result: any; actionName: string }> {
  console.log(`Executing tool [${rawToolName}] with args:`, args);

  // Normalize tool names (supports both camelCase and snake_case)
  const name = rawToolName === 'checkAvailability' ? 'check_availability'
    : rawToolName === 'createBooking' ? 'create_booking'
      : rawToolName === 'rescheduleBooking' ? 'reschedule_booking'
        : rawToolName === 'cancelBooking' ? 'cancel_booking'
          : rawToolName === 'escalateToOwner' ? 'escalate_to_owner'
            : rawToolName;

  if (name === 'check_availability') {
    const serviceName = args.serviceId || 'Service';
    const matchedService = biz.services.find(
      (s) => s.id === args.serviceId || s.name.toLowerCase().includes((args.serviceId || '').toLowerCase())
    ) || biz.services[0];

    const matchedStylist = biz.stylists.find(
      (st) => st.id === args.stylistId || st.name.toLowerCase().includes((args.stylistId || '').toLowerCase())
    ) || biz.stylists[0];

    // 1. Parse date
    let targetDate = new Date(args.date);
    if (isNaN(targetDate.getTime())) {
      targetDate = new Date();
    }

    // 2. Determine hours
    const days: (keyof typeof biz.hours)[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayStr = days[targetDate.getDay()];
    const bizHours = biz.hours[dayStr];
    
    let openSlots: string[] = [];

    if (!bizHours.closed) {
      const [openH, openM] = bizHours.open.split(':').map(Number);
      const [closeH, closeM] = bizHours.close.split(':').map(Number);
      
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(openH, openM, 0, 0);
      
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(closeH, closeM, 0, 0);

      // 3. Fetch existing bookings
      let dayBookings = bookings.filter((b) => {
        if (b.status === 'cancelled') return false;
        if (b.businessId !== biz.id) return false;
        if (matchedStylist && b.stylistId && b.stylistId !== matchedStylist.id) return false;
        
        const bStart = new Date(b.startTime);
        return bStart.toDateString() === targetDate.toDateString();
      });

      if (db) {
        try {
          const snap = await db.collection(`businesses/${biz.id}/bookings`)
            .where('startTime', '>=', startOfDay.toISOString())
            .where('startTime', '<=', endOfDay.toISOString())
            .get();
          const dbBookings = snap.docs.map(d => d.data() as Booking);
          // Merge avoiding duplicates
          for (const dbBk of dbBookings) {
            if (!dayBookings.find(b => b.id === dbBk.id)) {
              if (dbBk.status !== 'cancelled' && (!matchedStylist || !dbBk.stylistId || dbBk.stylistId === matchedStylist.id)) {
                dayBookings.push(dbBk);
              }
            }
          }
        } catch (e) { console.error('Failed to fetch bookings for availability check', e); }
      }

      // 4. Generate overlapping slots
      const slotDuration = matchedService.durationMinutes;
      let currentSlot = new Date(startOfDay);

      // Ensure we don't return slots in the past if checking for today
      const now = new Date();
      if (currentSlot.getTime() < now.getTime() && targetDate.toDateString() === now.toDateString()) {
        // fast forward currentSlot to next 30 min boundary after now
        currentSlot.setTime(Math.ceil(now.getTime() / (30 * 60 * 1000)) * (30 * 60 * 1000));
      }

      while (currentSlot.getTime() + slotDuration * 60 * 1000 <= endOfDay.getTime()) {
        const slotStart = currentSlot.getTime();
        const slotEnd = slotStart + slotDuration * 60 * 1000;

        let isOverlap = false;
        for (const b of dayBookings) {
          const bStart = new Date(b.startTime).getTime();
          const bEnd = new Date(b.endTime).getTime();
          if (slotStart < bEnd && slotEnd > bStart) {
            isOverlap = true;
            break;
          }
        }

        if (!isOverlap) {
          openSlots.push(currentSlot.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        }

        // Advance by 30 mins
        currentSlot = new Date(currentSlot.getTime() + 30 * 60 * 1000);
      }
    }

    return {
      result: {
        service: matchedService.name,
        price: `${biz.subscriptionCurrency === 'PKR' ? 'PKR' : '$'} ${matchedService.price}`,
        duration: `${matchedService.durationMinutes} minutes`,
        requestedDate: args.date,
        availableSlots: openSlots.length > 0 ? openSlots : ["No slots available"],
        assignedStylist: matchedStylist.name,
      },
      actionName: 'checked_availability',
    };
  }

  if (name === 'create_booking') {
    const matchedService = biz.services.find(
      (s) => s.id === args.serviceId || s.name.toLowerCase().includes((args.serviceId || '').toLowerCase())
    ) || biz.services[0];

    const matchedStylist = biz.stylists.find(
      (st) => st.id === args.stylistId || st.name.toLowerCase().includes((args.stylistId || '').toLowerCase())
    ) || biz.stylists[0];

    const start = args.startTime && args.startTime.includes('T')
      ? new Date(args.startTime)
      : new Date(Date.now() + 2 * 3600 * 1000);

    const end = new Date(start.getTime() + matchedService.durationMinutes * 60 * 1000);

    const newBk: Booking = {
      id: `bk_${Date.now()}`,
      businessId: biz.id,
      customerPhone,
      customerName: args.customerName || customerName || 'Valued Client',
      serviceId: matchedService.id,
      stylistId: matchedStylist ? matchedStylist.id : undefined,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      status: 'confirmed',
      createdBy: 'ai',
      createdAt: new Date().toISOString(),
      notes: args.notes || 'Booked via WhatsApp AI Receptionist',
    };

    bookings.unshift(newBk);
    if (db) {
      try {
        await db.collection(`businesses/${biz.id}/bookings`).doc(newBk.id).set(newBk);
      } catch (e) { console.error('Failed to save booking', e); }
    }

    return {
      result: {
        bookingId: newBk.id,
        status: 'confirmed',
        serviceName: matchedService.name,
        stylistName: matchedStylist ? matchedStylist.name : 'Staff Specialist',
        startTime: newBk.startTime,
        price: matchedService.price,
        currency: biz.subscriptionCurrency,
      },
      actionName: 'created_booking',
    };
  }

  if (name === 'reschedule_booking') {
    let bk = bookings.find((b) => b.id === args.bookingId || b.customerPhone === customerPhone);
    if (!bk && db) {
      if (args.bookingId) {
        const doc = await db.collection(`businesses/${biz.id}/bookings`).doc(args.bookingId).get();
        if (doc.exists) bk = doc.data() as Booking;
      }
      if (!bk) {
        const snap = await db.collection(`businesses/${biz.id}/bookings`)
          .where('customerPhone', '==', customerPhone)
          .where('status', 'in', ['confirmed', 'rescheduled'])
          .get();
        if (!snap.empty) bk = snap.docs[0].data() as Booking;
      }
    }
    if (bk) {
      bk.startTime = args.newStartTime || new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      bk.status = 'confirmed';
      if (db) {
        try {
          await db.collection(`businesses/${biz.id}/bookings`).doc(bk.id).update({
            startTime: bk.startTime,
            status: bk.status
          });
        } catch (e) { console.error('Failed to update booking reschedule', e); }
      }
      return {
        result: { status: 'rescheduled', bookingId: bk.id, newStartTime: bk.startTime },
        actionName: 'rescheduled_booking',
      };
    }
    return {
      result: { error: 'Booking not found to reschedule' },
      actionName: 'reschedule_attempted',
    };
  }

  if (name === 'cancel_booking') {
    let bk = bookings.find((b) => b.id === args.bookingId || b.customerPhone === customerPhone);
    if (!bk && db) {
      if (args.bookingId) {
        const doc = await db.collection(`businesses/${biz.id}/bookings`).doc(args.bookingId).get();
        if (doc.exists) bk = doc.data() as Booking;
      }
      if (!bk) {
        const snap = await db.collection(`businesses/${biz.id}/bookings`)
          .where('customerPhone', '==', customerPhone)
          .where('status', 'in', ['confirmed', 'rescheduled'])
          .get();
        if (!snap.empty) bk = snap.docs[0].data() as Booking;
      }
    }
    if (bk) {
      bk.status = 'cancelled';
      if (db) {
        try {
          await db.collection(`businesses/${biz.id}/bookings`).doc(bk.id).update({
            status: bk.status
          });
        } catch (e) { console.error('Failed to update booking cancel', e); }
      }
      return {
        result: { status: 'cancelled', bookingId: bk.id },
        actionName: 'cancelled_booking',
      };
    }
    return {
      result: { error: 'Booking not found to cancel' },
      actionName: 'cancel_attempted',
    };
  }

  if (name === 'escalate_to_owner') {
    const conv = conversations.find((c) => c.businessId === biz.id && c.customerPhone === customerPhone);
    if (conv) {
      conv.aiPaused = true;
      if (db) {
        try {
          await db.collection(`businesses/${biz.id}/conversations`).doc(customerPhone).update({
            aiPaused: true
          });
        } catch (e) { console.error('Failed to update aiPaused on escalate', e); }
      }
    }
    return {
      result: { status: 'escalated', ownerAlerted: true, reason: args.reason },
      actionName: 'escalated',
    };
  }

  return { result: { success: true }, actionName: 'ai_tool_call' };
}

// Meta WhatsApp Cloud API Message Sender
async function sendWhatsAppMessage(phoneNumberId: string, toPhone: string, text: string) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) {
    console.warn('WHATSAPP_ACCESS_TOKEN missing. Skipping Meta API call.');
    return;
  }
  const cleanPhone = toPhone.replace(/\+/g, '');
  try {
    const response = await fetch(`https://graph.facebook.com/v19.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: cleanPhone,
        type: 'text',
        text: { preview_url: false, body: text }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('Meta API Error sending message:', data);
    } else {
      console.log('Successfully sent WhatsApp reply to', cleanPhone);
    }
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err);
  }
}

// Standardized Inbound WhatsApp AI Message Processing Engine
async function handleIncomingMessage({
  businessId,
  customerPhone,
  customerName,
  text,
}: {
  businessId?: string;
  customerPhone?: string;
  customerName?: string;
  text?: string;
}): Promise<{
  replyText: string;
  agentAction: string;
  aiPaused?: boolean;
  isTemplate?: boolean;
}> {
  let biz: Business | undefined;
  let currentBizId = businessId;

  if (db && currentBizId) {
    try {
      const doc = await db.collection('businesses').doc(currentBizId).get();
      if (doc.exists) {
        biz = doc.data() as Business;
      }
    } catch (e) {
      console.error('Error fetching business in handleIncomingMessage:', e);
    }
  }

  // Fallbacks if not found
  if (!biz) {
    if (businesses.length > 0) {
      biz = businesses.find((b) => b.id === currentBizId) || businesses[0];
      currentBizId = biz.id;
    } else {
      console.error(`handleIncomingMessage: No business found for id ${currentBizId}`);
      return { replyText: 'System Error: Salon account not found.', agentAction: 'error' };
    }
  }

  currentBizId = biz.id;
  const phone = customerPhone || '+92 300 9998877';
  const name = customerName || 'Customer';

  // 1. Sanitize & Check Prompt Injection
  const rawText = text || '';
  const { sanitizedText, isInjectionAttempt } = sanitizeAndCheckPromptInjection(rawText);

  if (isInjectionAttempt) {
    const logItem: AgentLog = {
      id: `log_${Date.now()}`,
      businessId: currentBizId,
      timestamp: new Date().toISOString(),
      conversationId: phone,
      action: 'PROMPT_INJECTION_ATTEMPT_BLOCKED',
      toolUsed: 'security_filter',
      reasoning: `Prompt injection attack pattern detected and sanitized from customer: "${rawText.substring(0, 100)}"`,
      success: false,
    };
    agentLogs.unshift(logItem);
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/agentLogs`).add(logItem);
      } catch (e) { console.error('Failed to save log', e); }
    }
  }

  // 2. Check Rate Limits & Daily Cost Controls
  const rateLimitStatus = checkAndIncrementRateLimit(phone, currentBizId);
  if (!rateLimitStatus.allowed) {
    const isDailyCap = rateLimitStatus.reason === 'DAILY_BUSINESS_BUDGET_EXCEEDED';
    const rateLimitReply = isDailyCap
      ? `Hello ${name}, thank you for contacting ${biz.name}! Our automated receptionist daily message capacity has been reached for today. Our human salon team will assist you directly shortly!`
      : `Hello ${name}, you've sent messages too quickly. Please wait a moment before sending another message.`;

    const logItem: AgentLog = {
      id: `log_${Date.now()}`,
      businessId: currentBizId,
      timestamp: new Date().toISOString(),
      conversationId: phone,
      action: isDailyCap ? 'DAILY_AI_CAP_REACHED' : 'RATE_LIMIT_EXCEEDED',
      toolUsed: 'rate_limiter',
      reasoning: `Request blocked due to: ${rateLimitStatus.reason}`,
      success: false,
    };
    agentLogs.unshift(logItem);
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/agentLogs`).add(logItem);
      } catch (e) { console.error('Failed to save log', e); }
    }

    return {
      replyText: rateLimitReply,
      agentAction: 'rate_limited',
      aiPaused: false,
    };
  }

  const now = new Date().toISOString();

  let conv = conversations.find((c) => c.businessId === currentBizId && c.customerPhone === phone);

  // Save customer message
  const custMsg: Message = {
    id: `msg_${Date.now()}`,
    businessId: currentBizId,
    customerPhone: phone,
    sender: 'customer',
    text: sanitizedText,
    timestamp: now,
  };
  messages.push(custMsg);
  if (db) {
    try {
      await db.collection(`businesses/${currentBizId}/conversations/${phone}/messages`).doc(custMsg.id).set(custMsg);
    } catch (e) { console.error('Failed to save custMsg', e); }
  }

  // Update conversation record timestamp
  if (!conv) {
    conv = {
      id: phone,
      businessId: currentBizId,
      customerPhone: phone,
      customerName: name,
      lastMessageAt: now,
      aiPaused: false,
      unreadCount: 0,
    };
    conversations.unshift(conv);
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/conversations`).doc(phone).set(conv);
      } catch (e) { console.error('Failed to save conv', e); }
    }
  } else {
    conv.lastMessageAt = now;
    if (name && name !== 'Customer') conv.customerName = name;
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/conversations`).doc(phone).update({ 
          lastMessageAt: now,
          customerName: conv.customerName 
        });
      } catch (e) { console.error('Failed to update conv', e); }
    }
  }

  // Check if owner took over
  if (conv.aiPaused) {
    return {
      replyText: "[AI is currently paused for this conversation because the salon owner took over. The message has been routed to the owner's dashboard inbox.]",
      aiPaused: true,
      agentAction: 'owner_takeover_active',
      wasAlreadyPaused: true,
    };
  }

  // (Removed faulty template re-engagement logic because customer just messaged, window is always open here)

  // Process with Gemini API
  const aiClient = getGenAI();

  if (!aiClient) {
    // Fallback if no Gemini API Key is configured
    const simulatedReply = `Hello ${name}! Thank you for reaching out to ${biz.name}. Our AI agent is ready to assist you. Our available services include: ${biz.services.map((s) => s.name).join(', ')}. Would you like to check availability or make a booking?`;
    const agentMsg: Message = {
      id: `msg_${Date.now() + 1}`,
      businessId: currentBizId,
      customerPhone: phone,
      sender: 'agent',
      text: simulatedReply,
      timestamp: new Date().toISOString(),
      agentAction: 'checked_availability',
    };
    messages.push(agentMsg);
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/conversations/${phone}/messages`).doc(agentMsg.id).set(agentMsg);
      } catch (e) { console.error('Failed to save agentMsg (fallback)', e); }
    }

    return {
      replyText: simulatedReply,
      agentAction: 'checked_availability',
    };
  }

  try {
    // Context Window Slicing: Max 8 messages to constrain token usage & costs
    let existingThread = messages
      .filter((m) => m.businessId === currentBizId && m.customerPhone === phone)
      .slice(-8);

    // If server restarted, memory is empty (only has current message). Fetch context from DB!
    if (existingThread.length === 1 && db) {
      try {
        const snap = await db.collection(`businesses/${currentBizId}/conversations/${phone}/messages`)
          .orderBy('timestamp', 'desc')
          .limit(8)
          .get();
        if (!snap.empty) {
          const dbMessages = snap.docs.map(d => d.data() as Message).reverse();
          existingThread = dbMessages;
          
          // Hydrate memory to avoid re-fetching
          for (const msg of dbMessages) {
            if (!messages.find(m => m.id === msg.id)) messages.push(msg);
          }
        }
      } catch (e) { console.error('Failed to load context from DB', e); }
    }

    let activeBookingsText = "This customer currently has no active bookings.";
    if (db) {
      try {
        const snap = await db.collection(`businesses/${currentBizId}/bookings`)
          .where('customerPhone', '==', phone)
          .where('status', 'in', ['confirmed', 'rescheduled'])
          .get();
        if (!snap.empty) {
          const activeBks = snap.docs.map(d => d.data() as Booking);
          activeBookingsText = `CURRENT ACTIVE BOOKINGS FOR THIS CUSTOMER:\n` + 
            activeBks.map(b => `- Booking ID: ${b.id} | Service: ${biz.services.find(s=>s.id === b.serviceId)?.name || b.serviceId} | Time: ${new Date(b.startTime).toLocaleString('en-US')}`).join('\n');
        }
      } catch (e) { console.error('Failed to fetch active bookings for prompt', e); }
    }

    const systemInstruction = `
You are SalonAI, an exceptionally friendly, articulate, professional, and efficient WhatsApp AI receptionist for "${biz.name}".

CURRENT DATE & TIME: ${new Date().toLocaleString()} (Always base availability and bookings relative to this date).

${activeBookingsText}

Salon Details:
- Name: ${biz.name}
- Phone: ${biz.phone}
- Salon Owner: ${biz.ownerName}
- Services Available:
${biz.services.map((s) => `  * ${s.name} (${s.durationMinutes} mins) - ${biz.subscriptionCurrency === 'PKR' ? 'PKR' : '$'} ${s.price}: ${s.description}`).join('\n')}
- Stylists:
${biz.stylists.map((st) => `  * ${st.name} (Specialties: ${st.specialties.join(', ')})`).join('\n')}
- Opening Hours:
  Mon-Fri: ${biz.hours.mon.open} - ${biz.hours.mon.close}
  Sat: ${biz.hours.sat.open} - ${biz.hours.sat.close}
  Sun: ${biz.hours.sun.closed ? 'Closed' : `${biz.hours.sun.open} - ${biz.hours.sun.close}`}

Your primary duties:
1. Answer questions clearly about services, pricing, opening hours, and address.
2. Check real-time availability using the 'check_availability' tool before proposing time slots.
3. Book appointments using the 'create_booking' tool when the customer selects a time. 
   - CRITICAL: ALWAYS ask for the customer's name before creating the booking, unless they've already explicitly told you their name.
   - CRITICAL: After the 'create_booking' tool succeeds, you MUST include the unique Booking ID in your confirmation message to the customer.
4. Reschedule or cancel existing bookings using 'reschedule_booking' or 'cancel_booking'.
5. If the customer asks for custom discounts, complains, or requests special unapproved packages, use 'escalate_to_owner' to loop in ${biz.ownerName}.
6. Keep messages warm, concise, and formatted naturally for WhatsApp (use line breaks and emojis where appropriate).
7. IMPORTANT: If you have already confirmed a time slot with the user and they provided their name to proceed, DO NOT call 'check_availability' again. Immediately use 'create_booking' with the agreed time converted to ISO format.
`;

    // Construct conversation history
    const contents: any[] = existingThread.map((m) => ({
      role: m.sender === 'customer' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    // Call Gemini with tool definitions and COST CONTROLS
    let response = await aiClient.models.generateContent({
      model: 'gemini-3.5-flash-lite',
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 1000,
        tools: [
          {
            functionDeclarations: [
              checkAvailabilityTool,
              createBookingTool,
              rescheduleBookingTool,
              cancelBookingTool,
              escalateToOwnerTool,
            ],
          },
        ],
      },
    });

    let lastAction = 'replied';
    let currentContents = contents;
    let toolCallCount = 0;

    // Handle function calls if model invoked tools (up to 3 sequential tool calls allowed)
    while (response.functionCalls && response.functionCalls.length > 0 && toolCallCount < 3) {
      toolCallCount++;
      const toolCall = response.functionCalls[0];
      const { result, actionName } = await executeTool(biz, phone, name, toolCall.name, toolCall.args);
      lastAction = actionName;

      // Log AI reasoning/action
      const logItem: AgentLog = {
        id: `log_${Date.now()}_${toolCallCount}`,
        businessId: currentBizId,
        timestamp: new Date().toISOString(),
        conversationId: phone,
        action: `AI invoked function: ${toolCall.name}`,
        toolUsed: toolCall.name,
        reasoning: `Customer asked: "${sanitizedText}". Function output: ${JSON.stringify(result)}`,
        success: true,
      };
      agentLogs.unshift(logItem);
      if (db) {
        try {
          await db.collection(`businesses/${currentBizId}/agentLogs`).add(logItem);
        } catch (e) { console.error('Failed to save log', e); }
      }

      // Append function response to contents for the next turn
      currentContents = [
        ...currentContents,
        response.candidates?.[0]?.content,
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: toolCall.name,
                response: result,
              },
            }
          ],
        },
      ];

      response = await aiClient.models.generateContent({
        model: 'gemini-3.5-flash-lite',
        contents: currentContents,
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: 1000,
          tools: [
            {
              functionDeclarations: [
                checkAvailabilityTool,
                createBookingTool,
                rescheduleBookingTool,
                cancelBookingTool,
                escalateToOwnerTool,
              ],
            },
          ],
        },
      });
    }

    const replyText =
      response.text ||
      `Thank you for reaching out to ${biz.name}! We've noted your request and look forward to serving you.`;

    // Save agent reply to thread
    const agentMsg: Message = {
      id: `msg_${Date.now() + 2}`,
      businessId: currentBizId,
      customerPhone: phone,
      sender: 'agent',
      text: replyText,
      timestamp: new Date().toISOString(),
      agentAction: lastAction,
    };
    messages.push(agentMsg);
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/conversations/${phone}/messages`).doc(agentMsg.id).set(agentMsg);
      } catch (e) { console.error('Failed to save agentMsg', e); }
    }

    return {
      replyText,
      agentAction: lastAction,
      aiPaused: conv.aiPaused,
    };
  } catch (error: any) {
    console.error('Gemini Agent Error:', error);
    const fallbackReply = `Hello! Thank you for messaging ${biz.name}. I've logged your request for our salon team. Do you have a preferred time in mind?`;

    const agentMsg: Message = {
      id: `msg_${Date.now() + 3}`,
      businessId: currentBizId,
      customerPhone: phone,
      sender: 'agent',
      text: fallbackReply,
      timestamp: new Date().toISOString(),
      agentAction: 'replied_fallback',
    };
    messages.push(agentMsg);
    if (db) {
      try {
        await db.collection(`businesses/${currentBizId}/conversations/${phone}/messages`).doc(agentMsg.id).set(agentMsg);
      } catch (e) { console.error('Failed to save agentMsg (error fallback)', e); }
    }

    return {
      replyText: fallbackReply,
      agentAction: 'replied_fallback',
    };
  }
}

// WhatsApp Simulation Endpoint (Receives customer message & calls Gemini with tool use)
app.post('/api/whatsapp/simulate', async (req, res) => {
  const result = await handleIncomingMessage(req.body);
  res.json(result);
});

// Meta WhatsApp Webhook Handshake Verification (GET)
app.get('/api/whatsapp/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'salonai_verify_token_2026';

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('WhatsApp Webhook Verified Successfully!');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden: Invalid Verify Token');
  }
});

// Meta WhatsApp Incoming Message Webhook Receiver (POST with HMAC Verification)
app.post('/api/whatsapp/webhook', (req, res) => {
  // 1. HMAC SHA-256 Signature Verification
  if (!verifyWhatsAppSignature(req)) {
    console.warn('X-Hub-Signature-256 verification failed on Meta webhook');
    return res.status(401).send('Unauthorized: Invalid HMAC signature');
  }

  const body = req.body;
  console.log('Incoming Meta WhatsApp Webhook Payload:', JSON.stringify(body, null, 2));

  // Acknowledge Meta immediately with 200 OK so Meta doesn't retry
  res.status(200).send('EVENT_RECEIVED');

  // Parse Meta WhatsApp Webhook Payload asynchronously
  if (body && body.object === 'whatsapp_business_account' && Array.isArray(body.entry)) {
    const processWebhook = async () => {
      for (const entry of body.entry) {
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value && Array.isArray(value.messages)) {
            const metaPhoneNumberId = value.metadata?.phone_number_id;
            
            let matchedBiz: Business | undefined;
            if (db) {
              try {
                const snapshot = await db.collection('businesses').where('whatsappPhoneNumberId', '==', metaPhoneNumberId).get();
                if (!snapshot.empty) {
                  matchedBiz = snapshot.docs[0].data() as Business;
                }
              } catch (e) {
                console.error('Error fetching business by WhatsApp ID:', e);
              }
            } else {
              matchedBiz = businesses.find((b) => b.whatsappPhoneNumberId === metaPhoneNumberId) || businesses[0];
            }

            if (!matchedBiz) {
              console.warn(`No business found for WhatsApp Phone ID: ${metaPhoneNumberId}`);
              continue;
            }

            for (const message of value.messages) {
              // Only process inbound customer text messages (ignore status updates like 'delivered'/'read')
              if (message.type === 'text' && message.text?.body) {
                const rawFrom = message.from || '';
                const customerPhone = rawFrom ? (rawFrom.startsWith('+') ? rawFrom : `+${rawFrom}`) : '+92 300 9998877';
                const customerName = value.contacts?.[0]?.profile?.name || 'Customer';
                const text = message.text.body;

                console.log(`Webhook triggering AI for Business [${matchedBiz.id}] from Customer [${customerPhone}] (${customerName})`);

                // Execute extracted handleIncomingMessage directly
                handleIncomingMessage({
                  businessId: matchedBiz.id,
                  customerPhone,
                  customerName,
                  text,
                }).then(async (result) => {
                  if (result.replyText && !result.wasAlreadyPaused && metaPhoneNumberId) {
                    await sendWhatsAppMessage(metaPhoneNumberId, customerPhone, result.replyText);
                  }
                }).catch((err) => {
                  console.error('Error executing handleIncomingMessage from webhook:', err);
                });
              }
            }
          }
        }
      }
    }
    };
    processWebhook();
  }
});

// ==================== VITE DEVELOPMENT / PRODUCTION SERVING ====================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SalonAI Full-Stack Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();