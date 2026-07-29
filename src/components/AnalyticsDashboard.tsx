import React, { useState, useEffect } from 'react';
import { BarChart3, MessageSquare, Bot, AlertOctagon, TrendingUp, Clock, Zap, Sparkles } from 'lucide-react';
import { Business, AnalyticsSummary } from '../types';

interface AnalyticsDashboardProps {
  business: Business;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ business }) => {
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch(`/api/analytics?businessId=${business.id}`);
      const data = await res.json();
      setAnalytics(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [business.id]);

  if (!analytics) return null;

  const totalBookings = analytics.aiBookingsCount + analytics.manualBookingsCount || 1;
  const aiPercentage = Math.round((analytics.aiBookingsCount / totalBookings) * 100);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
          <BarChart3 className="w-6 h-6 text-rose-800" />
          <span>AI Performance & Business Analytics</span>
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Real-time metrics on WhatsApp AI receptionist volume, booking conversion, and no-show prevention.
        </p>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {/* Metric 1 */}
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>WhatsApp Messages</span>
            <MessageSquare className="w-4 h-4 text-rose-800" />
          </div>
          <div className="text-2xl font-bold text-[#37352F] mb-1">
            {analytics.messagesHandledThisMonth.toLocaleString()}
          </div>
          <div className="text-[11px] text-rose-800 font-semibold flex items-center space-x-1">
            <Zap className="w-3 h-3" />
            <span>100% Automated Instant Replies</span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>AI Bookings Share</span>
            <Bot className="w-4 h-4 text-rose-800" />
          </div>
          <div className="text-2xl font-bold text-[#37352F] mb-1">
            {aiPercentage}%
          </div>
          <div className="text-[11px] text-gray-600">
            {analytics.aiBookingsCount} AI vs {analytics.manualBookingsCount} Manual
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>No-Shows Prevented</span>
            <AlertOctagon className="w-4 h-4 text-rose-800" />
          </div>
          <div className="text-2xl font-bold text-rose-800 mb-1">
            ~{analytics.estimatedNoShowsPrevented} Appointments
          </div>
          <div className="text-[11px] text-gray-500">
            Via instant WhatsApp confirmation
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-5 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between text-gray-500 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Avg Response Speed</span>
            <Clock className="w-4 h-4 text-rose-800" />
          </div>
          <div className="text-2xl font-bold text-[#37352F] mb-1">
            {analytics.avgResponseTimeSeconds}s
          </div>
          <div className="text-[11px] text-rose-800 font-semibold">
            Instant Gemini tool execution
          </div>
        </div>
      </div>

      {/* Revenue & AI Booking Split Visualizer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs">
          <h3 className="text-sm font-bold text-[#37352F] mb-4 flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-rose-800" />
            <span>AI vs Owner Booking Distribution</span>
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs font-semibold text-[#37352F] mb-1">
                <span>AI Receptionist Bookings</span>
                <span className="text-rose-800 font-bold">{analytics.aiBookingsCount} ({aiPercentage}%)</span>
              </div>
              <div className="w-full h-3 bg-[#F7F6F3] rounded-full overflow-hidden border border-[#EDEDEB]">
                <div
                  className="h-full bg-rose-800 rounded-full transition-all duration-500"
                  style={{ width: `${aiPercentage}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold text-[#37352F] mb-1">
                <span>Manual Owner Bookings</span>
                <span className="text-gray-500">{analytics.manualBookingsCount} ({100 - aiPercentage}%)</span>
              </div>
              <div className="w-full h-3 bg-[#F7F6F3] rounded-full overflow-hidden border border-[#EDEDEB]">
                <div
                  className="h-full bg-gray-400 rounded-full transition-all duration-500"
                  style={{ width: `${100 - aiPercentage}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#37352F] mb-2 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-rose-800" />
              <span>Estimated Salon Revenue Processed</span>
            </h3>
            <div className="text-3xl font-bold text-[#37352F] mt-3">
              {business.subscriptionCurrency === 'PKR' ? 'PKR' : '$'}{' '}
              {analytics.revenueGenerated.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Calculated from confirmed and completed appointments booked automatically via WhatsApp or logged manually.
            </p>
          </div>

          <div className="pt-4 border-t border-[#EDEDEB] text-xs text-rose-800 font-semibold flex items-center space-x-1">
            <span>✨ SalonAI ROI: 15x value generated vs subscription cost</span>
          </div>
        </div>
      </div>
    </div>
  );
};
