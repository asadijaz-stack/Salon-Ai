import React, { useState } from 'react';
import {
  Send,
  Sparkles,
  Bot,
  User,
  CheckCheck,
  Zap,
  HelpCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { Business } from '../types';

interface WhatsAppTesterProps {
  business: Business;
}

export const WhatsAppTester: React.FC<WhatsAppTesterProps> = ({ business }) => {
  const [customerPhone, setCustomerPhone] = useState('+92 300 7771234');
  const [customerName, setCustomerName] = useState('Anum Zahra');
  const [inputMessage, setInputMessage] = useState('');
  const [chatThread, setChatThread] = useState<
    Array<{ sender: 'customer' | 'agent'; text: string; time: string; action?: string }>
  >([
    {
      sender: 'agent',
      text: `Hello! 👋 Welcome to ${business.name}. I am SalonAI, your 24/7 WhatsApp AI receptionist.\n\nHow can I help you today? You can ask about our services, pricing, opening hours, or book an appointment!`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [lastReasoning, setLastReasoning] = useState<string | null>(null);

  const samplePrompts = [
    'Hi! What services do you offer and how much is a Glow HydraFacial?',
    'Can I book a Signature Haircut today at 2:00 PM?',
    'Do you have any open slots with Sarah tomorrow?',
    'I need a 50% discount for a bridal group of 6 people.',
  ];

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || inputMessage;
    if (!text.trim() || loading) return;

    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append customer message
    setChatThread((prev) => [
      ...prev,
      { sender: 'customer', text, time: timeStr },
    ]);
    if (!textToSend) setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/whatsapp/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          customerPhone,
          customerName,
          text,
        }),
      });

      const data = await res.json();

      setChatThread((prev) => [
        ...prev,
        {
          sender: 'agent',
          text: data.replyText,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          action: data.agentAction,
        },
      ]);

      if (data.agentAction) {
        setLastReasoning(`Executed tool action [${data.agentAction}] via Gemini Function Calling`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setChatThread([
      {
        sender: 'agent',
        text: `Hello! 👋 Welcome to ${business.name}. I am SalonAI, your 24/7 WhatsApp AI receptionist.\n\nHow can I help you today?`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setLastReasoning(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      {/* Header Banner */}
      <div className="bg-[#F7F6F3] border border-[#EDEDEB] rounded-2xl p-6 shadow-xs mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs uppercase tracking-wider mb-1">
            <Zap className="w-4 h-4" />
            <span>Interactive AI Test Bench</span>
          </div>
          <h2 className="text-xl font-bold text-[#37352F]">
            Test {business.name}'s WhatsApp AI Receptionist
          </h2>
          <p className="text-sm text-gray-600 mt-1 max-w-2xl">
            Simulate incoming WhatsApp messages from salon customers. Watch how Gemini's server-side tool calling checks real-time availability, creates bookings, and updates the owner dashboard live.
          </p>
        </div>

        <button
          onClick={handleResetChat}
          className="flex items-center space-x-2 bg-white hover:bg-[#F0EFEA] text-[#37352F] px-4 py-2 rounded-xl border border-[#EDEDEB] text-xs font-semibold transition shadow-xs"
        >
          <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
          <span>Reset Test Chat</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Phone Simulator Frame (7 cols) */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-md bg-white rounded-[40px] p-3 border-2 border-[#EDEDEB] shadow-lg relative">
            {/* Phone Notch */}
            <div className="w-32 h-4 bg-[#F7F6F3] rounded-b-xl mx-auto mb-2 flex items-center justify-center border-b border-[#EDEDEB]">
              <div className="w-3 h-3 rounded-full bg-gray-300" />
            </div>

            {/* WhatsApp App Interface */}
            <div className="bg-[#FCFCFB] rounded-[30px] overflow-hidden flex flex-col h-[580px] border border-[#EDEDEB]">
              {/* WhatsApp App Header */}
              <div className="bg-[#F7F6F3] text-[#37352F] p-3.5 flex items-center justify-between border-b border-[#EDEDEB] shadow-xs">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-800 font-bold text-sm">
                    S
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[#37352F]">{business.name}</h3>
                    <div className="text-[10px] text-emerald-700 flex items-center space-x-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Official WhatsApp Business</span>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-200 font-semibold">
                  AI Active
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#FCFCFB]">
                {chatThread.map((msg, idx) => {
                  const isCust = msg.sender === 'customer';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isCust ? 'items-end' : 'items-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed shadow-xs relative ${
                          isCust
                            ? 'bg-rose-800 text-white rounded-tr-none'
                            : 'bg-white text-[#37352F] rounded-tl-none border border-[#EDEDEB]'
                        }`}
                      >
                        {!isCust && (
                          <div className="text-[10px] font-bold text-rose-800 mb-1 flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <Sparkles className="w-3 h-3 text-rose-800" />
                              <span>SalonAI Agent</span>
                            </span>
                            {msg.action && (
                              <span className="bg-rose-50 text-rose-800 px-1.5 py-0.2 rounded font-mono text-[9px] border border-rose-200">
                                {msg.action}
                              </span>
                            )}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap">{msg.text}</div>
                        <div className={`mt-1 text-[9px] text-right flex items-center justify-end space-x-1 ${isCust ? 'text-rose-200' : 'text-gray-400'}`}>
                          <span>{msg.time}</span>
                          {isCust && <CheckCheck className="w-3 h-3 text-rose-200" />}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {loading && (
                  <div className="flex items-center space-x-2 bg-white text-gray-700 p-3 rounded-2xl rounded-tl-none text-xs w-48 border border-[#EDEDEB] shadow-xs">
                    <Sparkles className="w-3.5 h-3.5 text-rose-800 animate-spin" />
                    <span>Gemini AI is reasoning...</span>
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="p-2.5 bg-[#F7F6F3] border-t border-[#EDEDEB] flex items-center space-x-2">
                <input
                  type="text"
                  placeholder="Message as salon customer..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  className="flex-1 bg-white text-[#37352F] text-xs px-3.5 py-2.5 rounded-full border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={loading || !inputMessage.trim()}
                  className="bg-[#37352F] hover:bg-black disabled:opacity-50 text-white p-2.5 rounded-full transition shadow-xs shrink-0"
                >
                  <Send className="w-4 h-4 font-bold" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls & One-Tap Prompt Presets (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {/* Simulated Customer Settings */}
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#37352F] mb-3 flex items-center space-x-2">
              <User className="w-4 h-4 text-rose-800" />
              <span>Customer Identity Settings</span>
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1 font-medium">Customer Name</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>
              <div>
                <label className="block text-gray-500 mb-1 font-medium">WhatsApp Number</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Quick Preset Test Prompts */}
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#37352F] mb-2 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-600" />
              <span>One-Tap Test Scenarios</span>
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Click any scenario below to automatically send the message to the AI agent:
            </p>
            <div className="space-y-2">
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="w-full text-left p-2.5 rounded-xl bg-[#F7F6F3] hover:bg-[#F0EFEA] border border-[#EDEDEB] text-xs text-[#37352F] transition hover:border-rose-300 flex items-center justify-between group"
                >
                  <span className="truncate pr-2">"{prompt}"</span>
                  <span className="text-[10px] text-rose-800 font-semibold group-hover:underline shrink-0">Send →</span>
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Agent Reasoning Box */}
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-[#37352F] mb-2 flex items-center space-x-2">
              <Bot className="w-4 h-4 text-rose-800" />
              <span>Agent Tool Telemetry</span>
            </h3>
            <div className="bg-[#F7F6F3] p-3 rounded-xl border border-[#EDEDEB] text-xs text-[#37352F] font-mono leading-relaxed min-h-[80px]">
              {lastReasoning ? (
                <div className="text-rose-900 font-medium">{lastReasoning}</div>
              ) : (
                <div className="text-gray-400 italic">
                  Send a message to see Gemini function call telemetry...
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
