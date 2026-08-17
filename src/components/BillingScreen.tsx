import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Plus,
  DollarSign,
  Calendar,
  ShieldCheck,
  Building,
  Receipt,
} from 'lucide-react';
import { Business, Payment } from '../types';

interface BillingScreenProps {
  business: Business;
  allBusinesses?: Business[];
  isSuperAdmin?: boolean;
  onUpdateBusiness?: (business: Business) => void;
  onOpenOnboarding?: () => void;
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ 
  business, 
  allBusinesses = [],
  isSuperAdmin = false,
  onUpdateBusiness, 
  onOpenOnboarding 
}) => {
  const [billingInfo, setBillingInfo] = useState<{
    subscriptionStatus: string;
    price: number;
    currency: string;
    payments: Payment[];
  }>({
    subscriptionStatus: business.subscriptionStatus,
    price: business.subscriptionPrice,
    currency: business.subscriptionCurrency,
    payments: [],
  });

  const [amount, setAmount] = useState(business.subscriptionPrice.toString());
  const [method, setMethod] = useState<'bank_transfer' | 'jazzcash' | 'easypaisa' | 'other'>('jazzcash');
  const [periodCovered, setPeriodCovered] = useState('2026-08');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAccountControlOpen, setIsAccountControlOpen] = useState(false);
  const [controlTab, setControlTab] = useState<'active_trial' | 'cancelled'>('active_trial');

  const fetchBilling = async () => {
    try {
      const res = await fetch(`/api/billing?businessId=${business.id}`);
      const data = await res.json();
      setBillingInfo(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    setBillingInfo({
      subscriptionStatus: business.subscriptionStatus,
      price: business.subscriptionPrice,
      currency: business.subscriptionCurrency,
      payments: [],
    });
    setAmount(business.subscriptionPrice.toString());
    fetchBilling();
  }, [business]);

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/billing/payment?businessId=${business.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(amount),
          currency: business.subscriptionCurrency,
          method,
          periodCovered,
          notes,
        }),
      });

      if (res.ok) {
        setNotes('');
        fetchBilling();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      {/* Header */}
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <CreditCard className="w-6 h-6 text-rose-800" />
            <span>SalonAI Software Subscription & Billing</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Subscription status and manual payment ledger for {business.name}.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          {isSuperAdmin && (
            <button
              onClick={() => setIsAccountControlOpen(!isAccountControlOpen)}
              className="bg-white border border-[#EDEDEB] hover:bg-gray-50 text-[#37352F] px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
            >
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>{isAccountControlOpen ? 'Back to Billing' : 'Account Controls'}</span>
            </button>
          )}
          {onOpenOnboarding && (
            <button
              onClick={onOpenOnboarding}
              className="bg-[#37352F] hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center space-x-2 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add New Salon</span>
            </button>
          )}
        </div>
      </div>
      {isAccountControlOpen ? (
        <div className="bg-[#37352F] border border-[#2D2B26] rounded-2xl shadow-xs relative overflow-hidden">
          <div className="border-b border-white/10 p-4 flex space-x-4">

            <button
              onClick={() => setControlTab('active_trial')}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                controlTab === 'active_trial' ? 'bg-emerald-500/20 text-emerald-300' : 'text-gray-400 hover:text-white'
              }`}
            >
              Active / Trial
            </button>
            <button
              onClick={() => setControlTab('cancelled')}
              className={`text-sm font-semibold px-4 py-2 rounded-lg transition-colors ${
                controlTab === 'cancelled' ? 'bg-red-500/20 text-red-300' : 'text-gray-400 hover:text-white'
              }`}
            >
              Cancelled
            </button>
          </div>
          <div className="p-6 space-y-3 min-h-[400px]">
            {allBusinesses
              .filter((biz) => {
                if (controlTab === 'active_trial') return biz.subscriptionStatus === 'active' || biz.subscriptionStatus === 'trial';
                if (controlTab === 'cancelled') return biz.subscriptionStatus === 'cancelled';
                return false;
              })
              .map((biz) => (
                <div key={biz.id} className="bg-white/5 p-4 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-white text-sm flex items-center space-x-2">
                      <span>{biz.name}</span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          biz.subscriptionStatus === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300'

                            : biz.subscriptionStatus === 'trial'
                            ? 'bg-blue-500/20 text-blue-300'
                            : 'bg-red-500/20 text-red-300'
                        }`}
                      >
                        {biz.subscriptionStatus}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      Owner: {biz.ownerName} | Email: {biz.ownerEmail} | Phone: {biz.phone}
                    </div>

                  </div>
                  <div className="flex items-center space-x-3">
                    <label className="text-xs text-gray-400 font-medium">Set Status:</label>
                    <select
                      value={biz.subscriptionStatus}
                      onChange={async (e) => {
                        const newStatus = e.target.value;
                        const res = await fetch(`/api/business/${biz.id}`, {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ subscriptionStatus: newStatus }),
                        });
                        if (res.ok) {
                          const updatedBiz = await res.json();
                          if (onUpdateBusiness) onUpdateBusiness(updatedBiz);
                        }
                      }}
                      className="bg-black text-white text-xs p-2 rounded-lg border border-white/20 focus:outline-none focus:border-rose-400"
                    >

                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              ))}
              {allBusinesses.filter((biz) => {
                if (controlTab === 'active_trial') return biz.subscriptionStatus === 'active' || biz.subscriptionStatus === 'trial';
                if (controlTab === 'cancelled') return biz.subscriptionStatus === 'cancelled';
                return false;
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500 text-sm">
                  No salons found in this category.
                </div>
              )}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Subscription Summary Card & Payment Form (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Status Card */}
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                Current Subscription
              </span>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  billingInfo.subscriptionStatus === 'active'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                }`}
              >
                {billingInfo.subscriptionStatus}
              </span>
            </div>

            <div className="flex items-baseline space-x-2 mb-2">
              <span className="text-3xl font-bold text-[#37352F]">
                {billingInfo.currency === 'PKR' ? 'PKR' : '$'}{' '}
                {billingInfo.price.toLocaleString()}
              </span>
              <span className="text-xs text-gray-500">/ month</span>
            </div>

            <p className="text-xs text-gray-600">
              Includes unlimited 24/7 WhatsApp AI receptionist messages, full Gemini tool execution, and owner dashboard.
            </p>
          </div>



          {/* Record Payment Form */}
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs">
            <h3 className="text-sm font-bold text-[#37352F] mb-4 flex items-center space-x-2">
              <Receipt className="w-4 h-4 text-rose-800" />
              <span>Record Subscription Payment</span>
            </h3>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1">
                  Amount ({billingInfo.currency}) *
                </label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-500 mb-1">Payment Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as any)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  >
                    <option value="jazzcash">JazzCash</option>
                    <option value="easypaisa">EasyPaisa</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="other">Other / Cash</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Period Covered</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026-08"
                    value={periodCovered}
                    onChange={(e) => setPeriodCovered(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Transaction Ref / Notes</label>
                <input
                  type="text"
                  placeholder="e.g. JazzCash Ref #8849201"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#37352F] hover:bg-black disabled:opacity-50 text-white p-2.5 rounded-xl font-semibold shadow-xs transition mt-2 flex items-center justify-center space-x-2"
              >
                <Plus className="w-4 h-4" />
                <span>Log Received Payment</span>
              </button>
            </form>
          </div>
        </div>

        {/* Right: Payment Ledger History (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-[#37352F] mb-4 flex items-center justify-between">
            <span>Recorded Subscription Payments</span>
            <span className="text-xs text-gray-500 font-mono">
              {billingInfo.payments.length} Payments Logged
            </span>
          </h3>

          <div className="space-y-3">
            {billingInfo.payments.length === 0 ? (
              <div className="text-gray-400 text-xs text-center py-8">
                No payments logged yet for this salon.
              </div>
            ) : (
              billingInfo.payments.map((pay) => (
                <div
                  key={pay.id}
                  className="bg-[#F7F6F3] p-4 rounded-2xl border border-[#EDEDEB] flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-[#37352F] text-sm">
                        {pay.currency === 'PKR' ? 'PKR' : '$'} {pay.amount.toLocaleString()}
                      </span>
                      <span className="bg-white text-gray-600 font-mono px-2 py-0.5 rounded uppercase text-[10px] border border-[#EDEDEB]">
                        {pay.method.replace('_', ' ')}
                      </span>
                      <span className="text-rose-800 font-mono font-semibold">
                        Period: {pay.periodCovered}
                      </span>
                    </div>

                    <div className="text-gray-600 text-[11px]">{pay.notes}</div>

                    <div className="text-[10px] text-gray-400 font-mono">
                      Recorded on {new Date(pay.recordedAt).toLocaleString()}
                    </div>
                  </div>

                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
