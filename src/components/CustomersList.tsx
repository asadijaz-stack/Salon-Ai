import React, { useState, useEffect } from 'react';
import { Users, Search, Phone, Calendar, DollarSign, UserCheck } from 'lucide-react';
import { Business, Customer } from '../types';

interface CustomersListProps {
  business: Business;
}

export const CustomersList: React.FC<CustomersListProps> = ({ business }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');

  const fetchCustomers = async () => {
    try {
      const res = await fetch(`/api/customers?businessId=${business.id}`);
      const data = await res.json();
      setCustomers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [business.id]);

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 text-[#37352F]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-[#37352F] flex items-center space-x-2">
            <Users className="w-6 h-6 text-rose-800" />
            <span>Customer Directory</span>
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            All WhatsApp clients who have messaged or booked appointments with {business.name}.
          </p>
        </div>

        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search phone or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#FCFCFB] text-[#37352F] text-xs pl-9 pr-4 py-2 rounded-xl border border-[#EDEDEB] focus:outline-none focus:border-rose-400"
          />
        </div>
      </div>

      <div className="bg-white border border-[#EDEDEB] rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#37352F]">
            <thead className="bg-[#F7F6F3] text-gray-500 font-semibold uppercase tracking-wider border-b border-[#EDEDEB]">
              <tr>
                <th className="p-4">Customer</th>
                <th className="p-4">Phone Number</th>
                <th className="p-4">Total Bookings</th>
                <th className="p-4">Completed</th>
                <th className="p-4">Total Revenue</th>
                <th className="p-4">Last Visit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDEDEB]">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-400">
                    No customers found matching search filter.
                  </td>
                </tr>
              ) : (
                filtered.map((cust) => (
                  <tr key={cust.phone} className="hover:bg-[#FCFCFB] transition">
                    <td className="p-4 font-bold text-[#37352F] flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-800 font-bold text-xs shrink-0">
                        {cust.name.charAt(0)}
                      </div>
                      <span>{cust.name}</span>
                    </td>
                    <td className="p-4 font-mono text-gray-600">{cust.phone}</td>
                    <td className="p-4 font-semibold text-[#37352F]">{cust.totalBookings}</td>
                    <td className="p-4 font-semibold text-emerald-700">{cust.completedBookings}</td>
                    <td className="p-4 font-bold text-[#37352F]">
                      {business.subscriptionCurrency === 'PKR' ? 'PKR' : '$'}{' '}
                      {cust.totalSpent.toLocaleString()}
                    </td>
                    <td className="p-4 text-gray-500">
                      {cust.lastBookingDate
                        ? new Date(cust.lastBookingDate).toLocaleDateString()
                        : 'No bookings'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
