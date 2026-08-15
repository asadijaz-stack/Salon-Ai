export interface BusinessHours {
  open: string; // e.g. "10:00"
  close: string; // e.g. "20:00"
  closed: boolean;
}

export interface WeeklyHours {
  mon: BusinessHours;
  tue: BusinessHours;
  wed: BusinessHours;
  thu: BusinessHours;
  fri: BusinessHours;
  sat: BusinessHours;
  sun: BusinessHours;
}

export interface Service {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  price: number;
  description: string;
}

export interface Stylist {
  id: string;
  name: string;
  specialties: string[];
  workingHours: string; // e.g. "10:00 - 18:00"
  avatar?: string;
}

export interface Business {
  id: string;
  name: string;
  ownerName: string;
  ownerUid: string;
  ownerEmail: string;
  phone: string;
  whatsappPhoneNumberId: string;
  hours: WeeklyHours;
  services: Service[];
  stylists: Stylist[];
  subscriptionStatus: 'pending' | 'trial' | 'active' | 'overdue' | 'cancelled';
  subscriptionPrice: number;
  subscriptionCurrency: 'PKR' | 'USD';
  createdAt: string;
  requestedPlan?: 'trial' | 'paid';
  paymentProof?: string;
}

export type BookingStatus = 'confirmed' | 'completed' | 'cancelled' | 'no_show';

export interface Booking {
  id: string;
  businessId: string;
  customerPhone: string;
  customerName: string;
  serviceId: string;
  stylistId?: string;
  startTime: string; // ISO string e.g. "2026-07-29T14:00:00Z"
  endTime: string;   // ISO string e.g. "2026-07-29T15:00:00Z"
  status: BookingStatus;
  createdBy: 'ai' | 'owner';
  createdAt: string;
  notes?: string;
}

export interface Conversation {
  id: string; // phone number or UUID
  businessId: string;
  customerPhone: string;
  customerName: string;
  lastMessageAt: string;
  aiPaused: boolean;
  unreadCount: number;
}

export interface Message {
  id: string;
  businessId: string;
  customerPhone: string;
  sender: 'customer' | 'agent' | 'owner';
  text: string;
  timestamp: string;
  agentAction?: string; // e.g. "checked_availability", "created_booking", "rescheduled_booking", "cancelled_booking", "escalated"
}

export interface Payment {
  id: string;
  businessId: string;
  amount: number;
  currency: 'PKR' | 'USD';
  method: 'bank_transfer' | 'jazzcash' | 'easypaisa' | 'other';
  periodCovered: string; // e.g. "2026-08"
  recordedAt: string;
  notes?: string;
}

export interface AgentLog {
  id: string;
  businessId: string;
  timestamp: string;
  conversationId: string;
  action: string;
  toolUsed?: string;
  reasoning: string;
  success: boolean;
}

export interface Customer {
  phone: string;
  name: string;
  firstSeenAt: string;
  totalBookings: number;
  completedBookings: number;
  totalSpent: number;
  lastBookingDate?: string;
}

export interface AnalyticsSummary {
  messagesHandledThisMonth: number;
  aiBookingsCount: number;
  manualBookingsCount: number;
  estimatedNoShowsPrevented: number;
  avgResponseTimeSeconds: number;
  revenueGenerated: number;
}
