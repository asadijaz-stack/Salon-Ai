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
}

export const BillingScreen: React.FC<BillingScreenProps> = ({ business }) => {
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
    fetchBilling();
  }, [business.id]);

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
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
          <CreditCard className="w-6 h-6 text-rose-800" />
          <span>SalonAI Software Subscription & Billing</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Subscription status and manual payment ledger for {business.name}.
        </p>
      </div>

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
    </div>
  );
};
