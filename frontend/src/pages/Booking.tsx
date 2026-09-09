import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, ArrowRight, CheckCircle2, MapPin, Building2, Calendar as CalIcon, Clock, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  useEffect(() => {
    api.get('/locations/').then(res => setLocations(res.data)).catch(() => {});
    api.get('/time-slots/').then(res => setTimeSlots(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedLoc) {
      api.get('/branches/').then(res => {
        setBranches(res.data.filter((b: any) => b.location_id === selectedLoc));
      }).catch(() => {});
      setSelectedBranch('');
      setSelectedRoom('');
      setSeats([]);
    }
  }, [selectedLoc]);

  useEffect(() => {
    if (selectedBranch) {
      api.get('/rooms/').then(res => {
        setRooms(res.data.filter((r: any) => r.branch_id === selectedBranch));
      }).catch(() => {});
      setSelectedRoom('');
      setSeats([]);
    }
  }, [selectedBranch]);

  const fetchAvailability = async () => {
    if (selectedRoom && date && selectedTime) {
      setLoading(true);
      try {
        const res = await api.get(`/bookings/availability`, {
          params: { room_id: selectedRoom, booking_date: date, time_slot_id: selectedTime }
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
      if (res.data.id) {
        navigate('/booking/success?session_id=' + res.data.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to create booking");
      setLoading(false);
      fetchAvailability();
      setSelectedSeat(null);
    }
  };

  // Animation variants
  const containerVars = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.1 } } };
  const itemVars = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <div className="w-full">
      {/* Breadcrumb / Title */}
      <div className="flex items-center gap-2 mb-8">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Book Workspace</h1>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
              <div className="flex justify-between items-center">
                <p className="text-sm text-red-700 font-medium">{error}</p>
                {error.includes("Insufficient") && (
                  <Link to="/wallet" className="text-sm font-bold text-red-700 hover:underline">Add Credits &rarr;</Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Step 1: Filters */}
        <motion.div variants={containerVars} initial="hidden" animate="show" className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#007bc0] text-white flex items-center justify-center text-xs">1</span> 
              Booking Details
            </h2>

            <div className="space-y-5">
              <motion.div variants={itemVars}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"><MapPin size={16}/> Location</label>
                <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/50 focus:border-[#007bc0] transition-all bg-gray-50/50" value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
                  <option value="">Select Location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </motion.div>

              <motion.div variants={itemVars}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"><Building2 size={16}/> Branch</label>
                <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/50 focus:border-[#007bc0] transition-all bg-gray-50/50 disabled:opacity-50" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} disabled={!selectedLoc}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </motion.div>

              <motion.div variants={itemVars}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"><Building2 size={16}/> Room</label>
                <select className="w-full border border-gray-300 rounded-lg px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/50 focus:border-[#007bc0] transition-all bg-gray-50/50 disabled:opacity-50" value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} disabled={!selectedBranch}>
                  <option value="">Select Room</option>
                  {rooms.map(r => <option key={r.id} value={r.id}>{r.name} (Cap: {r.capacity})</option>)}
                </select>
              </motion.div>

              <div className="grid grid-cols-2 gap-4">
                <motion.div variants={itemVars}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"><CalIcon size={16}/> Date</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/50 focus:border-[#007bc0] transition-all bg-gray-50/50 text-sm" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </motion.div>

                <motion.div variants={itemVars}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2"><Clock size={16}/> Time</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/50 focus:border-[#007bc0] transition-all bg-gray-50/50 text-sm" value={selectedTime} onChange={e => setSelectedTime(e.target.value)}>
                    <option value="">Time</option>
                    {timeSlots.map(t => <option key={t.id} value={t.id}>{t.start_time.substring(0,5)}-{t.end_time.substring(0,5)}</option>)}
                  </select>
                </motion.div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Step 2: Seat Map */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm flex-1 flex flex-col relative overflow-hidden">
            
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#007bc0] text-white flex items-center justify-center text-xs">2</span> 
                Select Seat
              </h2>
              
              {seats.length > 0 && (
                <div className="flex gap-4 text-xs font-medium text-gray-600 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-100 border border-green-500"></div> Available</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-100 border border-red-500"></div> Booked</div>
                  <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-[#007bc0] border border-[#005691] shadow-[0_0_8px_rgba(0,123,192,0.4)]"></div> Selected</div>
                </div>
              )}
            </div>
            
            {!selectedRoom || !date || !selectedTime ? (
              <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-gray-400">
                <MapPin size={48} className="mb-4 opacity-20" />
                <p>Complete booking details to view the floor plan</p>
              </div>
            ) : loading && seats.length === 0 ? (
              <div className="flex-grow flex items-center justify-center">
                <Loader2 className="animate-spin text-[#007bc0]" size={40} />
              </div>
            ) : (
              <div className="flex-grow border border-gray-200 rounded-xl p-8 bg-gray-50 flex items-center justify-center relative shadow-inner">
                {/* Decorative Floor Plan Lines */}
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
                
                <div className="flex flex-wrap gap-4 justify-center relative z-10 max-w-2xl">
                  {seats.map(seat => {
                    const isBooked = seat.status === 'BOOKED';
                    const isSelected = selectedSeat?.seat_id === seat.seat_id;
                    
                    return (
                      <motion.div 
                        key={seat.seat_id} 
                        whileHover={!isBooked ? { scale: 1.1, y: -2 } : {}}
                        whileTap={!isBooked ? { scale: 0.95 } : {}}
                        className={`
                          w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm cursor-pointer transition-colors relative shadow-sm
                          ${isBooked ? 'bg-red-50 text-red-400 border border-red-200 cursor-not-allowed opacity-60' : 
                            isSelected ? 'bg-[#007bc0] text-white border border-[#005691] shadow-[0_4px_12px_rgba(0,123,192,0.3)] z-20' : 
                            'bg-white text-green-600 border border-green-200 hover:border-green-400 hover:shadow-md'}
                        `}
                        title={isBooked ? `Booked by: ${seat.booked_by}` : 'Available'}
                        onClick={() => {
                          if (!isBooked) setSelectedSeat(isSelected ? null : seat);
                        }}
                      >
                        {/* Desk Top Line */}
                        <div className={`absolute -top-1 left-1/4 right-1/4 h-1.5 rounded-t-sm opacity-50 ${isBooked ? 'bg-red-300' : isSelected ? 'bg-white' : 'bg-green-300'}`}></div>
                        {seat.seat_number}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Checkout Action Bar */}
            <AnimatePresence>
              {selectedSeat && (
                <motion.div 
                  initial={{ y: 50, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: 50, opacity: 0 }}
                  className="absolute bottom-6 left-6 right-6 bg-white border border-[#007bc0]/30 shadow-[0_8px_30px_rgba(0,123,192,0.15)] rounded-xl p-4 flex justify-between items-center"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#007bc0]/10 rounded-full flex items-center justify-center text-[#007bc0]">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800">Seat {selectedSeat.seat_number}</h4>
                      <p className="text-xs text-gray-500 font-medium">Ready for checkout</p>
                    </div>
                  </div>
                  <button 
                    className="bg-[#007bc0] hover:bg-[#005691] text-white px-6 py-2.5 rounded-lg font-medium transition-all flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-70" 
                    onClick={handleBooking}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><span className="hidden sm:inline">Confirm Booking</span> <ArrowRight size={18} /></>}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Booking;
