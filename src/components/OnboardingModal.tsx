import React, { useState } from 'react';
import { Sparkles, Building, Phone, Clock, Scissors, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { Business } from '../types';
import { auth } from '../lib/firebase';
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
  const [whatsappPhoneNumberId, setWhatsappPhoneNumberId] = useState('');
  const [password, setPassword] = useState('');
  const [currency, setCurrency] = useState<'PKR' | 'USD'>('PKR');
  const [serviceName, setServiceName] = useState('Haircut & Blowdry');
  const [servicePrice, setServicePrice] = useState(3000);
  const [stylistName, setStylistName] = useState('Amina');
  const [subscriptionType, setSubscriptionType] = useState<'trial' | 'paid'>('trial');
  const [paymentProof, setPaymentProof] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !ownerName || !phone || !ownerEmail || !password || !whatsappPhoneNumberId) {
      setError('Please fill in all required fields.');
      return;
    }

    // Step 2 Validation
    if (subscriptionType === 'paid' && !paymentProof.trim()) {
      setError('Transaction ID / Payment Proof is required for Active Plan requests.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let token: string | undefined = undefined;

      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      // 2. Register Business in Backend
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          name,
          ownerName,
          ownerEmail,
          phone,
          password, // Send password to backend
          whatsappPhoneNumberId,
          subscriptionCurrency: currency,
          requestedPlan: subscriptionType,
          paymentProof: paymentProof,
          status: subscriptionType === 'trial' ? 'trial' : 'active',
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

        setStep(3);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create business');
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'An error occurred during onboarding.');
    } finally {
      setLoading(false);
    }
  };

  const handleNextStep = () => {
    if (!name.trim()) return setError('Salon Name is required.');
    if (!ownerName.trim()) return setError('Owner Name is required.');
    if (!ownerEmail.trim() || !/^\S+@\S+\.\S+$/.test(ownerEmail)) return setError('Valid Owner Email is required.');
    if (!phone.trim()) return setError('WhatsApp Phone is required.');
    if (!whatsappPhoneNumberId.trim()) return setError('Meta Phone Number ID is required.');
    if (!password || password.length < 6) return setError('Dashboard Password must be at least 6 characters.');
    
    setError('');
    setStep(2);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white border border-[#EDEDEB] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 text-[#37352F] relative">
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-rose-800 font-bold text-xs uppercase tracking-wider mb-2">
          <Sparkles className="w-4 h-4" />
          <span>New Salon Onboarding Wizard</span>
        </div>
        {step !== 3 && (
          <h2 className="text-xl font-bold text-[#37352F] mb-6">
            Set Up Your SalonAI WhatsApp Desk
          </h2>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="text-xs font-medium leading-relaxed">{error}</span>
            </div>
          )}

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Meta Phone Number ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 1029384756"
                    value={whatsappPhoneNumberId}
                    onChange={(e) => setWhatsappPhoneNumberId(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono text-[10px]"
                  />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Dashboard Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              {error && <div className="text-red-500 font-medium mt-2">{error}</div>}

              <div className="pt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="bg-[#37352F] hover:bg-black text-white px-5 py-2.5 rounded-xl font-semibold flex items-center space-x-2 transition-colors"
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

              <div className="pt-2 border-t border-[#EDEDEB]">
                <label className="block text-gray-600 font-medium mb-3">
                  {isAdminMode ? 'Activate Account As:' : 'Subscription Request'}
                </label>
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="subType" 
                      value="trial" 
                      checked={subscriptionType === 'trial'}
                      onChange={() => setSubscriptionType('trial')}
                      className="text-rose-800 focus:ring-rose-800" 
                    />
                    <span>{isAdminMode ? '14-Day Free Trial Account' : 'Apply for 14-Day Free Trial'}</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="subType" 
                      value="paid" 
                      checked={subscriptionType === 'paid'}
                      onChange={() => setSubscriptionType('paid')}
                      className="text-rose-800 focus:ring-rose-800" 
                    />
                    <span>{isAdminMode ? 'Active Subscription Account' : 'Submit Payment Proof for Active Plan'}</span>
                  </label>
                </div>
              </div>

              {subscriptionType === 'paid' && (
                <div className="animate-in fade-in slide-in-from-top-2">
                  <label className="block text-gray-600 font-medium mb-1">Transaction ID / Payment Proof</label>
                  <input
                    type="text"
                    placeholder="e.g. TID-987654321"
                    value={paymentProof}
                    onChange={(e) => setPaymentProof(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  />
                </div>
              )}

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
                  disabled={loading}
                  className="bg-[#37352F] hover:bg-black text-white px-6 py-2.5 rounded-xl font-semibold shadow-xs disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Registration'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="text-center space-y-4 py-6">
               <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
                 <CheckCircle2 className="w-8 h-8 text-emerald-600" />
               </div>
               <h3 className="text-xl font-bold text-[#37352F]">
                 {isAdminMode ? 'Account Created Successfully!' : 'Application Submitted!'}
               </h3>
               <p className="text-gray-600 text-sm leading-relaxed max-w-sm mx-auto">
                 {isAdminMode 
                   ? 'The salon account has been created and is immediately active based on your selection.' 
                   : 'You will be hearing from us through an email soon. Please check your spam folder too (mail+example@gmail.com etc).'}
               </p>
               <button
                 type="button"
                 onClick={onClose}
                 className="mt-6 w-full bg-[#37352F] hover:bg-black text-white px-6 py-3.5 rounded-xl font-semibold shadow-xs transition-colors"
               >
                 {isAdminMode ? 'Close' : 'Close & Return to Login'}
               </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
