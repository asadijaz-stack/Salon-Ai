import React from 'react';
import {
  MessageSquare,
  Calendar,
  Sparkles,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Smartphone,
  Bot,
  Plus,
  ChevronDown,
  Code2,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { Business } from '../types';

interface HeaderProps {
  businesses: Business[];
  currentBusiness: Business;
  onSelectBusiness: (biz: Business) => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenOnboarding: () => void;
  onLogout: () => void;
  isSuperAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  businesses,
  currentBusiness,
  onSelectBusiness,
  activeTab,
  setActiveTab,
  onOpenOnboarding,
  onLogout,
  isSuperAdmin = false,
}) => {
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  const navItems = [
    { id: 'chats', label: 'Conversations', icon: MessageSquare },
    { id: 'simulator', label: 'WhatsApp Simulator', icon: Smartphone, highlight: true },
    { id: 'calendar', label: 'Bookings', icon: Calendar },
    { id: 'services', label: 'Services & Stylists', icon: Settings },
    { id: 'customers', label: 'Customers', icon: Users },
    { id: 'logs', label: 'AI Agent Logs', icon: Bot },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  if (isSuperAdmin) {
    navItems.push({ id: 'billing', label: 'Billing', icon: CreditCard });
    navItems.push({ id: 'export', label: 'Cloud Function', icon: Code2 });
  }

  return (
    <header className="bg-[#F7F6F3] text-[#37352F] border-b border-[#EDEDEB] sticky top-0 z-40 shadow-xs">
      {/* Top bar: Tenant Switcher, Salon Status & Action */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Logo & Tenant Switcher */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2.5 bg-rose-100/80 px-3.5 py-1.5 rounded-xl border border-rose-200">
            <Sparkles className="w-5 h-5 text-rose-800" />
            <span className="font-bold text-lg tracking-tight text-rose-900">SalonAI</span>
            <span className="bg-rose-200/70 text-rose-900 text-[11px] font-semibold px-2 py-0.5 rounded-md border border-rose-300/50">
              WhatsApp Desk
            </span>
          </div>

          {/* Business Dropdown / Display */}
          <div className="relative">
            {isSuperAdmin ? (
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 bg-white hover:bg-[#F0EFEA] text-[#37352F] px-3.5 py-1.5 rounded-lg border border-[#EDEDEB] text-sm font-medium transition-all shadow-xs"
              >
                <span className="font-semibold text-[#37352F]">{currentBusiness.name}</span>
                <span className="bg-[#F0EFEA] text-gray-600 text-xs px-2 py-0.5 rounded">
                  {currentBusiness.subscriptionCurrency === 'PKR' ? 'PKR' : 'USD'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-500" />
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-white text-[#37352F] px-3.5 py-1.5 rounded-lg border border-[#EDEDEB] text-sm font-medium shadow-xs">
                <span className="font-semibold text-[#37352F]">{currentBusiness.name}</span>
              </div>
            )}

            {isSuperAdmin && dropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 bg-white border border-[#EDEDEB] rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  Select Salon Tenant
                </div>
                {businesses.map((biz) => (
                  <button
                    key={biz.id}
                    onClick={() => {
                      onSelectBusiness(biz);
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2.5 text-sm flex items-center justify-between hover:bg-[#F0EFEA] transition ${
                      biz.id === currentBusiness.id ? 'bg-[#EBEAE4] text-rose-900 font-semibold' : 'text-[#37352F]'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{biz.name}</div>
                      <div className="text-xs text-gray-500">{biz.ownerName} • {biz.phone}</div>
                    </div>
                    {biz.id === currentBusiness.id && <CheckCircle2 className="w-4 h-4 text-rose-800" />}
                  </button>
                ))}
                <div className="border-t border-[#EDEDEB] mt-1 pt-1 px-2">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenOnboarding();
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-50 rounded-lg transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Onboard New Salon</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center space-x-2 text-xs">
          <div className="flex items-center space-x-2 bg-emerald-50 border border-emerald-200 text-emerald-800 px-3 py-1.5 rounded-full font-medium shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Gemini AI Agent</span>
          </div>

          <div className="hidden lg:flex items-center space-x-1.5 bg-blue-50 border border-blue-200 text-blue-900 px-2.5 py-1 rounded-full font-medium text-[11px]">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-700" />
            <span>App Check Verified</span>
          </div>

          <div className="hidden xl:flex items-center space-x-1.5 bg-slate-100 border border-slate-200 text-slate-800 px-2.5 py-1 rounded-full font-medium text-[11px]">
            <Code2 className="w-3.5 h-3.5 text-slate-600" />
            <span>HMAC SHA-256</span>
          </div>

          <div className="hidden md:flex items-center space-x-2 bg-white text-gray-700 px-3 py-1.5 rounded-full border border-[#EDEDEB]">
            <Smartphone className="w-3.5 h-3.5 text-gray-500" />
            <span className="text-gray-700 font-mono text-[11px]">{currentBusiness.phone}</span>
          </div>

          <button
            onClick={onLogout}
            className="ml-2 text-xs font-semibold text-gray-500 hover:text-gray-800 transition"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-[#EDEDEB]">
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-1 scrollbar-none">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-[#EBEAE4] text-[#37352F] font-semibold border border-[#EDEDEB]'
                    : item.highlight
                    ? 'text-rose-800 bg-rose-50 border border-rose-200/80 hover:bg-rose-100/60'
                    : 'text-gray-600 hover:bg-[#F0EFEA] hover:text-[#37352F]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-rose-800' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
