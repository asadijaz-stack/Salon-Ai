import React, { useState } from 'react';
import { Sparkles, Building, Phone, Clock, Scissors, CheckCircle2, ArrowRight } from 'lucide-react';
import { Business } from '../types';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBusinessCreated: (newBiz: Business) => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onBusinessCreated,
}) => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [serviceName, setServiceName] = useState('Haircut & Blowdry');
  const [servicePrice, setServicePrice] = useState(3000);
  const [stylistName, setStylistName] = useState('Amina');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ownerName || !phone) return;

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          ownerName,
          ownerEmail,
          phone,
          subscriptionCurrency: currency,
          services: [
            {
              id: `srv_${Date.now()}`,
              name: serviceName || 'Standard Service',
              category: 'General',
              durationMinutes: 45,
              price: Number(servicePrice) || 3000,
              description: 'Primary salon service',
            },
          ],
          stylists: [
            {
              id: `st_${Date.now()}`,
              name: stylistName || 'Stylist',
              specialties: ['General Hair & Beauty'],
              workingHours: '10:00 - 19:00',
            },
          ],
        }),
      });

      if (res.ok) {
        const created = await res.json();
        onBusinessCreated(created);
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#EDEDEB] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 text-[#37352F]">
        <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          <span>New Salon Onboarding Wizard</span>
        </div>
        <h2 className="text-xl font-bold text-[#37352F] mb-6">
          Set Up Your SalonAI WhatsApp Desk
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {step === 1 && (
            <div className="space-y-3">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Salon / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Velvet & Co Hair Salon"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Owner Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sana Tariq"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Owner Email</label>
                  <input
                    type="email"
                    placeholder="sana@velvet.pk"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">WhatsApp Phone *</label>
                  <input
                    type="text"
                    required
                    placeholder="+92 300 1234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as any)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD (US Dollar)</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!name || !ownerName || !phone}
                  className="bg-[#37352F] hover:bg-black disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center space-x-2"
                >
                  <span>Next: Catalog Setup</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Primary Service Name</label>
                <input
                  type="text"
                  placeholder="e.g. Signature Haircut & Blowdry"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Service Price ({currency})</label>
                <input
                  type="number"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(Number(e.target.value))}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Lead Stylist Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mariam Ali"
                  value={stylistName}
                  onChange={(e) => setStylistName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-gray-500 hover:text-[#37352F]"
                >
                  ← Back
                </button>

                <button
                  type="submit"
                  className="bg-[#37352F] hover:bg-black text-white px-6 py-2.5 rounded-xl font-semibold shadow-xs"
                >
                  Activate Salon Tenant
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
