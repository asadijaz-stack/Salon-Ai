import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Send,
  UserCheck,
  Bot,
  User,
  Clock,
  CheckCheck,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Phone,
  Calendar,
  AlertCircle,
  ShieldAlert,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react';
import { Business, Conversation, Message, Booking } from '../types';

interface LiveConversationsProps {
  business: Business;
}

export const LiveConversations: React.FC<LiveConversationsProps> = ({ business }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState('template_1');
  const [messages, setMessages] = useState<Message[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastPhoneRef = useRef<string | null>(null);

  // Smart auto-scroll: Snap to bottom on chat load, but don't force scroll if reading history
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const { scrollTop, scrollHeight, clientHeight } = container;
      
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
      const isNewConv = lastPhoneRef.current !== selectedPhone;

      if (isNewConv || isNearBottom) {
        container.scrollTop = scrollHeight;
      }
      
      if (messages.length > 0) {
        lastPhoneRef.current = selectedPhone;
      }
    }
  }, [messages, selectedPhone]);

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const res = await fetch(`/api/conversations?businessId=${business.id}`);
      const data = await res.json();
      setConversations(data);
      if (data.length > 0 && !selectedPhone) {
        setSelectedPhone(data[0].customerPhone);
      } else if (selectedPhone) {
        // Fetch new messages for the currently selected chat if they refresh the sidebar
        fetchMessages(selectedPhone);
      }
      handleRefreshBookings();
    } catch (e) {
      console.error(e);
    }
  };

  // Fetch messages for selected thread
  const fetchMessages = async (phone: string) => {
    try {
      const res = await fetch(`/api/conversations/messages?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      setMessages(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshChat = async () => {
    if (!selectedPhone) return;
    setLoading(true);
    try {
      const lastMsg = messages[messages.length - 1];
      const afterTimestamp = lastMsg ? lastMsg.timestamp : undefined;
      
      const res = await fetch(`/api/conversations/messages?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone, afterTimestamp }),
      });
      const newData = await res.json();
      
      if (newData.length > 0) {
        setMessages((prev) => {
          const map = new Map(prev.map(m => [m.id, m]));
          newData.forEach(m => map.set(m.id, m));
          return Array.from(map.values()).sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        });
      }
      handleRefreshBookings();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Fetch bookings
  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?businessId=${business.id}`);
      const data = await res.json();
      setBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshBookings = async () => {
    try {
      const lastBooking = [...bookings].sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime())[0];
      const afterTimestamp = lastBooking ? (lastBooking.updatedAt || lastBooking.createdAt) : undefined;
      const url = afterTimestamp ? `/api/bookings?businessId=${business.id}&afterTimestamp=${encodeURIComponent(afterTimestamp)}` : `/api/bookings?businessId=${business.id}`;
      
      const res = await fetch(url);
      const newData = await res.json();
      
      if (Array.isArray(newData) && newData.length > 0) {
        setBookings(prev => {
          const map = new Map(prev.map(b => [b.id, b]));
          newData.forEach(b => map.set(b.id, b));
          return Array.from(map.values()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        });
      }
    } catch (e) {
      console.error('Error refreshing bookings:', e);
    }
  };

  useEffect(() => {
    fetchConversations();
    fetchBookings();
  }, [business.id]);

  useEffect(() => {
    if (selectedPhone) {
      fetchMessages(selectedPhone);
    }
  }, [selectedPhone, business.id]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchConversations();
      if (selectedPhone) {
        handleRefreshChat();
      }
    }, 30000);
    return () => clearInterval(intervalId);
  }, [business.id, selectedPhone, messages]);

  const activeConv = conversations.find((c) => c.customerPhone === selectedPhone);

  const handleToggleAI = async () => {
    if (!selectedPhone) return;
    try {
      const res = await fetch(`/api/conversations/toggle-ai?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: selectedPhone }),
      });
      const updated = await res.json();
      setConversations((prev) =>
        prev.map((c) => (c.customerPhone === selectedPhone ? updated : c))
      );
      fetchMessages(selectedPhone);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedPhone) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/send?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: inputText, phone: selectedPhone }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, data]);
        setInputText('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSendTemplate = async () => {
    if (!activeConv || !selectedTemplate) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/conversations/send?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isTemplate: true, templateId: selectedTemplate, phone: activeConv.customerPhone }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, data]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredConvs = conversations.filter(
    (c) =>
      (c.customerName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.customerPhone || '').includes(searchQuery)
  );

  const customerBookings = bookings.filter((b) => b.customerPhone === selectedPhone);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col lg:h-[calc(100vh-70px)]">
      <div className="bg-white border border-[#EDEDEB] rounded-2xl shadow-xs overflow-hidden flex-1 grid grid-cols-1 lg:grid-cols-12 text-[#37352F] min-h-[600px] lg:min-h-0">
        {/* Left Panel: Conversation List (4 cols) */}
        <div className="lg:col-span-4 border-r border-[#EDEDEB] flex flex-col bg-[#F7F6F3] h-full overflow-hidden">
          <div className="p-4 border-b border-[#EDEDEB] bg-[#F7F6F3]">
            <h2 className="text-base font-bold text-[#37352F] flex items-center justify-between">
              <span>WhatsApp Inbox</span>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={fetchConversations}
                  className="p-1 hover:bg-[#EBEAE4] rounded transition text-gray-500 hover:text-[#37352F]"
                  title="Refresh Conversations"
                >
                  <RefreshCcw className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs bg-[#EBEAE4] text-[#37352F] font-mono px-2 py-0.5 rounded border border-[#EDEDEB]">
                  {conversations.length} Active
                </span>
              </div>
            </h2>
            <div className="mt-3 relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search phone or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-[#37352F] text-sm pl-9 pr-4 py-2 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 transition"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#EDEDEB]">
            {filteredConvs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No conversations found.
              </div>
            ) : (
              filteredConvs.map((conv) => {
                const isSelected = conv.customerPhone === selectedPhone;
                return (
                  <button
                    key={conv.customerPhone}
                    onClick={() => setSelectedPhone(conv.customerPhone)}
                    className={`w-full text-left p-4 transition-all flex items-start space-x-3 hover:bg-[#F0EFEA] ${
                      isSelected ? 'bg-white border-l-4 border-rose-800 shadow-xs' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-800 font-bold text-sm shrink-0">
                      {conv.customerName ? conv.customerName.charAt(0) : 'C'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-[#37352F] truncate">
                          {conv.customerName || conv.customerPhone}
                        </span>
                        <span className="text-[10px] text-gray-500">
                          {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 truncate mt-0.5 font-mono">
                        {conv.customerPhone}
                      </div>
                      <div className="mt-2 flex items-center space-x-2">
                        {conv.aiPaused ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200">
                            <User className="w-3 h-3 text-amber-600" />
                            <span>Owner Control</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 text-[10px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                            <Bot className="w-3 h-3 text-emerald-600" />
                            <span>AI Responding</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Middle Panel: Chat Message Thread (5 cols) */}
        <div className="lg:col-span-5 flex flex-col bg-[#FCFCFB] relative border-r border-[#EDEDEB] h-full overflow-hidden">
          {/* Chat Header */}
          {activeConv ? (
            <>
              {(() => {
                const isWindowClosed = (Date.now() - new Date(activeConv.lastMessageAt).getTime()) > 24 * 60 * 60 * 1000;
                return (
                  <>
                    <div className="p-3.5 bg-white border-b border-[#EDEDEB] flex items-center justify-between z-10">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-800 font-bold text-sm">
                    {activeConv.customerName.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[#37352F] flex items-center space-x-2">
                      <span>{activeConv.customerName}</span>
                      <span className="text-xs text-gray-500 font-mono font-normal">
                        ({activeConv.customerPhone})
                      </span>
                    </h3>
                    <div className="text-[11px] text-emerald-700 flex items-center space-x-1 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      <span>WhatsApp Cloud API Connected</span>
                    </div>
                  </div>
                </div>

                {/* Refresh and AI Toggle */}
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleRefreshChat}
                    disabled={loading}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition text-gray-500 hover:text-[#37352F] border border-transparent hover:border-gray-200"
                    title="Refresh Chat (Fetch New)"
                  >
                    <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={handleToggleAI}
                    className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      activeConv.aiPaused
                        ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                    }`}
                  >
                    {activeConv.aiPaused ? (
                      <>
                        <ToggleLeft className="w-4 h-4 text-amber-600" />
                        <span>Takeover Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleRight className="w-4 h-4 text-emerald-600" />
                        <span>AI Autopilot</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Takeover Warning Banner */}
              {activeConv.aiPaused && (
                <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-2 flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Human Owner Mode:</strong> AI agent paused. You are now replying directly to the customer.
                  </span>
                </div>
              )}

              {/* Message Thread Area */}
              <div ref={scrollContainerRef} className="flex-1 p-4 overflow-y-auto space-y-3 bg-[#FCFCFB]">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-12">
                    No messages in this conversation yet.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isCustomer = msg.sender === 'customer';
                    const isAgent = msg.sender === 'agent';
                    const isOwner = msg.sender === 'owner';

                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${
                          isCustomer ? 'items-start' : 'items-end'
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl p-3.5 shadow-xs relative text-sm ${
                            isCustomer
                              ? 'bg-white text-[#37352F] rounded-tl-none border border-[#EDEDEB]'
                              : isAgent
                              ? 'bg-[#F0EFEA] text-[#37352F] rounded-tr-none border border-[#EDEDEB]'
                              : 'bg-rose-50 text-rose-950 rounded-tr-none border border-rose-200'
                          }`}
                        >
                          {/* Sender Pill */}
                          <div className="flex items-center justify-between space-x-2 text-[10px] font-semibold mb-1 opacity-90">
                            <span className="flex items-center space-x-1">
                              {isAgent ? (
                                <>
                                  <Bot className="w-3 h-3 text-rose-800" />
                                  <span className="text-rose-900">SalonAI Receptionist</span>
                                </>
                              ) : isOwner ? (
                                <>
                                  <User className="w-3 h-3 text-rose-800" />
                                  <span className="text-rose-900">Salon Owner</span>
                                </>
                              ) : (
                                <span className="text-gray-600">{activeConv.customerName}</span>
                              )}
                            </span>

                            {msg.agentAction && (
                              <span className="bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[9px] font-mono border border-rose-200">
                                tool: {msg.agentAction}
                              </span>
                            )}
                          </div>

                          <div className="whitespace-pre-wrap leading-relaxed">{msg.text}</div>

                          <div className="mt-1 text-[10px] text-right text-gray-400 flex items-center justify-end space-x-1">
                            <span>
                              {new Date(msg.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            {!isCustomer && <CheckCheck className="w-3 h-3 text-emerald-600 inline" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Input Bar */}
              {isWindowClosed ? (
                <div className="p-3 bg-white border-t border-[#EDEDEB] flex flex-col space-y-2">
                  <div className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200 flex items-start space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>24-Hour Window Closed.</strong> Meta policy requires you to send a pre-approved template to re-engage this customer before you can type custom messages.
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="flex-1 bg-[#FCFCFB] text-[#37352F] text-sm px-3 py-2 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 transition"
                    >
                      <option value="template_1">"We're here to help! Reply to this message to continue..."</option>
                      <option value="template_2">"Hi! Just a friendly reminder about your upcoming appointment."</option>
                      <option value="template_3">"We miss you! Let us know if you'd like to book another visit."</option>
                    </select>
                    <button
                      onClick={handleSendTemplate}
                      disabled={loading}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center space-x-1 shrink-0"
                    >
                      <span>Send Template</span>
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-[#EDEDEB] flex items-center space-x-2">
                  <input
                    type="text"
                    placeholder={
                      activeConv.aiPaused
                        ? 'Type manual reply as Salon Owner...'
                        : 'Type override reply (will send as Owner)...'
                    }
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="flex-1 bg-[#FCFCFB] text-[#37352F] text-sm px-4 py-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 transition"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputText.trim()}
                    className="bg-[#37352F] hover:bg-black disabled:opacity-50 text-white p-2.5 rounded-xl transition shadow-xs flex items-center justify-center shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              )}
                  </>
                );
              })()}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <Bot className="w-12 h-12 text-gray-300 mb-3" />
              <p>Select a conversation on the left to view WhatsApp chat history.</p>
            </div>
          )}
        </div>

        {/* Right Panel: Customer Profile & Quick Booking Details (3 cols) */}
        <div className="lg:col-span-3 p-4 bg-[#F7F6F3] flex flex-col justify-between border-t lg:border-t-0 border-[#EDEDEB] h-full overflow-y-auto">
          {activeConv ? (
            <div>
              <div className="text-center pb-4 border-b border-[#EDEDEB]">
                <div className="w-16 h-16 rounded-full bg-rose-100 border border-rose-200 mx-auto flex items-center justify-center text-rose-800 font-bold text-xl shadow-xs mb-2">
                  {activeConv.customerName.charAt(0)}
                </div>
                <h3 className="text-base font-bold text-[#37352F]">{activeConv.customerName}</h3>
                <div className="text-xs text-gray-500 font-mono mt-0.5">{activeConv.customerPhone}</div>
              </div>

              {/* Customer Stats */}
              <div className="py-4 space-y-3 border-b border-[#EDEDEB] text-xs">
                <div className="flex items-center justify-between text-[#37352F]">
                  <span className="text-gray-500">Total Bookings:</span>
                  <span className="font-bold text-[#37352F]">{customerBookings.length}</span>
                </div>
                <div className="flex items-center justify-between text-[#37352F]">
                  <span className="text-gray-500">AI Managed:</span>
                  <span className="font-semibold text-rose-800">
                    {customerBookings.filter((b) => b.createdBy === 'ai').length}
                  </span>
                </div>
              </div>

              {/* Past/Upcoming Bookings */}
              <div className="py-4">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>Customer Appointments</span>
                  <Calendar className="w-3.5 h-3.5 text-gray-400" />
                </h4>

                {customerBookings.length === 0 ? (
                  <div className="text-xs text-gray-400 py-2 italic">
                    No bookings logged yet for this customer.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                    {customerBookings.map((bk) => {
                      const service = business.services.find((s) => s.id === bk.serviceId);
                      return (
                        <div
                          key={bk.id}
                          className="bg-white p-2.5 rounded-xl border border-[#EDEDEB] text-xs space-y-1 shadow-xs"
                        >
                          <div className="flex items-center justify-between font-semibold text-[#37352F]">
                            <span>{service ? service.name : 'Salon Service'}</span>
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] ${
                                bk.status === 'confirmed'
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : bk.status === 'completed'
                                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                  : 'bg-red-50 text-red-800 border border-red-200'
                              }`}
                            >
                              {bk.status}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500">
                            📅 {new Date(bk.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Created by: <span className="text-gray-700 capitalize">{bk.createdBy}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-12">
              Select a chat thread to inspect customer history.
            </div>
          )}

          <div className="pt-4 border-t border-[#EDEDEB] text-[11px] text-gray-400 text-center">
            🔒 WhatsApp Cloud API (Graph v20.0) • End-to-End Encrypted
          </div>
        </div>
      </div>
    </div>
  );
};
