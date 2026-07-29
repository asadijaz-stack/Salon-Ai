import React, { useState } from 'react';
import { Code2, Copy, Check, Terminal, ShieldCheck, Cpu, ExternalLink } from 'lucide-react';

export const CloudFunctionCodeExport: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const cloudFunctionCode = `/**
 * SalonAI — Production Node.js Cloud Function for Meta WhatsApp Webhook & Gemini Tool Calling
 * Deploy as Firebase / GCP Cloud Function (2nd Gen) or standalone Express service.
 */

const { onRequest } = require("firebase-functions/v2/https");
const { GoogleGenAI, Type } = require("@google/genai");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
});

exports.whatsappWebhook = onRequest(async (req, res) => {
  // 1. Meta Webhook Verification Handshake (GET)
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Forbidden");
  }

  // 2. Incoming WhatsApp Message Payload (POST)
  if (req.method === "POST") {
    // Acknowledge Meta immediately
    res.status(200).send("EVENT_RECEIVED");

    try {
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const message = change?.messages?.[0];

      if (!message || message.type !== "text") return;

      const customerPhone = message.from;
      const text = message.text.body;
      const phoneNumberId = change.metadata.phone_number_id;

      // Locate business tenant by phoneNumberId
      const bizQuery = await db.collection("businesses")
        .where("whatsappPhoneNumberId", "==", phoneNumberId)
        .limit(1).get();

      if (bizQuery.empty) return;
      const bizDoc = bizQuery.docs[0];
      const biz = bizDoc.data();
      const businessId = bizDoc.id;

      // Log incoming message to Firestore
      const convRef = db.collection("businesses").doc(businessId)
        .collection("conversations").doc(customerPhone);

      const convSnap = await convRef.get();
      if (convSnap.exists && convSnap.data().aiPaused) {
        console.log("AI Paused for customer takeover:", customerPhone);
        return;
      }

      await convRef.set({
        customerPhone,
        customerName: message.profile?.name || "Client",
        lastMessageAt: new Date().toISOString(),
        aiPaused: false,
      }, { merge: true });

      await convRef.collection("messages").add({
        sender: "customer",
        text,
        timestamp: new Date().toISOString(),
      });

      // 3. Gemini AI Tool Calling Reasoning
      const systemInstruction = \`
You are SalonAI, an AI receptionist for "\${biz.name}".
Services: \${JSON.stringify(biz.services)}
Hours: \${JSON.stringify(biz.hours)}
Use 'check_availability', 'create_booking', 'reschedule_booking', 'cancel_booking', or 'escalate_to_owner' as appropriate.
\`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: text,
        config: {
          systemInstruction,
          tools: [{
            functionDeclarations: [
              {
                name: "check_availability",
                description: "Check availability",
                parameters: { type: Type.OBJECT, properties: { serviceId: { type: Type.STRING }, date: { type: Type.STRING } }, required: ["serviceId", "date"] }
              },
              {
                name: "create_booking",
                description: "Book appointment",
                parameters: { type: Type.OBJECT, properties: { serviceId: { type: Type.STRING }, startTime: { type: Type.STRING } }, required: ["serviceId", "startTime"] }
              }
            ]
          }]
        }
      });

      const replyText = response.text || "Thank you for contacting us!";

      // 4. Send Reply via Meta Graph API
      await fetch(\`https://graph.facebook.com/v20.0/\${phoneNumberId}/messages\`, {
        method: "POST",
        headers: {
          "Authorization": \`Bearer \${process.env.WHATSAPP_ACCESS_TOKEN}\`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: customerPhone,
          type: "text",
          text: { body: replyText }
        })
      });

      // Log agent reply to Firestore stream
      await convRef.collection("messages").add({
        sender: "agent",
        text: replyText,
        timestamp: new Date().toISOString()
      });

    } catch (err) {
      console.error("Webhook Error:", err);
    }
  }
});`;

  const handleCopy = () => {
    navigator.clipboard.writeText(cloudFunctionCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <Code2 className="w-6 h-6 text-rose-800" />
            <span>Node.js Cloud Function Backend Script</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Backend logic for receiving Meta WhatsApp webhooks, executing Gemini function calling, and syncing Firestore streams in real time.
          </p>
        </div>

        <button
          onClick={handleCopy}
          className="bg-[#37352F] hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-xs"
        >
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? 'Copied Code!' : 'Copy Cloud Function Code'}</span>
        </button>
      </div>

      {/* Code Viewer */}
      <div className="bg-[#1E1E1E] border border-[#EDEDEB] rounded-2xl p-5 shadow-xs relative overflow-hidden">
        <div className="flex items-center justify-between text-xs text-gray-400 pb-3 border-b border-gray-800 mb-3 font-mono">
          <span className="flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-rose-400" />
            <span>functions/index.js</span>
          </span>
          <span className="text-gray-500">Target: Firebase Cloud Functions 2nd Gen / Node.js 20</span>
        </div>

        <pre className="text-xs text-emerald-300 font-mono overflow-x-auto p-2 leading-relaxed selection:bg-rose-900 selection:text-white">
          {cloudFunctionCode}
        </pre>
      </div>
    </div>
  );
};
