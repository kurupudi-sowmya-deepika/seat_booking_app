import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Loader2, ArrowRight, CheckCircle2, MapPin, Building2, 
  Calendar as CalIcon, Calendar, Clock, ChevronRight, Wallet, AlertCircle,
  Sparkles, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AutoLocationDetector from '../components/AutoLocationDetector';
import { useLocation } from '../context/LocationContext';
import FloorPlanCanvas from '../components/floorplan/FloorPlanCanvas';
import type { LayoutItem } from '../components/floorplan/FloorPlanCanvas';
import { LayoutGrid, Grid3x3 } from 'lucide-react';

export const Booking: React.FC = () => {
  const navigate = useNavigate();
  const { selectedLocation, selectedOffice } = useLocation();
  const [locations, setLocations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [wallet, setWallet] = useState<any>(null);
  
  const [selectedLoc, setSelectedLoc] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  // Time slots come from Admin > Time Slots (real, bookable time_slot_id records) rather
  // than a generated grid - a user can check several to book the same seat across each one.
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);

  const toggleSlot = (slotId: string) => {
    setSelectedSlotIds(prev =>
      prev.includes(slotId) ? prev.filter(id => id !== slotId) : [...prev, slotId]
    );
  };

  const selectedSlotObjs = timeSlots.filter(s => selectedSlotIds.includes(s.id))
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const [seats, setSeats] = useState<any[]>([]);
  const [selectedSeat, setSelectedSeat] = useState<any | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookings, setBookings] = useState<any[]>([]);

  // Employee-facing floor plan view: only shown when the currently selected room
  // actually has a published layout - falls back to the existing grid otherwise
  // (requirement 11: employees only ever see the Published version, never a draft).
  const [floorPlanFloor, setFloorPlanFloor] = useState<any | null>(null);
  const [floorPlanItems, setFloorPlanItems] = useState<LayoutItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'floorplan'>('grid');

  useEffect(() => {
    api.get('/locations/').then(res => setLocations(res.data)).catch(() => {});
    api.get('/wallet/').then(res => setWallet(res.data)).catch(() => {});
    api.get('/bookings/my').then(res => setBookings(res.data || [])).catch(() => {});
    api.get('/time-slots/').then(res => {
      setTimeSlots((res.data || []).filter((s: any) => s.status === 'ACTIVE'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedLocation) setSelectedLoc(selectedLocation);
    if (selectedOffice) setSelectedBranch(selectedOffice);
  }, [selectedLocation, selectedOffice]);

  const handleLocationAutoDetected = (locId: string, branchId?: string) => {
    setSelectedLoc(locId);
    if (branchId) {
      setTimeout(() => setSelectedBranch(branchId), 200);
    }
  };

  useEffect(() => {
    if (selectedLoc) {
      api.get('/branches/', { params: { location_id: selectedLoc } }).then(res => {
        setBranches(res.data.filter((b: any) => b.location_id === selectedLoc));
      }).catch(() => {});
      setSelectedRoom('');
      setSeats([]);
      setSelectedSeat(null);
    }
  }, [selectedLoc]);

  useEffect(() => {
    if (selectedBranch) {
      api.get('/rooms/', { params: { branch_id: selectedBranch, room_type: 'WORKSPACE' } }).then(res => {
        setRooms(res.data);
      }).catch(() => {});
      setSelectedRoom('');
      setSeats([]);
      setSelectedSeat(null);
    }
  }, [selectedBranch]);

  // Look up whether the selected room lives on a published floor plan.
  useEffect(() => {
    setFloorPlanFloor(null);
    setFloorPlanItems([]);
    setViewMode('grid');
    if (!selectedBranch || !selectedRoom) return;

    let cancelled = false;
    (async () => {
      try {
        const floorsRes = await api.get('/floor-plans/floors', { params: { branch_id: selectedBranch } });
        const publishedFloors = (floorsRes.data || []).filter((f: any) => f.published_at);
        for (const f of publishedFloors) {
          const pubRes = await api.get(`/floor-plans/floors/${f.id}/published`);
          const items: any[] = pubRes.data.items || [];
          // SEAT items never carry room_id directly (DB constraint restricts room_id to
          // ROOM-type items) - a seat's room is its parent ROOM item, found via parent_item_id.
          const roomItem = items.find((it) => it.item_type === 'ROOM' && it.room_id === selectedRoom);
          const hasRoom = !!roomItem && items.some((it) => it.item_type === 'SEAT' && it.parent_item_id === roomItem.id);
          if (hasRoom) {
            if (!cancelled) {
              setFloorPlanFloor(pubRes.data.floor);
              setFloorPlanItems(items.map((it) => (it.item_type === 'SEAT' ? { ...it, room_id: roomItem.id === it.parent_item_id ? selectedRoom : it.room_id } : it)));
            }
            return;
          }
        }
      } catch {
        // No published floor plan available for this room - the existing grid view covers it.
      }
    })();

    return () => { cancelled = true; };
  }, [selectedBranch, selectedRoom]);

  const fetchAvailability = async () => {
    if (selectedRoom && date && selectedSlotIds.length > 0) {
      setLoading(true);
      setError('');
      try {
        // A seat only counts as bookable for this selection if it's free in EVERY
        // checked slot - each slot becomes its own booking, so partial availability
        // would otherwise let the user pick a seat that can't actually cover all of them.
        const responses = await Promise.all(selectedSlotIds.map(slotId =>
          api.get(`/bookings/availability/seat`, {
            params: { room_id: selectedRoom, booking_date: date, time_slot_id: slotId }
          })
        ));
        const base = responses[0].data as any[];
        const merged = base.map(seat => {
          const availableEverywhere = responses.every(r =>
            r.data.some((s: any) => s.seat_id === seat.seat_id && s.status === 'AVAILABLE')
          );
          return { ...seat, status: availableEverywhere ? 'AVAILABLE' : 'BOOKED' };
        });
        setSeats(merged);
        // Deselect if currently selected seat is no longer available across all selected slots
        if (selectedSeat && !merged.find((s: any) => s.seat_id === selectedSeat.seat_id && s.status === 'AVAILABLE')) {
          setSelectedSeat(null);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    } else {
      setSeats([]);
    }
  };

  useEffect(() => {
    fetchAvailability();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoom, date, selectedSlotIds.join(',')]);

  const handleBooking = async () => {
    if (!selectedSeat || selectedSlotIds.length === 0) return;
    setBookingLoading(true);
    setError('');

    // Each checked slot is its own booking (its own time_slot_id) for the same seat.
    const created: any[] = [];
    try {
      for (const slotId of selectedSlotIds) {
        const res = await api.post('/bookings/', {
          booking_type: 'SEAT',
          location_id: selectedLoc,
          branch_id: selectedBranch,
          room_id: selectedRoom,
          seat_id: selectedSeat.seat_id,
          booking_date: date,
          time_slot_id: slotId
        });
        created.push(res.data);
      }
      setShowConfirmModal(false);
      navigate('/booking/success?session_id=' + created[0].id);
    } catch (err: any) {
      const detail = err.response?.data?.detail || "Failed to create booking";
      setError(
        created.length > 0
          ? `Booked ${created.length} of ${selectedSlotIds.length} selected slot(s). The rest failed: ${detail}. Check My Bookings for what was created.`
          : detail
      );
      setBookingLoading(false);
      setShowConfirmModal(false);
      fetchAvailability();
    }
  };

  const selectedRoomObj = rooms.find(r => r.id === selectedRoom);
  const selectedLocObj = locations.find(l => l.id === selectedLoc);
  const selectedBranchObj = branches.find(b => b.id === selectedBranch);

  const walletBalance = wallet?.balance ?? 0;
  const seatPrice = selectedSeat ? (selectedSeat.price || 100) : 0;
  const totalPrice = seatPrice * selectedSlotIds.length;
  const remainingBalance = walletBalance - totalPrice;
  const hasSufficientCredits = remainingBalance >= 0;

  return (
    <div className="w-full">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 mb-6">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Book Individual Workspace Seat</h1>
      </div>

      {/* Auto Location Detector */}
      <AutoLocationDetector onLocationDetected={handleLocationAutoDetected} selectedLocationId={selectedLoc} />

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6">
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
              <div className="flex justify-between items-center">
                <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </p>
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
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-[#007bc0] text-white flex items-center justify-center text-xs">1</span> 
              Booking Preferences
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><MapPin size={14}/> Office Location</label>
                <select className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/40 focus:border-[#007bc0] transition-all bg-gray-50/50 text-sm" value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
                  <option value="">Select Location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><Building2 size={14}/> Branch</label>
                <select className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/40 focus:border-[#007bc0] transition-all bg-gray-50/50 text-sm disabled:opacity-50" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} disabled={!selectedLoc}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1.5"><Building2 size={14}/> Room Zone</label>
                {!selectedBranch ? (
                  <div className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded-xl border border-gray-100">Select a branch first to view available room zones.</div>
                ) : rooms.length === 0 ? (
                  <div className="text-xs text-gray-400 italic p-3 bg-gray-50 rounded-xl border border-gray-100">No rooms available in this branch.</div>
                ) : (
                  <div className="flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                    {rooms.map(r => {
                      const isSelected = selectedRoom === r.id;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setSelectedRoom(r.id)}
                          className={`min-w-[140px] max-w-[180px] shrink-0 p-3 rounded-xl border text-left transition-all snap-start ${
                            isSelected 
                              ? 'bg-blue-50 border-[#007bc0] ring-2 ring-[#007bc0]/30 shadow-sm' 
                              : 'bg-gray-50/70 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className={`text-xs font-bold truncate pr-2 ${isSelected ? 'text-[#007bc0]' : 'text-gray-700'}`}>{r.name}</span>
                            {isSelected && <CheckCircle2 size={14} className="text-[#007bc0] shrink-0" />}
                          </div>
                          <div className="text-[10px] font-semibold text-gray-500 mb-2">Cap: {r.capacity}</div>
                          {r.facilities && r.facilities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {r.facilities.slice(0, 2).map((f: any) => (
                                <span key={f.id} className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-gray-200 rounded text-gray-600 truncate max-w-[100px]">
                                  {f.name}
                                </span>
                              ))}
                              {r.facilities.length > 2 && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 bg-gray-200/80 rounded text-gray-500 shrink-0">
                                  +{r.facilities.length - 2}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><CalIcon size={14}/> Booking Date</label>
                <input type="date" className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-[#007bc0]/40 focus:border-[#007bc0] transition-all bg-gray-50/50 text-sm font-semibold" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-gray-600 flex items-center gap-1.5">
                    <Clock size={15} className="text-[#007bc0]" /> Select Time Slots
                  </label>
                  {selectedSlotObjs.length > 0 && (
                    <span className="text-xs font-bold text-[#007bc0] bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                      {selectedSlotObjs.length} slot{selectedSlotObjs.length > 1 ? 's' : ''} selected
                    </span>
                  )}
                </div>

                {timeSlots.length === 0 ? (
                  <div className="text-sm text-gray-400 italic p-3 bg-gray-50 rounded-xl border border-gray-100">
                    No time slots have been configured by an admin yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto pr-1 hide-scrollbar">
                    {[...timeSlots].sort((a, b) => a.start_time.localeCompare(b.start_time)).map(slot => {
                      const isSelected = selectedSlotIds.includes(slot.id);
                      return (
                        <label
                          key={slot.id}
                          className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-blue-50 border-[#007bc0] ring-1 ring-[#007bc0]/30'
                              : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50/40'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSlot(slot.id)}
                            className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0] shrink-0"
                          />
                          <span className={`text-sm font-bold ${isSelected ? 'text-[#005a8c]' : 'text-gray-700'}`}>
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* My Bookings Preview */}
          <div className="bg-white border border-gray-200/80 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-[#007bc0]"></div>
                <h2 className="text-sm font-black text-gray-900 uppercase tracking-wider">
                  My Bookings
                </h2>
              </div>
              <Link to="/my-bookings" className="text-xs font-black text-[#007bc0] hover:underline flex items-center gap-1">
                View All →
              </Link>
            </div>

            {bookings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#007bc0] flex items-center justify-center mb-2">
                  <Calendar size={18} />
                </div>
                <p className="text-xs font-bold text-gray-600">No bookings yet</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Your reservations will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {bookings.slice(0, 5).map((b) => {
                  const isUpcoming = b.status === 'CONFIRMED' && new Date(b.booking_date) >= new Date(new Date().setHours(0, 0, 0, 0));
                  return (
                    <div
                      key={b.id}
                      onClick={() => navigate('/my-bookings')}
                      className="flex items-center justify-between p-2.5 bg-gray-50 hover:bg-blue-50/50 rounded-xl border border-gray-100 hover:border-blue-200 transition cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          isUpcoming ? 'bg-emerald-50 text-emerald-600' : b.status === 'CANCELLED' ? 'bg-red-50 text-red-400' : 'bg-gray-100 text-gray-400'
                        }`}>
                          <Calendar size={13} />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-gray-900 group-hover:text-[#007bc0] transition leading-tight">
                            {b.seat_number ? `Desk ${b.seat_number}` : b.room_name || b.booking_type}
                          </p>
                          <p className="text-[10px] text-gray-400">{b.branch_name || 'Main Campus'} · {b.booking_date}</p>
                        </div>
                      </div>
                      <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase shrink-0 ${
                        isUpcoming ? 'bg-emerald-100 text-emerald-700' : b.status === 'CANCELLED' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {isUpcoming ? 'Upcoming' : b.status === 'CANCELLED' ? 'Cancelled' : 'Done'}
                      </span>
                    </div>
                  );
                })}
                {bookings.length > 5 && (
                  <Link
                    to="/my-bookings"
                    className="block w-full py-1.5 bg-gray-50 hover:bg-gray-100 text-[#007bc0] text-center text-[11px] font-black rounded-xl transition mt-1"
                  >
                    View All {bookings.length} Bookings →
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Step 2: Interactive Seat Map */}
        <div className="lg:col-span-8 flex flex-col h-full">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex-1 flex flex-col relative overflow-hidden min-h-[420px]">
            
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 mb-6">
              <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-[#007bc0] text-white flex items-center justify-center text-xs">2</span>
                Select Workspace Seat
              </h2>

              <div className="flex items-center gap-3">
                {floorPlanFloor && (
                  <div className="flex items-center bg-gray-100 rounded-full p-0.5 text-xs font-bold">
                    <button
                      onClick={() => setViewMode('grid')}
                      className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${viewMode === 'grid' ? 'bg-white shadow text-[#007bc0]' : 'text-gray-500'}`}
                    >
                      <Grid3x3 size={13} /> Grid
                    </button>
                    <button
                      onClick={() => setViewMode('floorplan')}
                      className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 ${viewMode === 'floorplan' ? 'bg-white shadow text-[#007bc0]' : 'text-gray-500'}`}
                    >
                      <LayoutGrid size={13} /> Floor Plan
                    </button>
                  </div>
                )}
                {seats.length > 0 && (
                  <div className="hidden lg:flex flex-wrap gap-4 text-xs font-semibold text-gray-600 bg-gray-50 px-4 py-2 rounded-full border border-gray-200">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-emerald-100 border border-emerald-500"></div> Available (Green)</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-red-100 border border-red-500"></div> Booked (Red)</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-[#007bc0] border border-[#005691]"></div> Selected (Blue)</div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-md bg-gray-200 border border-gray-400"></div> Disabled (Gray)</div>
                  </div>
                )}
              </div>
            </div>

            {viewMode === 'floorplan' && floorPlanFloor ? (
              <div className="flex-grow min-h-[420px]">
                <FloorPlanCanvas
                  mode="view"
                  canvasWidth={floorPlanFloor.canvas_width}
                  canvasHeight={floorPlanFloor.canvas_height}
                  items={floorPlanItems.filter(it => it.item_type !== 'SEAT' || it.room_id === selectedRoom)}
                  bookedSeatIds={new Set(seats.filter(s => s.status === 'BOOKED').map(s => s.seat_id))}
                  onItemActivate={(item) => {
                    if (item.item_type !== 'SEAT') return;
                    if (item.room_id !== selectedRoom) return; // out-of-scope seat on the same floor
                    const matching = seats.find(s => s.seat_id === item.seat_id);
                    if (matching && matching.status !== 'BOOKED') {
                      setSelectedSeat(selectedSeat?.seat_id === matching.seat_id ? null : matching);
                    }
                  }}
                />
              </div>
            ) : !selectedRoom || !date || selectedSlotIds.length === 0 ? (
              <div className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-gray-400 p-8 text-center">
                <MapPin size={48} className="mb-3 opacity-20 text-[#007bc0]" />
                <h4 className="font-semibold text-gray-700 text-sm">Interactive Seat Plan</h4>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">Please select a location, branch, room, date, and at least one time slot to load real-time seat availability.</p>
              </div>
            ) : loading && seats.length === 0 ? (
              <div className="flex-grow flex items-center justify-center">
                <Loader2 className="animate-spin text-[#007bc0]" size={40} />
              </div>
            ) : (
              <div className="flex-grow border border-gray-200 rounded-xl p-8 bg-gray-50/70 flex flex-col items-center justify-center relative shadow-inner">
                {/* Visual Desk Layout Screen Bar */}
                <div className="w-full max-w-md bg-white border border-gray-200 py-1.5 rounded-lg text-center text-xs font-bold text-gray-400 tracking-widest uppercase mb-8 shadow-sm">
                  Focus Zone Front / Window View
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4 justify-center relative z-10 max-w-2xl">
                  {seats.map(seat => {
                    const isBooked = seat.status === 'BOOKED';
                    const isDisabled = seat.status === 'DISABLED';
                    const isSelected = selectedSeat?.seat_id === seat.seat_id;
                    
                    return (
                      <motion.div 
                        key={seat.seat_id} 
                        whileHover={!isBooked && !isDisabled ? { scale: 1.08, y: -2 } : {}}
                        whileTap={!isBooked && !isDisabled ? { scale: 0.95 } : {}}
                        className={`
                          w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold text-xs cursor-pointer transition-all relative shadow-sm
                          ${isBooked ? 'bg-red-50 text-red-500 border border-red-300 cursor-not-allowed opacity-75' : 
                            isDisabled ? 'bg-gray-100 text-gray-400 border border-gray-300 cursor-not-allowed' :
                            isSelected ? 'bg-[#007bc0] text-white border border-[#005691] shadow-lg ring-2 ring-[#007bc0]/50 z-20' : 
                            'bg-white text-emerald-700 border border-emerald-300 hover:border-emerald-500 hover:shadow-md'}
                        `}
                        title={isBooked ? `Booked` : isDisabled ? 'Disabled' : `Available - Seat ${seat.seat_number}`}
                        onClick={() => {
                          if (!isBooked && !isDisabled) setSelectedSeat(isSelected ? null : seat);
                        }}
                      >
                        <div className={`w-6 h-1 rounded-full mb-1 opacity-60 ${isBooked ? 'bg-red-400' : isSelected ? 'bg-white' : 'bg-emerald-500'}`}></div>
                        <span>{seat.seat_number}</span>
                        <span className="text-[10px] font-normal opacity-80">₹{seat.price || 100}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* Action Bar */}
            <AnimatePresence>
              {selectedSeat && (
                <motion.div 
                  initial={{ y: 30, opacity: 0 }} 
                  animate={{ y: 0, opacity: 1 }} 
                  exit={{ y: 30, opacity: 0 }}
                  className="mt-6 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#007bc0] text-white rounded-full flex items-center justify-center font-bold text-sm shadow">
                      {selectedSeat.seat_number}
                    </div>
                    <div>
                      <h4 className="font-bold text-gray-800 text-sm">Seat {selectedSeat.seat_number} Selected</h4>
                      <p className="text-xs text-gray-500">
                        Price: ₹{selectedSeat.price || 100}/slot &bull; Date: {date} &bull; {selectedSlotObjs.map(s => `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`).join(', ')}
                      </p>
                    </div>
                  </div>
                  <button 
                    className="w-full sm:w-auto px-6 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2" 
                    onClick={() => setShowConfirmModal(true)}
                  >
                    <span>Review & Confirm</span>
                    <ArrowRight size={16} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </div>
      </div>

      {/* Booking Review & Credit Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative max-h-[90vh] overflow-y-auto"
            >
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>

              <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                <Sparkles size={18} className="text-[#007bc0]" /> Confirm Workspace Booking
              </h3>
              <p className="text-xs text-gray-500 mb-5">Review reservation summary and pay with prepaid credits.</p>

              {/* Order Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2.5 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Location & Branch:</span>
                  <span className="font-bold text-gray-800">{selectedLocObj?.name} &bull; {selectedBranchObj?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Zone & Seat:</span>
                  <span className="font-bold text-gray-800">{selectedRoomObj?.name} &bull; Seat {selectedSeat?.seat_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-bold text-gray-800">{date}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-gray-500 shrink-0">Time Slots:</span>
                  <span className="font-bold text-gray-800 text-right">
                    {selectedSlotObjs.map(s => `${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)}`).join(', ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Price per slot:</span>
                  <span className="font-bold text-gray-800">₹{seatPrice.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-gray-800">
                  <span>Total ({selectedSlotObjs.length} slot{selectedSlotObjs.length > 1 ? 's' : ''}):</span>
                  <span className="text-[#007bc0]">₹{totalPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Financial Balance Summary */}
              <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-4 space-y-2 text-xs mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Wallet Balance:</span>
                  <span className="font-semibold text-gray-800">₹{walletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits Deducted:</span>
                  <span className="font-semibold text-red-600">-₹{totalPrice.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-blue-200/80 flex justify-between font-extrabold text-xs">
                  <span className="text-gray-700">Balance After Booking:</span>
                  <span className={hasSufficientCredits ? "text-emerald-700 font-bold" : "text-red-600 font-bold"}>
                    ₹{remainingBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              {!hasSufficientCredits ? (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span>Insufficient credits. Please add ₹{Math.abs(remainingBalance).toFixed(2)} or more to proceed.</span>
                  </div>
                  <Link
                    to="/wallet"
                    className="w-full py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                  >
                    <Wallet size={16} /> Add Credits via Stripe
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleBooking}
                  disabled={bookingLoading}
                  className="w-full py-3 bg-[#007bc0] hover:bg-[#005691] text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Confirming & Deducting Credits...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirm Booking Using Credits</span>
                    </>
                  )}
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Booking;
