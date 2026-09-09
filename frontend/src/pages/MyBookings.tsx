import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Calendar, MapPin, CreditCard, Loader2, ChevronRight, Clock, Trash2, ExternalLink } from 'lucide-react';
import { motion } from 'framer-motion';

const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/bookings/my');
        const sorted = res.data.sort((a: any, b: any) => 
          new Date(b.booking_date).getTime() - new Date(a.booking_date).getTime()
        );
        setBookings(sorted);
      } catch (err) {
        console.error('Failed to fetch bookings', err);
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
  }, []);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'CONFIRMED': return <span className="px-3 py-1 bg-green-100 text-green-700 border border-green-200 rounded-full text-xs font-bold uppercase tracking-wider">Confirmed</span>;
      case 'PENDING': return <span className="px-3 py-1 bg-amber-100 text-amber-700 border border-amber-200 rounded-full text-xs font-bold uppercase tracking-wider">Pending Payment</span>;
      case 'CANCELLED': return <span className="px-3 py-1 bg-red-100 text-red-700 border border-red-200 rounded-full text-xs font-bold uppercase tracking-wider">Cancelled</span>;
      default: return <span className="px-3 py-1 bg-gray-100 text-gray-700 border border-gray-200 rounded-full text-xs font-bold uppercase tracking-wider">{status}</span>;
    }
  };

  const containerVars = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">My Bookings</h1>
      </div>

      {loading ? (
        <div className="flex justify-center items-center min-h-[40vh]">
          <Loader2 className="animate-spin text-[#007bc0]" size={40} />
        </div>
      ) : bookings.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-white border border-gray-200 rounded-xl p-12 text-center shadow-sm max-w-2xl mx-auto mt-12">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar size={32} className="text-gray-400" />
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">No active bookings</h3>
          <p className="text-gray-500 mb-8">You haven't made any workspace reservations yet.</p>
          <button className="bg-[#007bc0] hover:bg-[#005691] text-white px-6 py-2.5 rounded-lg font-medium transition-all shadow-sm" onClick={() => window.location.href = '/booking'}>
            Book a Workspace
          </button>
        </motion.div>
      ) : (
        <motion.div variants={containerVars} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {bookings.map(booking => (
            <motion.div variants={itemVars} key={booking.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 group flex flex-col">
              
              {/* Card Header */}
              <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                {getStatusBadge(booking.status)}
                <span className="text-xs font-mono text-gray-400">#{booking.id.substring(0,8).toUpperCase()}</span>
              </div>
              
              {/* Card Body */}
              <div className="p-6 flex-grow space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-[#007bc0]/10 flex items-center justify-center text-[#007bc0] shrink-0">
                    <MapPin size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Seat {booking.seat_id}</h3>
                    <p className="text-sm text-gray-500">Main Office • Workspace A</p>
                  </div>
                </div>

                <div className="pt-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Calendar size={16} className="text-gray-400" />
                    <span className="font-medium text-gray-800">{new Date(booking.booking_date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <Clock size={16} className="text-gray-400" />
                    <span>09:00 AM - 05:00 PM</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <CreditCard size={16} className="text-gray-400" />
                    <span>₹{booking.amount}</span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
                {booking.status === 'PENDING' && (
                  <button className="flex-1 bg-[#007bc0] hover:bg-[#005691] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
                    Pay Now
                  </button>
                )}
                {booking.status === 'CONFIRMED' && (
                  <>
                    <button className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <ExternalLink size={16} /> View
                    </button>
                    <button className="flex-1 bg-white border border-red-200 hover:bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                      <Trash2 size={16} /> Cancel
                    </button>
                  </>
                )}
                {booking.status === 'CANCELLED' && (
                  <button className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors" disabled>
                    Archived
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default MyBookings;
