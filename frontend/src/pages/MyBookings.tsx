import React, { useEffect, useState } from 'react';
import api from '../services/api';
import { Calendar, MapPin, CreditCard, Loader2 } from 'lucide-react';

const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await api.get('/bookings/my');
        // Sort bookings by date descending
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
      case 'CONFIRMED': return <span className="badge badge-success">Confirmed</span>;
      case 'PENDING': return <span className="badge badge-warning">Pending Payment</span>;
      case 'CANCELLED': return <span className="badge badge-danger">Cancelled</span>;
      default: return <span className="badge">{status}</span>;
    }
  };

  if (loading) {
    return <div className="flex-center min-h-[50vh]"><Loader2 className="animate-spin text-primary-color" size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Bookings</h1>
        <p className="text-text-secondary">View and manage your workspace reservations.</p>
      </div>

      {bookings.length === 0 ? (
        <div className="glass-panel p-12 text-center text-text-secondary">
          <Calendar size={48} className="mx-auto mb-4 opacity-50" />
          <p>You don't have any bookings yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bookings.map(booking => (
            <div key={booking.id} className="glass-panel p-6 flex flex-col hover:border-[var(--primary-color)] transition-colors">
              <div className="flex justify-between items-start mb-4">
                {getStatusBadge(booking.status)}
                <span className="text-sm text-text-muted">ID: {booking.id.substring(0,8)}</span>
              </div>
              
              <div className="space-y-3 mb-6 flex-grow">
                <div className="flex items-center gap-3 text-white font-medium text-lg">
                  <MapPin size={18} className="text-primary-color" />
                  <span>Seat {booking.seat_id}</span> {/* In a real app we'd fetch the seat number string */}
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <Calendar size={18} />
                  <span>{booking.booking_date}</span>
                </div>
                <div className="flex items-center gap-3 text-text-secondary">
                  <CreditCard size={18} />
                  <span>₹{booking.amount}</span>
                </div>
              </div>

              <div className="border-t border-[var(--border-color)] pt-4 mt-auto">
                {booking.status === 'PENDING' && (
                  <button className="btn btn-primary w-full text-sm">Pay Now</button>
                )}
                {booking.status === 'CONFIRMED' && (
                  <button className="btn btn-secondary w-full text-sm text-danger-color hover:bg-[rgba(239,68,68,0.1)] hover:border-danger-color">
                    Cancel Booking
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyBookings;
