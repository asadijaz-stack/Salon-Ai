import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { LiveConversations } from './components/LiveConversations';
import { WhatsAppTester } from './components/WhatsAppTester';
import { BookingsCalendar } from './components/BookingsCalendar';
import { SalonSettings } from './components/SalonSettings';
import { CustomersList } from './components/CustomersList';
import { AgentLogs } from './components/AgentLogs';
import { BillingScreen } from './components/BillingScreen';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { CloudFunctionCodeExport } from './components/CloudFunctionCodeExport';
import { OnboardingModal } from './components/OnboardingModal';
import { Business } from './types';

export default function App() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chats');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const fetchBusinesses = async () => {
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      setBusinesses(data);
      if (data.length > 0 && !currentBusiness) {
        setCurrentBusiness(data[0]);
      }
    } catch (e) {
      console.error('Error fetching businesses:', e);
    }
  };

  useEffect(() => {
    fetchBusinesses();
  }, []);

  const handleSelectBusiness = (biz: Business) => {
    setCurrentBusiness(biz);
  };

  const handleUpdateBusiness = (updated: Business) => {
    setCurrentBusiness(updated);
    setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  };

  const handleBusinessCreated = (newBiz: Business) => {
    setBusinesses((prev) => [...prev, newBiz]);
    setCurrentBusiness(newBiz);
  };

  if (!currentBusiness) {
    return (
      <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex items-center justify-center">
        <div className="flex items-center space-x-3 text-rose-800">
          <span className="w-5 h-5 rounded-full border-2 border-rose-800 border-t-transparent animate-spin" />
          <span className="text-sm font-medium">Loading SalonAI Multi-Tenant Dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] font-sans selection:bg-rose-200 selection:text-rose-900">
      {/* Top Header & Tenant Selector */}
      <Header
        businesses={businesses}
        currentBusiness={currentBusiness}
        onSelectBusiness={handleSelectBusiness}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenOnboarding={() => setIsOnboardingOpen(true)}
      />

      {/* Main Content Area */}
      <main className="pb-12">
        {activeTab === 'chats' && <LiveConversations business={currentBusiness} />}
        {activeTab === 'simulator' && <WhatsAppTester business={currentBusiness} />}
        {activeTab === 'calendar' && <BookingsCalendar business={currentBusiness} />}
        {activeTab === 'services' && (
          <SalonSettings business={currentBusiness} onUpdateBusiness={handleUpdateBusiness} />
        )}
        {activeTab === 'customers' && <CustomersList business={currentBusiness} />}
        {activeTab === 'logs' && <AgentLogs business={currentBusiness} />}
        {activeTab === 'billing' && <BillingScreen business={currentBusiness} />}
        {activeTab === 'analytics' && <AnalyticsDashboard business={currentBusiness} />}
        {activeTab === 'export' && <CloudFunctionCodeExport />}
      </main>

      {/* Onboarding Modal */}
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onBusinessCreated={handleBusinessCreated}
      />
    </div>
  );
}
