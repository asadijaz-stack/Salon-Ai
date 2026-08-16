import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Filter,
  Bot,
  Scissors,
  Phone,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
} from 'lucide-react';
import { Business, Booking, BookingStatus } from '../types';

interface BookingsCalendarProps {
  business: Business;
}

export const BookingsCalendar: React.FC<BookingsCalendarProps> = ({ business }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedStylist, setSelectedStylist] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [calendarDate, setCalendarDate] = useState<Date>(new Date());

  // New Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [serviceId, setServiceId] = useState(business.services[0]?.id || '');
  const [stylistId, setStylistId] = useState(business.stylists[0]?.id || '');
  const [bookingTime, setBookingTime] = useState('');
  const [notes, setNotes] = useState('');
  const [editingBookingStatus, setEditingBookingStatus] = useState<BookingStatus | null>(null);

  const fetchBookings = async () => {
    try {
      const res = await fetch(`/api/bookings?businessId=${business.id}`);
      const data = await res.json();
      setBookings(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [business.id]);

  const handleUpdateStatus = async (id: string, newStatus: BookingStatus) => {
    try {
      const res = await fetch(`/api/bookings/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        fetchBookings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteBooking = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this booking?")) return;
    try {
      const res = await fetch(`/api/bookings/${id}?businessId=${business.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchBookings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleEditBooking = (bk: Booking) => {
    setCustomerName(bk.customerName);
    setCustomerPhone(bk.customerPhone);
    setServiceId(bk.serviceId);
    setStylistId(bk.stylistId || business.stylists[0]?.id || '');
    
    // Format Date for datetime-local input: YYYY-MM-DDTHH:MM
    const dateObj = new Date(bk.startTime);
    const localIso = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    setBookingTime(localIso);
    
    setNotes(bk.notes || '');
    setEditingBookingStatus(bk.status);
    setEditingBookingId(bk.id);
    setIsModalOpen(true);
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !bookingTime) return;

    try {
      const url = editingBookingId 
        ? `/api/bookings/${editingBookingId}?businessId=${business.id}`
        : `/api/bookings?businessId=${business.id}`;
      const method = editingBookingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone: customerPhone || '+92 300 0000000',
          serviceId: serviceId || business.services[0]?.id,
          stylistId: stylistId || business.stylists[0]?.id,
          startTime: new Date(bookingTime).toISOString(),
          notes,
          ...(editingBookingId && editingBookingStatus ? { status: editingBookingStatus } : {})
        }),
      });

      if (res.ok) {
        setIsModalOpen(false);
        setEditingBookingId(null);
        setEditingBookingStatus(null);
        setCustomerName('');
        setCustomerPhone('');
        setNotes('');
        fetchBookings();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const renderBookingCard = (bk: Booking) => {
    const service = business.services.find((s) => s.id === bk.serviceId);
    const stylist = business.stylists.find((st) => st.id === bk.stylistId);
    const isAI = bk.createdBy === 'ai';

    return (
      <div
        key={bk.id}
        className="bg-white border border-[#EDEDEB] hover:border-gray-300 rounded-2xl p-4 shadow-xs transition flex flex-col justify-between"
      >
        <div>
          {/* Top Bar: Service & Status */}
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <h3 className="font-bold text-[#37352F] text-sm">
                {service ? service.name : 'Salon Service'}
              </h3>
              <div className="text-xs text-gray-500 mt-0.5">
                {business.subscriptionCurrency === 'PKR' ? 'PKR' : '$'}{' '}
                {service ? service.price : 3000} • {service?.durationMinutes || 45} mins
              </div>
            </div>

            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                bk.status === 'confirmed'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : bk.status === 'completed'
                  ? 'bg-blue-50 text-blue-800 border border-blue-200'
                  : bk.status === 'no_show'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-red-50 text-red-800 border border-red-200'
              }`}
            >
              {bk.status}
            </span>
          </div>

          {/* Customer Info */}
          <div className="bg-[#F7F6F3] p-3 rounded-xl border border-[#EDEDEB] space-y-1.5 text-xs mb-3">
            <div className="flex items-center justify-between text-[#37352F] font-semibold">
              <span className="flex items-center space-x-1.5">
                <User className="w-3.5 h-3.5 text-gray-400" />
                <span>{bk.customerName}</span>
              </span>
              <span className="text-[10px] text-gray-500 font-mono">{bk.customerPhone}</span>
            </div>

            <div className="flex items-center justify-between text-gray-600 text-[11px]">
              <span className="flex items-center space-x-1">
                <Clock className="w-3 h-3 text-rose-800" />
                <span>{new Date(bk.startTime).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
              </span>
            </div>

            {stylist && (
              <div className="text-[11px] text-gray-500 flex items-center space-x-1">
                <Scissors className="w-3 h-3 text-gray-400" />
                <span>Stylist: <strong className="text-[#37352F]">{stylist.name}</strong></span>
              </div>
            )}

            {bk.notes && (
              <div className="text-[11px] text-gray-500 italic pt-1 border-t border-[#EDEDEB]">
                "{bk.notes}"
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions & Origin */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-500 mb-2">
            <span className="flex items-center space-x-1">
              {isAI ? (
                <>
                  <Bot className="w-3 h-3 text-rose-800" />
                  <span className="text-rose-800 font-semibold">Booked via WhatsApp AI</span>
                </>
              ) : (
                <span>Booked Manually</span>
              )}
            </span>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-gray-400">#{bk.id}</span>
              <button 
                onClick={() => handleEditBooking(bk)}
                className="text-gray-400 hover:text-gray-600 underline"
              >
                Edit
              </button>
              <button 
                onClick={() => handleDeleteBooking(bk.id)}
                className="text-red-400 hover:text-red-600 transition"
                title="Delete Booking"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#EDEDEB] text-[10px]">
            <button
              onClick={() => handleUpdateStatus(bk.id, 'completed')}
              disabled={bk.status === 'completed'}
              className="bg-blue-50 hover:bg-blue-100 disabled:opacity-40 text-blue-800 py-1.5 rounded-lg border border-blue-200 font-semibold transition flex items-center justify-center space-x-1"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Complete</span>
            </button>

            <button
              onClick={() => handleUpdateStatus(bk.id, 'no_show')}
              disabled={bk.status === 'no_show'}
              className="bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 py-1.5 rounded-lg border border-amber-200 font-semibold transition flex items-center justify-center space-x-1"
            >
              <AlertOctagon className="w-3 h-3" />
              <span>No-Show</span>
            </button>

            <button
              onClick={() => handleUpdateStatus(bk.id, 'cancelled')}
              disabled={bk.status === 'cancelled'}
              className="bg-red-50 hover:bg-red-100 disabled:opacity-40 text-red-800 py-1.5 rounded-lg border border-red-200 font-semibold transition flex items-center justify-center space-x-1"
            >
              <XCircle className="w-3 h-3" />
              <span>Cancel</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  const filteredBookings = bookings.filter((b) => {
    const matchStylist = selectedStylist === 'all' || b.stylistId === selectedStylist;
    const matchStatus = selectedStatus === 'all' || b.status === selectedStatus;
    
    let matchSearch = true;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      matchSearch = 
        (b.customerName || '').toLowerCase().includes(q) || 
        (b.customerPhone || '').toLowerCase().includes(q) || 
        b.id.toLowerCase().includes(q) ||
        new Date(b.startTime).toLocaleDateString().includes(q);
    }

    return matchStylist && matchStatus && matchSearch;
  });

  const groupedBookings = filteredBookings.reduce((acc, bk) => {
    const dateStr = new Date(bk.startTime).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(bk);
    return acc;
  }, {} as Record<string, Booking[]>);

  const sortedDates = Object.keys(groupedBookings).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

  // For Day View (calendar mode)
  const currentDayStr = calendarDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const currentDayBookings = groupedBookings[currentDayStr] || [];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <Calendar className="w-6 h-6 text-rose-800" />
            <span>Salon Bookings & Appointments</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            Real-time schedule for {business.name}. AI booked appointments appear instantly.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <div className="bg-gray-100 p-1 rounded-xl flex items-center shadow-inner">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'list' ? 'bg-white shadow-xs text-rose-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${viewMode === 'calendar' ? 'bg-white shadow-xs text-rose-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Day View
            </button>
          </div>
          <button
            onClick={() => {
              setEditingBookingId(null);
              setCustomerName('');
              setCustomerPhone('');
              setBookingTime('');
              setNotes('');
              setIsModalOpen(true);
            }}
            className="bg-[#37352F] hover:bg-black text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center space-x-2 transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Manual Booking</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#EDEDEB] rounded-2xl p-4 shadow-xs mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        
        {/* Search */}
        <div className="flex-1 w-full md:w-auto flex items-center space-x-2 bg-[#FCFCFB] border border-[#EDEDEB] rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search name, phone, date, or ID..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none focus:outline-none text-[#37352F] w-full"
          />
        </div>

        <div className="flex flex-wrap items-center space-x-4">
          {/* Stylist Filter */}
          <div className="flex items-center space-x-2">
            <Scissors className="w-4 h-4 text-gray-400" />
            <label className="text-gray-500 font-medium hidden sm:inline">Stylist:</label>
            <select
              value={selectedStylist}
              onChange={(e) => setSelectedStylist(e.target.value)}
              className="bg-[#FCFCFB] text-[#37352F] border border-[#EDEDEB] rounded-lg px-3 py-1.5 focus:outline-none focus:border-rose-400"
            >
              <option value="all">All Stylists ({business.stylists.length})</option>
              {business.stylists.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <label className="text-gray-500 font-medium hidden sm:inline">Status:</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-[#FCFCFB] text-[#37352F] border border-[#EDEDEB] rounded-lg px-3 py-1.5 focus:outline-none focus:border-rose-400"
            >
              <option value="all">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="completed">Completed</option>
              <option value="no_show">No-Show</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        <div className="text-gray-500 font-mono hidden lg:block">
          {filteredBookings.length} {filteredBookings.length === 1 ? 'Booking' : 'Bookings'}
        </div>
      </div>

      {/* Bookings View Mode */}
      {viewMode === 'list' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBookings.length === 0 ? (
            <div className="col-span-full bg-white border border-[#EDEDEB] rounded-2xl p-12 text-center text-gray-400">
              No bookings found matching selected filters.
            </div>
          ) : (
            filteredBookings.map(renderBookingCard)
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Day View Navigator */}
          <div className="flex items-center justify-between bg-white border border-[#EDEDEB] rounded-2xl p-4 shadow-xs">
            <button 
              onClick={() => setCalendarDate(new Date(calendarDate.getTime() - 86400000))}
              className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500 hover:text-[#37352F]"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex flex-col items-center">
              <h3 className="text-lg font-bold text-[#37352F] flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-rose-700" />
                <span>{currentDayStr}</span>
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">{currentDayBookings.length} {currentDayBookings.length === 1 ? 'Booking' : 'Bookings'} Scheduled</p>
            </div>
            <button 
              onClick={() => setCalendarDate(new Date(calendarDate.getTime() + 86400000))}
              className="p-2 hover:bg-gray-100 rounded-full transition text-gray-500 hover:text-[#37352F]"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {currentDayBookings.length === 0 ? (
            <div className="bg-white border border-[#EDEDEB] rounded-2xl p-12 text-center text-gray-400">
              No bookings scheduled for {currentDayStr}.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentDayBookings.map(renderBookingCard)}
            </div>
          )}
        </div>
      )}

      {/* Manual Booking Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#EDEDEB] rounded-2xl p-6 max-w-md w-full shadow-xl animate-in fade-in zoom-in-95 text-[#37352F]">
            <h3 className="text-lg font-bold text-[#37352F] mb-4 flex items-center justify-between">
              <span>{editingBookingId ? 'Edit Booking' : 'Log Manual Booking'}</span>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-[#37352F]"
              >
                ✕
              </button>
            </h3>

            <form onSubmit={handleCreateBooking} className="space-y-4 text-xs">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sana Ali"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Customer Phone</label>
                <input
                  type="text"
                  placeholder="+92 300 1234567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Service</label>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                >
                  {business.services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.durationMinutes}m - PKR {s.price})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Assigned Stylist</label>
                <select
                  value={stylistId}
                  onChange={(e) => setStylistId(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                >
                  {business.stylists.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={bookingTime}
                  onChange={(e) => setBookingTime(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              {editingBookingId && (
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Status</label>
                  <select
                    value={editingBookingStatus || 'confirmed'}
                    onChange={(e) => setEditingBookingStatus(e.target.value as BookingStatus)}
                    className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="completed">Completed</option>
                    <option value="no_show">No-Show</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-gray-600 font-medium mb-1">Notes / Preferences</label>
                <input
                  type="text"
                  placeholder="e.g. Walk-in customer request"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-[#FCFCFB] text-[#37352F] p-2.5 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#EDEDEB]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-gray-500 hover:text-[#37352F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-[#37352F] hover:bg-black text-white px-5 py-2 rounded-xl font-semibold shadow-xs"
                >
                  Save Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
