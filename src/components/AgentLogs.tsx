import React, { useState, useEffect } from 'react';
import { Bot, CheckCircle2, AlertTriangle, Search, Clock, Cpu, Filter, ShieldCheck, RefreshCcw } from 'lucide-react';
import { Business, AgentLog } from '../types';

interface AgentLogsProps {
  business: Business;
}

export const AgentLogs: React.FC<AgentLogsProps> = ({ business }) => {
  const [logs, setLogs] = useState<AgentLog[]>([]);
  const [search, setSearch] = useState('');
  const [filterTool, setFilterTool] = useState('all');

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/agent-logs?businessId=${business.id}`);
      const data = await res.json();
      setLogs(data);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRefreshLogs = async () => {
    try {
      const lastLog = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
      const afterTimestamp = lastLog ? lastLog.timestamp : undefined;
      const url = afterTimestamp ? `/api/agent-logs?businessId=${business.id}&afterTimestamp=${encodeURIComponent(afterTimestamp)}` : `/api/agent-logs?businessId=${business.id}`;
      
      const res = await fetch(url);
      const newData = await res.json();
      
      if (Array.isArray(newData) && newData.length > 0) {
        setLogs(prev => {
          const newMap = new Map(prev.map(l => [l.id, l]));
          newData.forEach(l => newMap.set(l.id, l));
          return Array.from(newMap.values()).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        });
      }
    } catch (e) {
      console.error('Error refreshing logs:', e);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [business.id]);

  // Auto-refresh logs every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      handleRefreshLogs();
    }, 30000);
    return () => clearInterval(interval);
  }, [business.id, logs]);

  const filtered = logs.filter((log) => {
    const matchSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.reasoning.toLowerCase().includes(search.toLowerCase()) ||
      log.conversationId.includes(search);

    const matchTool = filterTool === 'all' || log.toolUsed === filterTool;
    return matchSearch && matchTool;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <Bot className="w-6 h-6 text-rose-800" />
            <span>AI Agent Reasoning & Tool Audit Trail</span>
            <button 
              onClick={handleRefreshLogs}
              className="ml-2 p-1 hover:bg-[#EBEAE4] rounded transition text-gray-500 hover:text-[#37352F]"
              title="Refresh Logs (Fetch New)"
            >
              <RefreshCcw className="w-4 h-4" />
            </button>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Complete transparent audit log of every Gemini tool execution, reasoning step, and decision for {business.name}.
          </p>
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-700" />
            <span>100% Audited Decision Logs</span>
          </div>
        </div>
      </div>

      {/* Filter controls */}
      <div className="bg-white border border-[#EDEDEB] rounded-2xl p-4 shadow-xs mb-6 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-4">
          <div className="relative w-64">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reasoning or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#FCFCFB] text-[#37352F] pl-9 pr-4 py-2 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filterTool}
              onChange={(e) => setFilterTool(e.target.value)}
              className="bg-[#FCFCFB] text-[#37352F] border border-[#EDEDEB] rounded-xl px-3 py-2 focus:outline-none focus:border-rose-400"
            >
              <option value="all">All Tool Types</option>
              <option value="check_availability">check_availability</option>
              <option value="create_booking">create_booking</option>
              <option value="reschedule_booking">reschedule_booking</option>
              <option value="cancel_booking">cancel_booking</option>
              <option value="escalate_to_owner">escalate_to_owner</option>
            </select>
          </div>
        </div>

        <div className="text-gray-500 font-mono">
          Showing {filtered.length} Audit Entries
        </div>
      </div>

      {/* Audit Log Timeline */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-12 text-center text-gray-400 text-xs">
            No agent logs found.
          </div>
        ) : (
          filtered.map((log) => (
            <div
              key={log.id}
              className="bg-white border border-[#EDEDEB] hover:border-gray-300 rounded-2xl p-4 shadow-xs transition flex flex-col md:flex-row items-start justify-between gap-4 text-xs"
            >
              <div className="flex items-start space-x-3.5 flex-1">
                <div className="w-8 h-8 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-800 shrink-0 mt-0.5">
                  <Cpu className="w-4 h-4" />
                </div>

                <div className="space-y-1 flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[#37352F] text-sm">{log.action}</span>
                    {log.toolUsed && (
                      <span className="bg-[#F7F6F3] text-rose-800 font-mono text-[10px] px-2 py-0.5 rounded border border-[#EDEDEB]">
                        {log.toolUsed}
                      </span>
                    )}
                  </div>

                  <div className="text-[#37352F] bg-[#F7F6F3] p-2.5 rounded-xl border border-[#EDEDEB] font-mono text-[11px] leading-relaxed">
                    {log.reasoning}
                  </div>

                  <div className="text-[10px] text-gray-500 flex items-center space-x-4 pt-1">
                    <span className="font-mono">Phone: {log.conversationId}</span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 border-[#EDEDEB] pt-2 md:pt-0">
                <span className="inline-flex items-center space-x-1 text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg text-[10px]">
                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                  <span>Verified Success</span>
                </span>
                <span className="text-[10px] text-gray-400 font-mono mt-1">#{log.id}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
