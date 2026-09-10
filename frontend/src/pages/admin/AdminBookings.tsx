import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  Calendar, Search, Filter, Loader2, ChevronRight, 
  Trash2, Eye, Printer, AlertCircle, CheckCircle2, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/bookings/admin/all', {
        params: {
          search: search || undefined,
          booking_type: typeFilter || undefined,
          status: statusFilter || undefined
        }
      });
      setBookings(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [typeFilter, statusFilter]);

  const handleCancel = async (id: string) => {
    setCancelLoading(true);
    try {
      await api.post(`/bookings/${id}/cancel`);
      setCancellingId(null);
      fetchBookings();
    } catch (err) {
      console.error(err);
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <div className="space-y-6 font-['Inter']">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Master Workspace Booking Ledger</h1>
      </div>

      {/* Filters & Search */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <form 
          onSubmit={(e) => { e.preventDefault(); fetchBookings(); }}
          className="relative flex-1 max-w-md w-full"
        >
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by user, location, or booking ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] transition-all"
          />
        </form>

        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 text-gray-700"
          >
            <option value="">All Types</option>
            <option value="SEAT">Individual Seat</option>
            <option value="DAY_PASS">Day Pass</option>
            <option value="MEETING_ROOM">Meeting Room</option>
            <option value="CONFERENCE_ROOM">Conference Room</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="CONFIRMED">CONFIRMED</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
      </div>

      {/* Bookings Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#007bc0]" size={36} />
          </div>
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Calendar size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No bookings found matching filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Booking ID & Date</th>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Type & Resource</th>
                  <th className="py-3 px-4">Location & Branch</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {bookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono">
                      <div className="font-bold text-gray-800">#{b.id.substring(0, 8).toUpperCase()}</div>
                      <div className="text-[11px] text-gray-400">{b.booking_date}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-gray-800">{b.user_name || 'User'}</div>
                      <div className="text-[11px] text-gray-400">{b.user_email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-bold text-gray-800 block">
                        {b.booking_type === 'SEAT' ? `Seat ${b.seat_number || 'Standard'}` :
                         b.booking_type === 'DAY_PASS' ? (b.day_pass_name || 'Day Pass') :
                         (b.room_name || 'Room')}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {b.time_slot_label ? `From ${b.time_slot_label.split(' - ')[0]?.slice(0, 5)} To ${b.time_slot_label.split(' - ')[1]?.slice(0, 5)}` : 'Full Day Access'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-gray-700">
                      <div className="font-medium">{b.location_name}</div>
                      <div className="text-[11px] text-gray-400">{b.branch_name}</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-gray-900 whitespace-nowrap">
                      ₹{b.amount}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        b.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        {b.status === 'CONFIRMED' && (
                          <button
                            onClick={() => setCancellingId(b.id)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                            title="Admin Cancel & Refund"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <AnimatePresence>
        {cancellingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-600" /> Cancel User Booking?
              </h3>
              <p className="text-xs text-gray-500">
                This will cancel the reservation and issue a full credit refund back into the employee's wallet.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setCancellingId(null)}
                  className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
                >
                  Close
                </button>
                <button
                  onClick={() => handleCancel(cancellingId)}
                  disabled={cancelLoading}
                  className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow"
                >
                  {cancelLoading ? 'Cancelling...' : 'Confirm Cancel & Refund'}
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* View Details Modal */}
      <AnimatePresence>
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button 
                onClick={() => setSelectedBooking(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">Booking Summary #{selectedBooking.id.substring(0,8)}</h3>
              
              <div className="bg-gray-50 p-4 rounded-xl space-y-2 text-xs border border-gray-200">
                <div className="flex justify-between">
                  <span className="text-gray-500">User Name:</span>
                  <span className="font-bold text-gray-800">{selectedBooking.user_name} ({selectedBooking.user_email})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Resource:</span>
                  <span className="font-bold text-gray-800">{selectedBooking.booking_type} - {selectedBooking.room_name || selectedBooking.seat_number || selectedBooking.day_pass_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Location:</span>
                  <span className="font-bold text-gray-800">{selectedBooking.location_name} &bull; {selectedBooking.branch_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date & Time:</span>
                  <span className="font-bold text-gray-800">{selectedBooking.booking_date} ({selectedBooking.time_slot_label || 'Full Day'})</span>
                </div>
                <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                  <span>Total Amount:</span>
                  <span className="text-[#007bc0]">₹{selectedBooking.amount}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedBooking(null)}
                className="w-full py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminBookings;
