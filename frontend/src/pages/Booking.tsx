import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, CheckCircle2 } from 'lucide-react';

const Booking: React.FC = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  
  const [selectedLoc, setSelectedLoc] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [date, setDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  
  const [seats, setSeats] = useState<any[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Initial load
  useEffect(() => {
    api.get('/locations/').then(res => setLocations(res.data));
    api.get('/time-slots/').then(res => setTimeSlots(res.data));
  }, []);

  // Fetch branches when location changes
  useEffect(() => {
    if (selectedLoc) {
      api.get('/branches/').then(res => {
        setBranches(res.data.filter((b: any) => b.location_id === selectedLoc));
      });
      setSelectedBranch('');
      setSelectedRoom('');
      setSeats([]);
    }
  }, [selectedLoc]);

  // Fetch rooms when branch changes
  useEffect(() => {
    if (selectedBranch) {
      api.get('/rooms/').then(res => {
        setRooms(res.data.filter((r: any) => r.branch_id === selectedBranch));
      });
      setSelectedRoom('');
      setSeats([]);
    }
  }, [selectedBranch]);

  // Fetch seat availability
  const fetchAvailability = async () => {
    if (selectedRoom && date && selectedTime) {
      setLoading(true);
      try {
        const res = await api.get(`/bookings/availability`, {
          params: {
            room_id: selectedRoom,
            booking_date: date,
            time_slot_id: selectedTime
          }
        });
        setSeats(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchAvailability();
  }, [selectedRoom, date, selectedTime]);

  const handleBooking = async () => {
    if (!selectedSeat) return;
    setLoading(true);
    setError('');
    
    try {
      const res = await api.post('/bookings/', {
        seat_id: selectedSeat.seat_id,
        booking_date: date,
        time_slot_id: selectedTime
      });
      
      // With wallet system, booking is confirmed instantly if credits are sufficient
      if (res.data.id) {
        navigate('/booking/success?session_id=' + res.data.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create booking");
      setLoading(false);
      // Refresh availability since the seat might have been booked by someone else
      fetchAvailability();
      setSelectedSeat(null);
    }
  };

  const getSeatClass = (seat: any) => {
    if (seat.status === 'BOOKED') return 'seat booked';
    if (selectedSeat?.seat_id === seat.seat_id) return 'seat selected';
    return 'seat available';
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Book a Workspace</h1>
        <p className="text-text-secondary">Select your location, time, and preferred seat.</p>
      </div>
      
      {error && (
        <div className="badge badge-danger p-4 w-full flex flex-col items-center gap-2 text-center text-sm">
          <span>{error}</span>
          {error.includes("Insufficient credits") && (
            <Link to="/wallet" className="btn btn-secondary text-xs mt-2 bg-white text-black hover:bg-gray-200">
              Go to Wallet to Add Credits
            </Link>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Selection Form */}
        <div className="glass-panel p-6 space-y-4 col-span-1 md:col-span-1">
          <h2 className="text-xl font-semibold mb-4 text-white">Booking Details</h2>
          
          <div className="input-group">
            <label className="input-label">Location</label>
            <select className="input-field" value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
              <option value="">Select Location</option>
              {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          
          <div className="input-group">
            <label className="input-label">Branch</label>
            <select className="input-field" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} disabled={!selectedLoc}>
              <option value="">Select Branch</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Room</label>
            <select className="input-field" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} disabled={!selectedBranch}>
              <option value="">Select Room</option>
              {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (Capacity: {r.capacity})</option>)}
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Date</label>
            <input type="date" className="input-field" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>

          <div className="input-group">
            <label className="input-label">Time Slot</label>
            <select className="input-field" value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
              <option value="">Select Time</option>
              {timeSlots.map(t => <option key={t.id} value={t.id}>{t.start_time} - {t.end_time}</option>)}
            </select>
          </div>
        </div>

        {/* Seat Map */}
        <div className="glass-panel p-6 col-span-1 md:col-span-2 flex flex-col">
          <h2 className="text-xl font-semibold mb-4 text-white">Seat Selection</h2>
          
          {!selectedRoom || !date || !selectedTime ? (
            <div className="flex-grow flex-center border border-dashed border-[var(--border-color)] rounded-lg text-text-muted">
              Please complete booking details to view seat availability.
            </div>
          ) : loading && seats.length === 0 ? (
            <div className="flex-grow flex-center">
              <Loader2 className="animate-spin text-primary-color" size={32} />
            </div>
          ) : (
            <>
              <div className="flex gap-4 mb-8 justify-center text-sm font-medium">
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[var(--surface-color)] border border-[var(--seat-available)]"></div> Available</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[rgba(239,68,68,0.1)] border border-[var(--seat-booked)]"></div> Booked</div>
                <div className="flex items-center gap-2"><div className="w-4 h-4 rounded bg-[var(--seat-selected)] border border-[var(--primary-color)]"></div> Selected</div>
              </div>
              
              <div className="flex-grow border border-[var(--border-color)] rounded-xl p-8 bg-[rgba(0,0,0,0.2)] flex-center flex-wrap gap-4">
                {seats.map(seat => (
                  <div 
                    key={seat.seat_id} 
                    className={getSeatClass(seat)}
                    title={seat.status === 'BOOKED' ? `Booked by: ${seat.booked_by}` : 'Available'}
                    onClick={() => {
                      if (seat.status !== 'BOOKED') {
                        setSelectedSeat(seat.seat_id === selectedSeat?.seat_id ? null : seat);
                      }
                    }}
                  >
                    {seat.seat_number}
                  </div>
                ))}
              </div>

              {selectedSeat && (
                <div className="mt-6 pt-6 border-t border-[var(--border-color)] flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-white">Selected: Seat {selectedSeat.seat_number}</h4>
                    <p className="text-sm text-text-secondary">Ready for checkout</p>
                  </div>
                  <button 
                    className="btn btn-primary gap-2" 
                    onClick={handleBooking}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><CheckCircle2 size={18} /> Proceed to Pay <ArrowRight size={18} /></>}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Booking;
