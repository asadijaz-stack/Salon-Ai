import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
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
import { Login } from './components/Login';
import { Business } from './types';
import { auth } from './lib/firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { LogOut, Clock } from 'lucide-react';

const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  if (auth.currentUser && typeof input === 'string' && input.startsWith('/api/')) {
    const token = await auth.currentUser.getIdToken();
    init = init || {};
    init.headers = {
      ...init.headers,
      'Authorization': `Bearer ${token}`
    };
  }
  return originalFetch(input, init);
};

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-red-50 text-red-900">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-xl w-full border border-red-200">
            <h1 className="text-xl font-bold mb-4">Something went wrong</h1>
            <pre className="text-xs overflow-auto bg-gray-100 p-4 rounded text-gray-800">{this.state.error?.toString()}</pre>
            <button onClick={() => window.location.reload()} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const PendingApprovalScreen = ({ onLogout }: { onLogout: () => void }) => (
  <div className="min-h-screen bg-[#FCFCFB] flex flex-col items-center justify-center p-4">
    <div className="max-w-md w-full bg-white border border-[#EDEDEB] rounded-3xl p-8 shadow-2xl text-center">
      <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-100">
        <Clock className="w-8 h-8 text-amber-600" />
      </div>
      <h1 className="text-2xl font-bold text-[#37352F] mb-4">Account Pending Approval</h1>
      <p className="text-gray-500 text-sm mb-8 leading-relaxed">
        Thank you for registering your salon! You will be hearing from us through an email soon. 
        Please check your spam folder too.
      </p>
      <button
        onClick={onLogout}
        className="flex items-center justify-center space-x-2 w-full py-3 bg-[#EDEDEB] hover:bg-gray-200 text-gray-700 rounded-xl font-medium transition-colors"
      >
        <LogOut className="w-4 h-4" />
        <span>Sign Out</span>
      </button>
    </div>
  </div>
);

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);
  const [fetchComplete, setFetchComplete] = useState(false);
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
  const [activeTab, setActiveTab] = useState<string>('chats');
  const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

  const isSuperAdmin = user?.email === 'asadijaz444@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthInitialized(true);
    });
    return () => unsubscribe();
  }, []);

  const fetchBusinesses = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/businesses');
      const data = await res.json();
      if (Array.isArray(data)) {
        setBusinesses(data);
        if (data.length > 0 && !currentBusiness) {
          setCurrentBusiness(data[0]);
        }
      } else {
        console.error('API returned non-array:', data);
        setBusinesses([]);
      }
    } catch (e) {
      console.error('Error fetching businesses:', e);
    } finally {
      setFetchComplete(true);
    }
  };

  useEffect(() => {
    if (user) {
      setFetchComplete(false);
      fetchBusinesses();
    } else {
      setBusinesses([]);
      setCurrentBusiness(null);
      setFetchComplete(false);
    }
  }, [user]);

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

  const handleLogout = async () => {
    await signOut(auth);
  };

  const renderContent = () => {
    if (!authInitialized) {
      return (
        <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex items-center justify-center">
          <div className="flex items-center space-x-3 text-rose-800">
            <span className="w-5 h-5 rounded-full border-2 border-rose-800 border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Initializing SalonAI...</span>
          </div>
        </div>
      );
    }

    if (!user) {
      return <Login onLoginSuccess={() => {}} onOpenOnboarding={() => setIsOnboardingOpen(true)} />;
    }

    if (user && !fetchComplete) {
      return (
        <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex items-center justify-center">
          <div className="flex items-center space-x-3 text-rose-800">
            <span className="w-5 h-5 rounded-full border-2 border-rose-800 border-t-transparent animate-spin" />
            <span className="text-sm font-medium">Loading Dashboard...</span>
          </div>
        </div>
      );
    }

    if (user && fetchComplete && businesses.length === 0) {
      if (isSuperAdmin) {
        return (
          <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex flex-col items-center justify-center p-4">
            <h1 className="text-2xl font-bold mb-4">Super Admin Dashboard</h1>
            <p className="text-gray-500 mb-8">No salons found in the database. Please onboard a new salon.</p>
            <div className="flex space-x-4">
              <button
                onClick={() => setIsOnboardingOpen(true)}
                className="bg-rose-800 text-white px-6 py-3 rounded-xl font-medium"
              >
                Onboard New Salon
              </button>
              <button
                onClick={handleLogout}
                className="bg-white border border-[#EDEDEB] hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl font-medium"
              >
                Sign Out
              </button>
            </div>
          </div>
        );
      }

      return (
        <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex flex-col items-center justify-center p-4">
          <div className="max-w-md w-full bg-white border border-[#EDEDEB] rounded-3xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-gray-200">
              <LogOut className="w-8 h-8 text-gray-400" />
            </div>
            <h1 className="text-2xl font-bold text-[#37352F] mb-4">No Salon Found</h1>
            <p className="text-gray-500 text-sm mb-8 leading-relaxed">
              We couldn't find a salon linked to this account. Either your registration didn't complete, or your application was rejected.
            </p>
            <div className="flex flex-col space-y-3">
              <button
                onClick={handleLogout}
                className="w-full bg-white border border-[#EDEDEB] hover:bg-gray-50 text-gray-700 py-3 rounded-xl font-medium transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (currentBusiness && currentBusiness.subscriptionStatus === 'pending' && !isSuperAdmin) {
      return <PendingApprovalScreen onLogout={handleLogout} />;
    }

    return (
      <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] font-sans selection:bg-rose-200 selection:text-rose-900">
        <Header
          businesses={businesses}
          currentBusiness={currentBusiness!}
          onSelectBusiness={handleSelectBusiness}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onOpenOnboarding={() => setIsOnboardingOpen(true)}
          onLogout={handleLogout}
          isSuperAdmin={isSuperAdmin}
        />

        <main className="pb-12">
          {activeTab === 'chats' && <LiveConversations business={currentBusiness!} />}
          {activeTab === 'simulator' && <WhatsAppTester business={currentBusiness!} />}
          {activeTab === 'calendar' && <BookingsCalendar business={currentBusiness!} />}
          {activeTab === 'services' && (
            <SalonSettings 
              business={currentBusiness!} 
              onUpdateBusiness={handleUpdateBusiness} 
              isSuperAdmin={isSuperAdmin} 
            />
          )}
          {activeTab === 'customers' && <CustomersList business={currentBusiness!} />}
          {activeTab === 'logs' && <AgentLogs business={currentBusiness!} />}
          {isSuperAdmin && activeTab === 'billing' && (
            <BillingScreen 
              business={currentBusiness!} 
              allBusinesses={businesses}
              isSuperAdmin={isSuperAdmin}
              onUpdateBusiness={handleUpdateBusiness}
              onOpenOnboarding={() => setIsOnboardingOpen(true)}
            />
          )}
          {activeTab === 'analytics' && <AnalyticsDashboard business={currentBusiness!} />}
          {isSuperAdmin && activeTab === 'export' && <CloudFunctionCodeExport />}
        </main>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      {renderContent()}
      
      <OnboardingModal
        isOpen={isOnboardingOpen}
        onClose={() => setIsOnboardingOpen(false)}
        onBusinessCreated={handleBusinessCreated}
      />
    </ErrorBoundary>
  );
}
