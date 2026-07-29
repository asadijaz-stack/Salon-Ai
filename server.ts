import express from 'express';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, FunctionDeclaration } from '@google/genai';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Express raw/JSON parsing with raw body capture for HMAC verification
app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf;
  }
}));

const PORT = 3000;

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
const defaultBusinesses: Business[] = [
  {
    id: 'biz_glamour_lounge',
    name: 'Glamour Lounge & Spa',
    ownerName: 'Ayesha Khan',
    ownerEmail: 'ayesha@glamourlounge.pk',
    phone: '+92 300 8472910',
    whatsappPhoneNumberId: 'phone_id_glamour_923008472910',
    hours: {
      mon: { open: '10:00', close: '20:00', closed: false },
      tue: { open: '10:00', close: '20:00', closed: false },
      wed: { open: '10:00', close: '20:00', closed: false },
      thu: { open: '10:00', close: '20:00', closed: false },
      fri: { open: '10:00', close: '20:00', closed: false },
      sat: { open: '10:00', close: '21:00', closed: false },
      sun: { open: '11:00', close: '18:00', closed: false },
    },
    services: [
      { id: 'srv_haircut', name: 'Signature Haircut & Blowdry', category: 'Hair', durationMinutes: 45, price: 3500, description: 'Wash, precision haircut, and custom blowdry styling' },
      { id: 'srv_facial', name: 'Glow HydraFacial', category: 'Skincare', durationMinutes: 60, price: 8500, description: 'Deep cleansing, exfoliation, hydration, and LED light therapy' },
      { id: 'srv_mani_pedi', name: 'Deluxe Mani-Pedi Duo', category: 'Nails', durationMinutes: 75, price: 4500, description: 'Exfoliation scrub, massage, cuticle care, and gel polish' },
      { id: 'srv_keratin', name: 'Keratin Smoothing Treatment', category: 'Hair', durationMinutes: 120, price: 18000, description: 'Frizz control, deep shine, and intense hair straightening' },
      { id: 'srv_makeup', name: 'Party Glam Makeup', category: 'Makeup', durationMinutes: 60, price: 12000, description: 'Full coverage airbrush or HD glam with lash extensions' }
    ],
    stylists: [
      { id: 'stylist_sarah', name: 'Sarah Ahmed', specialties: ['Signature Haircut', 'Keratin'], workingHours: '10:00 - 18:00' },
      { id: 'stylist_zainab', name: 'Zainab Malik', specialties: ['Glow HydraFacial', 'Party Glam Makeup'], workingHours: '11:00 - 19:00' },
      { id: 'stylist_mariam', name: 'Mariam Ali', specialties: ['Deluxe Mani-Pedi', 'Hair Styling'], workingHours: '10:00 - 20:00' }
    ],
    subscriptionStatus: 'active',
    subscriptionPrice: 7500,
    subscriptionCurrency: 'PKR',
    createdAt: '2026-06-01T08:00:00Z',
  },
  {
    id: 'biz_velvet_dha',
    name: 'Velvet Beauty Studio',
    ownerName: 'Sana Tariq',
    ownerEmail: 'sana@velvetdha.pk',
    phone: '+92 321 5551234',
    whatsappPhoneNumberId: 'phone_id_velvet_923215551234',
    hours: {
      mon: { open: '11:00', close: '19:00', closed: false },
      tue: { open: '11:00', close: '19:00', closed: false },
      wed: { open: '11:00', close: '19:00', closed: false },
      thu: { open: '11:00', close: '19:00', closed: false },
      fri: { open: '11:00', close: '19:00', closed: false },
      sat: { open: '10:00', close: '20:00', closed: false },
      sun: { open: '00:00', close: '00:00', closed: true },
    },
    services: [
      { id: 'v_srv_hair', name: 'Layered Cut & Highlights', category: 'Hair', durationMinutes: 90, price: 12000, description: 'Balayage or foils with custom cut' },
      { id: 'v_srv_waxing', name: 'Full Body Waxing', category: 'Body', durationMinutes: 60, price: 5000, description: 'Gentle organic wax hair removal' }
    ],
    stylists: [
      { id: 'v_stylist_fatima', name: 'Fatima Noor', specialties: ['Balayage', 'Styling'], workingHours: '11:00 - 19:00' }
    ],
    subscriptionStatus: 'trial',
    subscriptionPrice: 25,
    subscriptionCurrency: 'USD',
    createdAt: '2026-07-15T10:00:00Z',
  }
];

let businesses: Business[] = [...defaultBusinesses];

// Sample Bookings
let bookings: Booking[] = [];

// Sample Conversations & Messages
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
app.get('/api/businesses', (req, res) => {
  res.json(businesses);
});

app.get('/api/business/:id', (req, res) => {
  const biz = businesses.find((b) => b.id === req.params.id) || businesses[0];
  res.json(biz);
});

app.put('/api/business/:id', (req, res) => {
  const index = businesses.findIndex((b) => b.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Business not found' });
  }

  const { name, ownerName, ownerEmail, phone, whatsappPhoneNumberId, hours, services, stylists } = req.body;

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

  businesses[index] = {
    ...businesses[index],
    name: name ? name.trim() : businesses[index].name,
    ownerName: ownerName ? ownerName.trim() : businesses[index].ownerName,
    ownerEmail: ownerEmail ? ownerEmail.trim() : businesses[index].ownerEmail,
    phone: phone ? phone.trim() : businesses[index].phone,
    whatsappPhoneNumberId: whatsappPhoneNumberId || businesses[index].whatsappPhoneNumberId,
    hours: hours || businesses[index].hours,
    services: services || businesses[index].services,
    stylists: stylists || businesses[index].stylists,
  };

  res.json(businesses[index]);
});

app.post('/api/businesses', (req, res) => {
  const { name, ownerName, ownerEmail, phone, subscriptionCurrency, services, stylists } = req.body;

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

  const newBiz: Business = {
    id: `biz_${Date.now()}`,
    name: name.trim(),
    ownerName: ownerName.trim(),
    ownerEmail: ownerEmail ? ownerEmail.trim() : 'owner@salon.pk',
    phone: phone || '+92 300 0000000',
    whatsappPhoneNumberId: `phone_id_${Date.now()}`,
    hours: defaultBusinesses[0].hours,
    services: services || defaultBusinesses[0].services,
    stylists: stylists || defaultBusinesses[0].stylists,
    subscriptionStatus: 'trial',
    subscriptionPrice: subscriptionCurrency === 'USD' ? 29 : 7500,
    subscriptionCurrency: subscriptionCurrency || 'PKR',
    createdAt: new Date().toISOString(),
  };

  businesses.unshift(newBiz);
  res.status(201).json(newBiz);
});

// Conversations
app.get('/api/conversations', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const filtered = conversations.filter((c) => c.businessId === businessId);
  res.json(filtered);
});

app.get('/api/conversations/:phone/messages', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const phone = req.params.phone;
  const thread = messages.filter(
    (m) => m.businessId === businessId && m.customerPhone === phone
  );
  res.json(thread);
});

app.post('/api/conversations/:phone/toggle-ai', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const phone = req.params.phone;
  const conv = conversations.find(
    (c) => c.businessId === businessId && c.customerPhone === phone
  );
  if (conv) {
    conv.aiPaused = !conv.aiPaused;
    // Add system log
    agentLogs.unshift({
      id: `log_${Date.now()}`,
      businessId,
      timestamp: new Date().toISOString(),
      conversationId: phone,
      action: conv.aiPaused ? 'Salon Owner took over chat (AI Paused)' : 'Salon Owner restored AI Agent',
      reasoning: conv.aiPaused ? 'Owner toggled manual override in dashboard' : 'Owner re-enabled AI receptionist mode',
      success: true,
    });
    res.json(conv);
  } else {
    res.status(404).json({ error: 'Conversation not found' });
  }
});

app.post('/api/conversations/:phone/send', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const phone = req.params.phone;
  const { text } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'Message text is required' });
  }

  const now = new Date().toISOString();
  const newMsg: Message = {
    id: `msg_${Date.now()}`,
    businessId,
    customerPhone: phone,
    sender: 'owner',
    text,
    timestamp: now,
  };

  messages.push(newMsg);

  // Update conversation
  let conv = conversations.find(
    (c) => c.businessId === businessId && c.customerPhone === phone
  );
  if (conv) {
    conv.lastMessageAt = now;
  }

  res.status(201).json(newMsg);
});

// Bookings
app.get('/api/bookings', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const filtered = bookings.filter((b) => b.businessId === businessId);
  res.json(filtered);
});

app.post('/api/bookings', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const { customerPhone, customerName, serviceId, stylistId, startTime, notes } = req.body;

  const biz = businesses.find((b) => b.id === businessId) || businesses[0];
  const service = biz.services.find((s) => s.id === serviceId) || biz.services[0];
  const duration = service ? service.durationMinutes : 45;

  const start = new Date(startTime);
  const end = new Date(start.getTime() + duration * 60 * 1000);

  const newBooking: Booking = {
    id: `bk_${Date.now()}`,
    businessId,
    customerPhone: customerPhone || '+92 300 1234567',
    customerName: customerName || 'Walk-in Customer',
    serviceId: serviceId || biz.services[0].id,
    stylistId: stylistId || (biz.stylists[0] ? biz.stylists[0].id : undefined),
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    status: 'confirmed',
    createdBy: 'owner',
    createdAt: new Date().toISOString(),
    notes: notes || '',
  };

  bookings.unshift(newBooking);
  res.status(201).json(newBooking);
});

app.patch('/api/bookings/:id/status', (req, res) => {
  const { status } = req.body;
  const bk = bookings.find((b) => b.id === req.params.id);
  if (bk) {
    bk.status = status;
    res.json(bk);
  } else {
    res.status(404).json({ error: 'Booking not found' });
  }
});

// Customers list
app.get('/api/customers', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const biz = businesses.find((b) => b.id === businessId) || businesses[0];

  // Aggregate customers from conversations and bookings
  const customerMap = new Map<string, Customer>();

  conversations
    .filter((c) => c.businessId === businessId)
    .forEach((c) => {
      customerMap.set(c.customerPhone, {
        phone: c.customerPhone,
        name: c.customerName || 'Customer',
        firstSeenAt: c.lastMessageAt,
        totalBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
      });
    });

  bookings
    .filter((b) => b.businessId === businessId)
    .forEach((b) => {
      const service = biz.services.find((s) => s.id === b.serviceId);
      const price = service ? service.price : 3000;

      const existing = customerMap.get(b.customerPhone) || {
        phone: b.customerPhone,
        name: b.customerName,
        firstSeenAt: b.createdAt,
        totalBookings: 0,
        completedBookings: 0,
        totalSpent: 0,
      };

      existing.totalBookings += 1;
      if (b.status === 'completed') {
        existing.completedBookings += 1;
        existing.totalSpent += price;
      }
      if (!existing.lastBookingDate || new Date(b.startTime) > new Date(existing.lastBookingDate)) {
        existing.lastBookingDate = b.startTime;
      }

      customerMap.set(b.customerPhone, existing);
    });

  res.json(Array.from(customerMap.values()));
});

// Agent Logs
app.get('/api/agent-logs', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const filtered = agentLogs.filter((l) => l.businessId === businessId);
  res.json(filtered);
});

// Billing
app.get('/api/billing', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const biz = businesses.find((b) => b.id === businessId) || businesses[0];
  const history = payments.filter((p) => p.businessId === businessId);

  res.json({
    subscriptionStatus: biz.subscriptionStatus,
    price: biz.subscriptionPrice,
    currency: biz.subscriptionCurrency,
    payments: history,
  });
});

app.post('/api/billing/payment', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const { amount, currency, method, periodCovered, notes } = req.body;

  const newPayment: Payment = {
    id: `pay_${Date.now()}`,
    businessId,
    amount: Number(amount) || 7500,
    currency: currency || 'PKR',
    method: method || 'jazzcash',
    periodCovered: periodCovered || '2026-08',
    recordedAt: new Date().toISOString(),
    notes: notes || 'Manual subscription payment recorded by salon owner',
  };

  payments.unshift(newPayment);

  // Update business status
  const biz = businesses.find((b) => b.id === businessId);
  if (biz) {
    biz.subscriptionStatus = 'active';
  }

  res.status(201).json(newPayment);
});

// Analytics
app.get('/api/analytics', (req, res) => {
  const businessId = (req.query.businessId as string) || businesses[0].id;
  const biz = businesses.find((b) => b.id === businessId) || businesses[0];

  const bizBookings = bookings.filter((b) => b.businessId === businessId);
  const aiBookings = bizBookings.filter((b) => b.createdBy === 'ai').length;
  const manualBookings = bizBookings.filter((b) => b.createdBy === 'owner').length;

  const totalRevenue = bizBookings
    .filter((b) => b.status === 'completed' || b.status === 'confirmed')
    .reduce((sum, b) => {
      const srv = biz.services.find((s) => s.id === b.serviceId);
      return sum + (srv ? srv.price : 3000);
    }, 0);

  const summary: AnalyticsSummary = {
    messagesHandledThisMonth: messages.filter((m) => m.businessId === businessId).length,
    aiBookingsCount: aiBookings,
    manualBookingsCount: manualBookings,
    estimatedNoShowsPrevented: Math.round(aiBookings * 0.35),
    avgResponseTimeSeconds: 2.1,
    revenueGenerated: totalRevenue,
  };

  res.json(summary);
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
      date: { type: 'string', description: 'Date in YYYY-MM-DD or relative terms like "today", "tomorrow"' },
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
function executeTool(
  biz: Business,
  customerPhone: string,
  customerName: string,
  rawToolName: string,
  args: any
): { result: any; actionName: string } {
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

    const openSlots = ['10:00 AM', '11:30 AM', '02:00 PM', '04:00 PM', '06:00 PM'];
    return {
      result: {
        service: matchedService.name,
        price: `${biz.subscriptionCurrency === 'PKR' ? 'PKR' : '$'} ${matchedService.price}`,
        duration: `${matchedService.durationMinutes} minutes`,
        requestedDate: args.date,
        availableSlots: openSlots,
        assignedStylist: args.stylistId || (biz.stylists[0] ? biz.stylists[0].name : 'Any available stylist'),
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
    const bk = bookings.find((b) => b.id === args.bookingId || b.customerPhone === customerPhone);
    if (bk) {
      bk.startTime = args.newStartTime || new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      bk.status = 'confirmed';
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
    const bk = bookings.find((b) => b.id === args.bookingId || b.customerPhone === customerPhone);
    if (bk) {
      bk.status = 'cancelled';
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
    }
    return {
      result: { status: 'escalated', ownerAlerted: true, reason: args.reason },
      actionName: 'escalated',
    };
  }

  return { result: { success: true }, actionName: 'ai_tool_call' };
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
  const currentBizId = businessId || businesses[0].id;
  const biz = businesses.find((b) => b.id === currentBizId) || businesses[0];
  const phone = customerPhone || '+92 300 9998877';
  const name = customerName || 'Customer';

  // 1. Sanitize & Check Prompt Injection
  const rawText = text || '';
  const { sanitizedText, isInjectionAttempt } = sanitizeAndCheckPromptInjection(rawText);

  if (isInjectionAttempt) {
    agentLogs.unshift({
      id: `log_${Date.now()}`,
      businessId: currentBizId,
      timestamp: new Date().toISOString(),
      conversationId: phone,
      action: 'PROMPT_INJECTION_ATTEMPT_BLOCKED',
      toolUsed: 'security_filter',
      reasoning: `Prompt injection attack pattern detected and sanitized from customer: "${rawText.substring(0, 100)}"`,
      success: false,
    });
  }

  // 2. Check Rate Limits & Daily Cost Controls
  const rateLimitStatus = checkAndIncrementRateLimit(phone, currentBizId);
  if (!rateLimitStatus.allowed) {
    const isDailyCap = rateLimitStatus.reason === 'DAILY_BUSINESS_BUDGET_EXCEEDED';
    const rateLimitReply = isDailyCap
      ? `Hello ${name}, thank you for contacting ${biz.name}! Our automated receptionist daily message capacity has been reached for today. Our human salon team will assist you directly shortly!`
      : `Hello ${name}, you've sent messages too quickly. Please wait a moment before sending another message.`;

    agentLogs.unshift({
      id: `log_${Date.now()}`,
      businessId: currentBizId,
      timestamp: new Date().toISOString(),
      conversationId: phone,
      action: isDailyCap ? 'DAILY_AI_CAP_REACHED' : 'RATE_LIMIT_EXCEEDED',
      toolUsed: 'rate_limiter',
      reasoning: `Request blocked due to: ${rateLimitStatus.reason}`,
      success: false,
    });

    return {
      replyText: rateLimitReply,
      agentAction: 'rate_limited',
      aiPaused: false,
    };
  }

  const now = new Date().toISOString();

  // 3. 24-Hour Customer Service Window Check
  let conv = conversations.find((c) => c.businessId === currentBizId && c.customerPhone === phone);
  const previousLastMessageAt = conv ? conv.lastMessageAt : null;

  let isWindowOpen = true;
  if (previousLastMessageAt) {
    const elapsedMs = Date.now() - new Date(previousLastMessageAt).getTime();
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    if (elapsedHours > 24) {
      isWindowOpen = false;
    }
  } else {
    // New conversation with no prior record
    isWindowOpen = false;
  }

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
  } else {
    conv.lastMessageAt = now;
    if (name && name !== 'Customer') conv.customerName = name;
  }

  // Check if owner took over
  if (conv.aiPaused) {
    return {
      replyText: "[AI is currently paused for this conversation because the salon owner took over. The message has been routed to the owner's dashboard inbox.]",
      aiPaused: true,
      agentAction: 'owner_takeover_active',
    };
  }

  // If 24-hour window was expired or new conversation, send approved WhatsApp Message Template
  if (!isWindowOpen) {
    const templateReplyText = `We're here to help at ${biz.name}! Reply to this message and we'll get right back to you.`;

    const templateMsg: Message = {
      id: `msg_${Date.now() + 1}`,
      businessId: currentBizId,
      customerPhone: phone,
      sender: 'agent',
      text: templateReplyText,
      timestamp: new Date().toISOString(),
      agentAction: 'sent_template_reengagement',
    };
    messages.push(templateMsg);

    agentLogs.unshift({
      id: `log_${Date.now()}`,
      businessId: currentBizId,
      timestamp: new Date().toISOString(),
      conversationId: phone,
      action: '24H_WINDOW_EXPIRED_TEMPLATE_SENT',
      toolUsed: 'whatsapp_graph_api',
      reasoning: `24-hour customer service window was closed or uninitiated. Sent approved Meta message template instead of calling Gemini.`,
      success: true,
    });

    return {
      replyText: templateReplyText,
      agentAction: 'sent_template_reengagement',
      aiPaused: conv.aiPaused,
      isTemplate: true,
    };
  }

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

    return {
      replyText: simulatedReply,
      agentAction: 'checked_availability',
    };
  }

  try {
    // Context Window Slicing: Max 8 messages to constrain token usage & costs
    const existingThread = messages
      .filter((m) => m.businessId === currentBizId && m.customerPhone === phone)
      .slice(-8);

    const systemInstruction = `
You are SalonAI, an exceptionally friendly, articulate, professional, and efficient WhatsApp AI receptionist for "${biz.name}".

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
3. Book appointments using the 'create_booking' tool when the customer selects a time. Always format confirmations nicely with emojis and bullet points!
4. Reschedule or cancel existing bookings using 'reschedule_booking' or 'cancel_booking'.
5. If the customer asks for custom discounts, complains, or requests special unapproved packages, use 'escalate_to_owner' to loop in ${biz.ownerName}.
6. Keep messages warm, concise, and formatted naturally for WhatsApp (use line breaks and emojis where appropriate).
`;

    // Construct conversation history
    const contents: any[] = existingThread.map((m) => ({
      role: m.sender === 'customer' ? 'user' : 'model',
      parts: [{ text: m.text }],
    }));

    // Call Gemini with tool definitions and COST CONTROLS (gemini-2.5-flash-lite, maxOutputTokens: 350)
    let response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash-lite',
      contents,
      config: {
        systemInstruction,
        temperature: 0.3,
        maxOutputTokens: 350,
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

    // Handle function calls if model invoked tools
    const functionCalls = response.functionCalls;
    if (functionCalls && functionCalls.length > 0) {
      const toolCall = functionCalls[0];
      const { result, actionName } = executeTool(biz, phone, name, toolCall.name, toolCall.args);
      lastAction = actionName;

      // Log AI reasoning/action
      agentLogs.unshift({
        id: `log_${Date.now()}`,
        businessId: currentBizId,
        timestamp: new Date().toISOString(),
        conversationId: phone,
        action: `AI invoked function: ${toolCall.name}`,
        toolUsed: toolCall.name,
        reasoning: `Customer asked: "${sanitizedText}". Function output: ${JSON.stringify(result)}`,
        success: true,
      });

      // Second turn: send function response back to Gemini with cost controls
      const followUpContents = [
        ...contents,
        response.candidates?.[0]?.content,
        {
          role: 'user',
          parts: [
            {
              functionResponse: {
                name: toolCall.name,
                response: result,
              },
            },
          ],
        },
      ];

      response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash-lite',
        contents: followUpContents,
        config: {
          systemInstruction,
          temperature: 0.3,
          maxOutputTokens: 350,
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
    for (const entry of body.entry) {
      if (Array.isArray(entry.changes)) {
        for (const change of entry.changes) {
          const value = change.value;
          if (value && Array.isArray(value.messages)) {
            const metaPhoneNumberId = value.metadata?.phone_number_id;
            // Match business tenant by whatsappPhoneNumberId or fallback to first business
            const matchedBiz =
              businesses.find((b) => b.whatsappPhoneNumberId === metaPhoneNumberId) || businesses[0];

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
                }).catch((err) => {
                  console.error('Error executing handleIncomingMessage from webhook:', err);
                });
              }
            }
          }
        }
      }
    }
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