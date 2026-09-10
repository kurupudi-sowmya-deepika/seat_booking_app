import React, { useEffect, useState } from 'react';
import { AlertCircle, ArrowRight, Building2, Calendar as CalendarIcon, CheckCircle2, Clock, Loader2, MapPin, Users, Wallet, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import AutoLocationDetector from './AutoLocationDetector';

type RoomKind = 'MEETING_ROOM' | 'CONFERENCE_ROOM';
const SLOT_MINUTES = 15;
const FIRST_SLOT_MINUTES = 8 * 60;
const LAST_SLOT_MINUTES = 20 * 60;
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const slotTimes = Array.from({ length: (LAST_SLOT_MINUTES - FIRST_SLOT_MINUTES) / SLOT_MINUTES }, (_, index) => toTime(FIRST_SLOT_MINUTES + index * SLOT_MINUTES));

export default function RoomSlotBooking({ kind }: { kind: RoomKind }) {
  const isConference = kind === 'CONFERENCE_ROOM';
  const roomLabel = isConference ? 'Conference Room' : 'Meeting Room';
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [selection, setSelection] = useState<number[]>([8, 9, 10, 11]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const startIndex = selection[0];
  const endIndex = selection[selection.length - 1];
  const startTime = slotTimes[startIndex];
  const endTime = toTime(FIRST_SLOT_MINUTES + (endIndex + 1) * SLOT_MINUTES);
  const durationMinutes = selection.length * SLOT_MINUTES;
  const durationLabel = durationMinutes < 60 ? `${durationMinutes} min` : `${durationMinutes / 60} hr${durationMinutes === 60 ? '' : 's'}`;
  const durationHours = durationMinutes / 60;

  useEffect(() => { api.get('/locations/').then(res => setLocations(res.data)).catch(() => {}); api.get('/wallet/').then(res => setWallet(res.data)).catch(() => {}); }, []);
  useEffect(() => { if (!selectedLoc) return; api.get('/branches/').then(res => setBranches(res.data.filter((branch: any) => branch.location_id === selectedLoc))).catch(() => {}); setSelectedBranch(''); setRooms([]); setSelectedRoom(null); }, [selectedLoc]);

  const fetchRoomAvailability = async () => {
    if (!selectedBranch) return;
    setLoading(true); setError('');
    try {
      const response = await api.get('/bookings/availability/room', { params: { branch_id: selectedBranch, booking_date: date, start_time: `${startTime}:00`, end_time: `${endTime}:00` } });
      setRooms(response.data.filter((room: any) => room.room_type === kind));
    } catch { setError('Could not check room availability. Please try again.'); } finally { setLoading(false); }
  };
  useEffect(() => { fetchRoomAvailability(); }, [selectedBranch, date, startTime, endTime]);

  const chooseSlot = (slotIndex: number) => {
    setSelectedRoom(null);
    setSelection(current => {
      if (current.length > 1 || current[0] === slotIndex) return [slotIndex];
      const from = Math.min(current[0], slotIndex); const to = Math.max(current[0], slotIndex);
      return Array.from({ length: to - from + 1 }, (_, index) => from + index);
    });
  };
  const roomPricePerHour = selectedRoom?.price_per_hour || 0;
  const totalPrice = roomPricePerHour * durationHours;
  const walletBalance = wallet?.balance ?? 0;
  const remainingBalance = walletBalance - totalPrice;
  const hasSufficientCredits = remainingBalance >= 0;
  const selectedLocObj = locations.find(location => location.id === selectedLoc);
  const selectedBranchObj = branches.find(branch => branch.id === selectedBranch);
  const handleBookRoom = async () => {
    if (!selectedRoom) return;
    setBookingLoading(true); setError('');
    try {
      const response = await api.post('/bookings/', { booking_type: kind, location_id: selectedLoc, branch_id: selectedBranch, room_id: selectedRoom.room_id, booking_date: date, start_time: `${startTime}:00`, end_time: `${endTime}:00` });
      navigate(`/booking/success?session_id=${response.data.id}`);
    } catch (err: any) { setError(err.response?.data?.detail || `Failed to book ${roomLabel}`); setShowConfirmModal(false); fetchRoomAvailability(); } finally { setBookingLoading(false); }
  };
  return <div className="w-full space-y-6 font-['Segoe_UI',Arial,sans-serif]">
    <div className="flex items-center gap-2"><div className="flex h-7 w-7 items-center justify-center rounded-sm bg-[#0084C6] text-white"><Building2 size={16} /></div><div><h1 className="text-2xl font-semibold text-[#1F2937]">Book a {roomLabel}</h1><p className="text-sm text-gray-500">Select consecutive 15-minute slots for your reservation.</p></div></div>
    <AutoLocationDetector onLocationDetected={(locationId, branchId) => { setSelectedLoc(locationId); if (branchId) setTimeout(() => setSelectedBranch(branchId), 200); }} selectedLocationId={selectedLoc} />
    <AnimatePresence>{error && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between rounded-lg border-l-4 border-[#EA0016] bg-red-50 p-4 text-sm text-red-800"><span className="flex items-center gap-2"><AlertCircle size={16} />{error}</span>{error.includes('Insufficient') && <Link to="/wallet" className="font-semibold underline">Add credits</Link>}</motion.div>}</AnimatePresence>
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12"><aside className="space-y-6 lg:col-span-4"><section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-base font-bold text-gray-800">1. Choose location and date</h2><div className="space-y-4"><label className="block text-xs font-semibold text-gray-600"><span className="mb-1.5 flex items-center gap-1"><MapPin size={14} />Office location</span><select aria-label="Office location" className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm" value={selectedLoc} onChange={event => setSelectedLoc(event.target.value)}><option value="">Select location</option>{locations.map(location => <option key={location.id} value={location.id}>{location.name} ({location.city})</option>)}</select></label><label className="block text-xs font-semibold text-gray-600"><span className="mb-1.5 flex items-center gap-1"><Building2 size={14} />Branch</span><select aria-label="Branch" disabled={!selectedLoc} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm disabled:opacity-50" value={selectedBranch} onChange={event => setSelectedBranch(event.target.value)}><option value="">Select branch</option>{branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label className="block text-xs font-semibold text-gray-600"><span className="mb-1.5 flex items-center gap-1"><CalendarIcon size={14} />Date</span><input aria-label="Booking date" type="date" min={new Date().toISOString().split('T')[0]} className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5 text-sm" value={date} onChange={event => setDate(event.target.value)} /></label></div></section><section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"><div className="mb-4 flex items-start justify-between gap-3"><div><h2 className="text-base font-bold text-gray-800">2. Select time slots</h2><p className="mt-1 text-xs text-gray-500">Click a start time, then an end slot to select a continuous block.</p></div><span className="shrink-0 rounded-full bg-[#EAF4FA] px-2.5 py-1 text-xs font-bold text-[#006FA8]">{durationLabel}</span></div><div className="grid grid-cols-4 gap-2" role="group" aria-label="15 minute booking slots">{slotTimes.map((slot, index) => { const active = selection.includes(index); return <button key={slot} type="button" aria-pressed={active} onClick={() => chooseSlot(index)} className={`min-h-10 rounded-lg border px-1 py-2 text-xs font-semibold transition ${active ? 'border-[#0084C6] bg-[#0084C6] text-white shadow-sm' : 'border-gray-200 bg-white text-gray-700 hover:border-[#0084C6] hover:bg-[#EAF4FA]'}`}>{slot}</button>; })}</div><div className="mt-4 rounded-lg bg-[#EAF4FA] p-3 text-xs text-[#1F2937]"><Clock size={14} className="mr-1 inline text-[#0084C6]" /><strong>{startTime}–{endTime}</strong> · {selection.length} × 15-minute slot{selection.length === 1 ? '' : 's'}</div></section></aside>
    <main className="lg:col-span-8"><section className="min-h-[420px] rounded-xl border border-gray-200 bg-white p-6 shadow-sm"><h2 className="mb-5 text-base font-bold text-gray-800">3. Available {isConference ? 'conference rooms' : 'meeting rooms'}</h2>{!selectedBranch ? <div className="flex h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 text-center text-gray-500"><Building2 size={42} className="mb-3 text-[#0084C6] opacity-50" /><p className="font-semibold">Choose a branch to see available rooms</p></div> : loading ? <div className="flex h-64 items-center justify-center"><Loader2 className="animate-spin text-[#0084C6]" size={36} /></div> : rooms.length === 0 ? <div className="flex h-64 items-center justify-center rounded-xl border border-gray-200 text-sm text-gray-500">No {roomLabel.toLowerCase()}s are available for this selection.</div> : <div className="grid grid-cols-1 gap-5 md:grid-cols-2">{rooms.map(room => { const unavailable = room.status === 'UNAVAILABLE'; const selected = selectedRoom?.room_id === room.room_id; return <button type="button" key={room.room_id} disabled={unavailable} onClick={() => setSelectedRoom(room)} className={`rounded-xl border-2 p-5 text-left transition ${unavailable ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60' : selected ? 'border-[#0084C6] bg-[#EAF4FA] ring-2 ring-[#0084C6]/20' : 'border-gray-200 bg-white hover:border-[#0084C6] hover:shadow-md'}`}><div className="flex items-start justify-between gap-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${unavailable ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{room.status}</span><span className="text-sm font-bold text-gray-900">₹{room.price_per_hour}/hr</span></div><h3 className="mt-3 text-lg font-bold text-gray-800">{room.name}</h3><p className="mt-2 flex items-center gap-1 text-xs text-gray-500"><Users size={14} className="text-[#0084C6]" />Capacity: {room.capacity} people</p><div className="mt-4 flex flex-wrap gap-1">{(room.facilities || []).map((facility: string) => <span key={facility} className="rounded bg-gray-100 px-2 py-1 text-[10px] text-gray-600">{facility}</span>)}</div><div className="mt-5 flex justify-between border-t border-gray-100 pt-3 text-xs"><span className="text-gray-500">{durationLabel}</span><strong>₹{(room.price_per_hour * durationHours).toFixed(2)}</strong></div></button>; })}</div>}{selectedRoom && <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-xl border border-[#B7DDF1] bg-[#EAF4FA] p-4 sm:flex-row"><div><strong className="text-sm text-gray-800">{selectedRoom.name}</strong><p className="mt-1 text-xs text-gray-600">{date} · {startTime}–{endTime} · {durationLabel} · ₹{totalPrice.toFixed(2)}</p></div><button onClick={() => setShowConfirmModal(true)} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#0084C6] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#006FA8] sm:w-auto">Review and book <ArrowRight size={16} /></button></div>}</section></main></div>
    <AnimatePresence>{showConfirmModal && selectedRoom && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"><motion.div initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .96 }} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"><button aria-label="Close booking review" onClick={() => setShowConfirmModal(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button><h3 className="text-lg font-bold text-gray-800">Confirm {roomLabel} booking</h3><p className="mt-1 text-sm text-gray-500">Your selected 15-minute slots will be reserved together.</p><div className="mt-5 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm"><p className="flex justify-between gap-4"><span>Location</span><strong className="text-right">{selectedLocObj?.name} · {selectedBranchObj?.name}</strong></p><p className="flex justify-between gap-4"><span>Room</span><strong>{selectedRoom.name}</strong></p><p className="flex justify-between gap-4"><span>Schedule</span><strong>{date} · {startTime}–{endTime}</strong></p><p className="flex justify-between gap-4"><span>Duration</span><strong>{durationLabel}</strong></p><p className="flex justify-between border-t border-gray-200 pt-3 font-bold"><span>Total</span><span className="text-[#0084C6]">₹{totalPrice.toFixed(2)}</span></p></div><div className="mt-4 rounded-lg bg-[#EAF4FA] p-3 text-sm"><p className="flex justify-between"><span>Wallet balance</span><strong>₹{walletBalance.toFixed(2)}</strong></p><p className="mt-1 flex justify-between"><span>After booking</span><strong className={hasSufficientCredits ? 'text-emerald-700' : 'text-red-700'}>₹{remainingBalance.toFixed(2)}</strong></p></div>{!hasSufficientCredits ? <Link to="/wallet" className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0084C6] py-3 text-sm font-bold text-white"><Wallet size={16} />Add credits</Link> : <button disabled={bookingLoading} onClick={handleBookRoom} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#0084C6] py-3 text-sm font-bold text-white disabled:opacity-60">{bookingLoading ? <><Loader2 size={16} className="animate-spin" />Booking…</> : <><CheckCircle2 size={17} />Confirm booking</>}</button>}</motion.div></div>}</AnimatePresence>
  </div>;
}
