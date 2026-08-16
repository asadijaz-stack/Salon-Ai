/**
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
      const systemInstruction = `
You are SalonAI, an AI receptionist for "${biz.name}".
Services: ${JSON.stringify(biz.services)}
Hours: ${JSON.stringify(biz.hours)}
Use 'check_availability', 'create_booking', 'reschedule_booking', 'cancel_booking', or 'escalate_to_owner' as appropriate.
`;

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
      await fetch(`https://graph.facebook.com/v20.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
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
});
