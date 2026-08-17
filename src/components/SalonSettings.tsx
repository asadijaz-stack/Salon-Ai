import React, { useState, useEffect } from 'react';
import {
  Settings,
  Clock,
  Scissors,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  DollarSign,
  Phone,
  User,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Business, Service, Stylist, WeeklyHours, BusinessHours } from '../types';

interface SalonSettingsProps {
  business: Business;
  onUpdateBusiness: (updated: Business) => void;
  isSuperAdmin?: boolean;
}

export const SalonSettings: React.FC<SalonSettingsProps> = ({
  business,
  onUpdateBusiness,
  isSuperAdmin = false,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'info' | 'hours' | 'services' | 'stylists'>('services');

  // Local state for editable business info
  const [name, setName] = useState(business.name);
  const [ownerName, setOwnerName] = useState(business.ownerName);
  const [ownerEmail, setOwnerEmail] = useState(business.ownerEmail);
  const [phone, setPhone] = useState(business.phone);
  const [whatsappPhoneId, setWhatsappPhoneId] = useState(business.whatsappPhoneNumberId);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Local state for services
  const [services, setServices] = useState<Service[]>(business.services);
  const [newServiceName, setNewServiceName] = useState('');
  const [newServiceCategory, setNewServiceCategory] = useState('Hair');
  const [newServiceDuration, setNewServiceDuration] = useState(45);
  const [newServicePrice, setNewServicePrice] = useState(3500);
  const [newServiceDesc, setNewServiceDesc] = useState('');

  // Local state for stylists
  const [stylists, setStylists] = useState<Stylist[]>(business.stylists);
  const [newStylistName, setNewStylistName] = useState('');
  const [newStylistSpecialties, setNewStylistSpecialties] = useState('');
  const [newStylistHours, setNewStylistHours] = useState('10:00 - 18:00');

  // Hours state
  const [hours, setHours] = useState<WeeklyHours>(business.hours);

  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setName(business.name);
    setOwnerName(business.ownerName);
    setOwnerEmail(business.ownerEmail);
    setPhone(business.phone);
    setWhatsappPhoneId(business.whatsappPhoneNumberId);
    setServices(business.services);
    setStylists(business.stylists);
    setHours(business.hours);
    setPassword('');
  }, [business]);

  const handleSaveAll = async () => {
    const updatedBiz: Business = {
      ...business,
      name,
      ownerName,
      ownerEmail,
      phone,
      whatsappPhoneNumberId: whatsappPhoneId,
      hours,
      services,
      stylists,
    };

    // Add password only if it's explicitly set to change it
    const updatePayload = password ? { ...updatedBiz, password } : updatedBiz;

    try {
      const res = await fetch(`/api/business/${business.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      if (res.ok) {
        onUpdateBusiness(updatedBiz);
        setPassword('');
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServiceName) return;

    const newSrv: Service = {
      id: `srv_${Date.now()}`,
      name: newServiceName,
      category: newServiceCategory,
      durationMinutes: Number(newServiceDuration),
      price: Number(newServicePrice),
      description: newServiceDesc,
    };

    setServices([...services, newSrv]);
    setNewServiceName('');
    setNewServiceDesc('');
  };

  const handleDeleteService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  const handleAddStylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStylistName) return;

    const newSt: Stylist = {
      id: `stylist_${Date.now()}`,
      name: newStylistName,
      specialties: newStylistSpecialties ? newStylistSpecialties.split(',').map((s) => s.trim()) : ['Hair'],
      workingHours: newStylistHours,
    };

    setStylists([...stylists, newSt]);
    setNewStylistName('');
    setNewStylistSpecialties('');
  };

  const handleDeleteStylist = (id: string) => {
    setStylists(stylists.filter((st) => st.id !== id));
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <Settings className="w-6 h-6 text-rose-800" />
            <span>Salon Configuration & Catalog</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Configure services, prices, hours, and stylists. The Gemini AI agent uses this catalog to answer questions and book slots.
          </p>
        </div>

        <button
          onClick={handleSaveAll}
          className="bg-[#37352F] hover:bg-black text-white px-5 py-2.5 rounded-xl font-semibold text-xs flex items-center space-x-2 transition shadow-xs shrink-0"
        >
          <Save className="w-4 h-4" />
          <span>Save All Settings</span>
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs px-4 py-3 rounded-xl mb-6 flex items-center space-x-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          <span>Configuration saved successfully! AI Agent updated in real-time.</span>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div className="flex space-x-2 border-b border-[#EDEDEB] pb-3 mb-6">
        {[
          { id: 'services', label: `Services Menu (${services.length})`, icon: DollarSign },
          { id: 'stylists', label: `Stylists & Staff (${stylists.length})`, icon: Scissors },
          { id: 'hours', label: 'Opening Hours', icon: Clock },
          ...(isSuperAdmin ? [{ id: 'info', label: 'Business Profile', icon: User }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                isActive
                  ? 'bg-[#EBEAE4] text-[#37352F] border border-[#EDEDEB]'
                  : 'text-gray-500 hover:bg-[#F0EFEA] hover:text-[#37352F]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: SERVICES CATALOG */}
      {activeSubTab === 'services' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Services List (8 cols) */}
          <div className="lg:col-span-8 space-y-3">
            <h3 className="text-sm font-bold text-[#37352F] mb-3">Active Services Menu</h3>
            {services.map((srv) => (
              <div
                key={srv.id}
                className="bg-white border border-[#EDEDEB] rounded-2xl p-4 shadow-xs flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#37352F] text-sm">{srv.name}</span>
                    <span className="bg-rose-50 text-rose-800 px-2 py-0.5 rounded text-[10px] font-mono border border-rose-200">
                      {srv.category}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{srv.description}</div>
                  <div className="text-xs font-semibold text-[#37352F] mt-2 flex items-center space-x-4">
                    <span>⏱️ {srv.durationMinutes} mins</span>
                    <span>
                      💵 {business.subscriptionCurrency === 'PKR' ? 'PKR' : '$'}{' '}
                      {srv.price.toLocaleString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteService(srv.id)}
                  className="text-gray-400 hover:text-red-600 p-2 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Add Service Form (4 cols) */}
          <div className="lg:col-span-4 bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs h-fit">
            <h3 className="text-sm font-bold text-[#37352F] mb-4 flex items-center space-x-2">
              <Plus className="w-4 h-4 text-rose-800" />
              <span>Add New Service</span>
            </h3>

            <form onSubmit={handleAddService} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Keratin Treatment"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-gray-500 mb-1">Category</label>
                  <select
                    value={newServiceCategory}
                    onChange={(e) => setNewServiceCategory(e.target.value)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  >
                    <option value="Hair">Hair</option>
                    <option value="Skincare">Skincare</option>
                    <option value="Nails">Nails</option>
                    <option value="Makeup">Makeup</option>
                    <option value="Body">Body</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-500 mb-1">Duration (mins)</label>
                  <input
                    type="number"
                    value={newServiceDuration}
                    onChange={(e) => setNewServiceDuration(Number(e.target.value))}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-500 mb-1">
                  Price ({business.subscriptionCurrency})
                </label>
                <input
                  type="number"
                  value={newServicePrice}
                  onChange={(e) => setNewServicePrice(Number(e.target.value))}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief service description for AI receptionist..."
                  value={newServiceDesc}
                  onChange={(e) => setNewServiceDesc(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#37352F] hover:bg-black text-white p-2.5 rounded-xl font-semibold shadow-xs transition mt-2"
              >
                Add Service
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: STYLISTS */}
      {activeSubTab === 'stylists' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            <h3 className="text-sm font-bold text-[#37352F] mb-3">Stylists & Specialists</h3>
            {stylists.map((st) => (
              <div
                key={st.id}
                className="bg-white border border-[#EDEDEB] rounded-2xl p-4 shadow-xs flex items-center justify-between"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-800 font-bold text-sm">
                    {st.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#37352F] text-sm">{st.name}</h4>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Specialties: {st.specialties.join(', ')}
                    </div>
                    <div className="text-xs text-rose-800 font-medium mt-1">🕒 Working Hours: {st.workingHours}</div>
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteStylist(st.id)}
                  className="text-gray-400 hover:text-red-600 p-2"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="lg:col-span-4 bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs h-fit">
            <h3 className="text-sm font-bold text-[#37352F] mb-4 flex items-center space-x-2">
              <Plus className="w-4 h-4 text-rose-800" />
              <span>Add Stylist</span>
            </h3>

            <form onSubmit={handleAddStylist} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-500 mb-1">Stylist Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Ahmed"
                  value={newStylistName}
                  onChange={(e) => setNewStylistName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Specialties (comma separated)</label>
                <input
                  type="text"
                  placeholder="Haircut, Keratin, Balayage"
                  value={newStylistSpecialties}
                  onChange={(e) => setNewStylistSpecialties(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-gray-500 mb-1">Working Shift Hours</label>
                <input
                  type="text"
                  placeholder="10:00 - 18:00"
                  value={newStylistHours}
                  onChange={(e) => setNewStylistHours(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-[#37352F] hover:bg-black text-white p-2.5 rounded-xl font-semibold shadow-xs transition mt-2"
              >
                Add Stylist
              </button>
            </form>
          </div>
        </div>
      )}

      {/* TAB 3: OPENING HOURS */}
      {activeSubTab === 'hours' && (
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs max-w-2xl">
          <h3 className="text-sm font-bold text-[#37352F] mb-4 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-rose-800" />
            <span>Weekly Operating Hours</span>
          </h3>

          <div className="space-y-3 text-xs">
            {(Object.entries(hours) as [keyof WeeklyHours, BusinessHours][]).map(([dayKey, dayVal]) => (
              <div
                key={dayKey}
                className="flex items-center justify-between bg-[#F7F6F3] p-3 rounded-xl border border-[#EDEDEB]"
              >
                <span className="font-bold text-[#37352F] uppercase w-16">{dayKey}</span>
                <div className="flex items-center space-x-3">
                  <label className="flex items-center space-x-1 text-gray-600">
                    <input
                      type="checkbox"
                      checked={dayVal.closed}
                      onChange={(e) =>
                        setHours({
                          ...hours,
                          [dayKey]: { ...dayVal, closed: e.target.checked },
                        })
                      }
                      className="rounded border-[#EDEDEB] bg-white text-rose-800 focus:ring-0"
                    />
                    <span>Closed</span>
                  </label>

                  {!dayVal.closed && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="time"
                        value={dayVal.open}
                        onChange={(e) =>
                          setHours({
                            ...hours,
                            [dayKey]: { ...dayVal, open: e.target.value },
                          })
                        }
                        className="bg-white text-[#37352F] border border-[#EDEDEB] rounded px-2 py-1"
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        value={dayVal.close}
                        onChange={(e) =>
                          setHours({
                            ...hours,
                            [dayKey]: { ...dayVal, close: e.target.value },
                          })
                        }
                        className="bg-white text-[#37352F] border border-[#EDEDEB] rounded px-2 py-1"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 4: BUSINESS PROFILE */}
      {isSuperAdmin && activeSubTab === 'info' && (
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs max-w-2xl text-xs space-y-4">
          <div>
            <label className="block text-gray-500 mb-1">Salon Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 mb-1">Owner Name</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1">Owner Email</label>
              <input
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-500 mb-1">WhatsApp Phone Number</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
              />
            </div>
            <div>
              <label className="block text-gray-500 mb-1">Meta Phone Number ID</label>
              <input
                type="text"
                value={whatsappPhoneId}
                onChange={(e) => setWhatsappPhoneId(e.target.value)}
                className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono text-[10px]"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-500 mb-1">Reset Dashboard Password (Optional)</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 pr-10 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              Only fill this out if you need to reset the salon owner's login password.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
