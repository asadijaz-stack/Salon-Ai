import React, { useState } from 'react';
import { Sparkles, Mail, Lock, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { auth } from '../lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';

interface LoginProps {
  onLoginSuccess: () => void;
  onOpenOnboarding: () => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess, onOpenOnboarding }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLoginSuccess();
    } catch (err: any) {
      console.error(err);
      setError('Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FCFCFB] text-[#37352F] flex flex-col items-center justify-center p-4 selection:bg-rose-200 selection:text-rose-900">
      <div className="max-w-md w-full bg-white border border-[#EDEDEB] rounded-3xl p-8 shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-4 border border-rose-100">
            <Sparkles className="w-8 h-8 text-rose-800" />
          </div>
          <h1 className="text-2xl font-bold text-[#37352F]">Welcome to SalonAI</h1>
          <p className="text-gray-500 text-sm mt-2 text-center">
            Sign in to manage your AI receptionist, view calendar, and monitor conversations.
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 text-red-700 p-4 rounded-xl flex items-start space-x-3 text-sm border border-red-100 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-gray-700 font-medium text-sm mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#FCFCFB] text-[#37352F] pl-11 pr-4 py-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 transition-colors"
                placeholder="salon@example.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-700 font-medium text-sm mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#FCFCFB] text-[#37352F] pl-11 pr-12 py-3 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-[#37352F] hover:bg-black text-white py-3.5 rounded-xl font-semibold shadow-xs disabled:opacity-50 transition-all flex items-center justify-center space-x-2"
          >
            <span>{loading ? 'Signing In...' : 'Sign In'}</span>
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>


      </div>
    </div>
  );
};
