import React, { useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';

const AdminBooking: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const dummyData = [
    { id: 'PRJ-8001', name: 'Alpha Room Booking', status: 'Confirmed', domain: 'Facilities', type: 'Room', desc: 'Quarterly review', ingest: 'Success' },
    { id: 'PRJ-8002', name: 'Beta Desk 12', status: 'Pending', domain: 'IT', type: 'Desk', desc: 'New hire setup', ingest: 'Processing' },
    { id: 'PRJ-8003', name: 'Gamma Boardroom', status: 'Confirmed', domain: 'HR', type: 'Room', desc: 'Interviews', ingest: 'Success' },
  ];

  return (
    <div className="animate-fade-in w-full">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Bookings</h1>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <input 
            type="text" 
            placeholder="Search Bookings" 
            className="w-full pl-3 pr-10 py-2 border border-gray-300 rounded-md outline-none focus:border-[#007bc0] focus:ring-1 focus:ring-[#007bc0] transition-shadow text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#007bc0] text-white text-sm">
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">Booking ID</th>
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">User / Name</th>
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">Status</th>
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">Domain</th>
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">Service Type</th>
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">Description</th>
                <th className="p-3 font-semibold whitespace-nowrap border-r border-white/20">Ingestion Status</th>
                <th className="p-3 font-semibold whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dummyData.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200 hover:bg-gray-50 text-sm transition-colors text-gray-700">
                  <td className="p-3 font-medium">{item.id}</td>
                  <td className="p-3">{item.name}</td>
                  <td className="p-3">{item.status}</td>
                  <td className="p-3">{item.domain}</td>
                  <td className="p-3">{item.type}</td>
                  <td className="p-3 truncate max-w-[150px]">{item.desc}</td>
                  <td className="p-3">{item.ingest}</td>
                  <td className="p-3 text-[#007bc0] font-medium cursor-pointer hover:underline">Edit</td>
                </tr>
              ))}
              {dummyData.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-gray-500">No records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminBooking;
