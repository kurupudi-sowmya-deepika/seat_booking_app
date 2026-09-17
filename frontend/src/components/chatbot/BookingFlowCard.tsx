import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Calendar as CalIcon, Clock, Users, Minus, Plus, Search, CheckCircle2, ArrowLeft, AlertCircle, CalendarPlus, Loader2 } from 'lucide-react';
import api from '../../services/api';
import RoomCard from '../RoomCard';

interface BookingFormPrefill {
  booking_type?: 'MEETING_ROOM' | 'CONFERENCE_ROOM';
  branch_id?: string;
  branch_name?: string;
  location_id?: string;
  booking_date?: string;
  start_time?: string;
  end_time?: string;
  attendees?: number;
  required_amenities?: string[];
}

interface BookingFlowCardProps {
  prefill: BookingFormPrefill;
}

type Step = 'form' | 'results' | 'review' | 'confirmed';

const todayIso = () => new Date().toISOString().split('T')[0];

/** Interactive booking form embedded in a single chat message, replacing the old
 * sequential-question flow. Reuses the exact same backend endpoints the manual
 * booking pages already use (branches, rooms, availability/room, bookings) - no
 * new backend surface for search/booking. See RoomSlotBooking.tsx for the manual
 * page this mirrors. */
export const BookingFlowCard: React.FC<BookingFlowCardProps> = ({ prefill }) => {
  const navigate = useNavigate();
  const isConference = prefill.booking_type === 'CONFERENCE_ROOM';

  const [step, setStep] = useState<Step>('form');
  const [branches, setBranches] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [floors, setFloors] = useState<number[]>([]);

  const [branchId, setBranchId] = useState(prefill.branch_id || '');
  const [locationId, setLocationId] = useState(prefill.location_id || '');
  const [floor, setFloor] = useState<string>('');
  const [date, setDate] = useState(prefill.booking_date || todayIso());
  const [startTime, setStartTime] = useState(prefill.start_time || '');
  const [endTime, setEndTime] = useState(prefill.end_time || '');
  const [attendees, setAttendees] = useState(prefill.attendees || 1);
  const [amenities, setAmenities] = useState<string[]>(prefill.required_amenities || []);

  const [formError, setFormError] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<any | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<any | null>(null);
  const [calendarError, setCalendarError] = useState('');

  const bookingTypeLabel = isConference ? 'Conference Room' : 'Meeting Room';
  const roomType = prefill.booking_type || 'MEETING_ROOM';

  useEffect(() => {
    api.get('/branches/').then(res => setBranches(res.data || [])).catch(() => {});
    api.get('/facilities/').then(res => setFacilities(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!branchId) { setFloors([]); return; }
    api.get('/rooms/', { params: { branch_id: branchId, room_type: roomType } }).then(res => {
      const distinct = Array.from(new Set((res.data || []).map((r: any) => r.floor).filter((f: any) => f !== null && f !== undefined))) as number[];
      setFloors(distinct.sort((a, b) => a - b));
    }).catch(() => {});
  }, [branchId, roomType]);

  const onBranchChange = (id: string) => {
    setBranchId(id);
    setFloor('');
    const b = branches.find(br => br.id === id);
    setLocationId(b?.location_id || '');
  };

  const toggleAmenity = (name: string) => {
    setAmenities(prev => prev.includes(name) ? prev.filter(a => a !== name) : [...prev, name]);
  };

  const duration = useMemo(() => {
    if (!startTime || !endTime) return 60;
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    return Math.max(15, (eh * 60 + em) - (sh * 60 + sm));
  }, [startTime, endTime]);

  const handleFindRooms = async () => {
    setFormError('');
    if (!branchId) return setFormError('Please select a branch.');
    if (!date) return setFormError('Please select a date.');
    if (date < todayIso()) return setFormError('Booking date cannot be in the past.');
    if (!startTime || !endTime) return setFormError('Please select a start and end time.');
    if (endTime <= startTime) return setFormError('End time must be after start time.');
    if (attendees < 1) return setFormError('Attendees must be at least 1.');

    setSearching(true);
    try {
      const res = await api.get('/bookings/availability/room', {
        params: { branch_id: branchId, booking_date: date, start_time: `${startTime}:00`, end_time: `${endTime}:00` }
      });
      const filtered = (res.data || []).filter((r: any) =>
        r.room_type === roomType &&
        r.capacity >= attendees &&
        (!floor || String(r.floor) === floor) &&
        amenities.every(a => (r.facilities || []).includes(a))
      );
      setResults(filtered);
      setStep('results');
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to search for available rooms.');
    } finally {
      setSearching(false);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedRoom) return;
    setConfirming(true);
    setConfirmError('');
    try {
      const res = await api.post('/bookings/', {
        booking_type: roomType,
        location_id: locationId,
        branch_id: branchId,
        room_id: selectedRoom.room_id,
        booking_date: date,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
        number_of_people: attendees,
        required_amenities: amenities.length ? amenities : undefined,
      });
      setConfirmedBooking(res.data);
      setStep('confirmed');
    } catch (err: any) {
      setConfirmError(err.response?.data?.detail || 'Failed to complete booking.');
    } finally {
      setConfirming(false);
    }
  };

  const handleAddToCalendar = async () => {
    if (!confirmedBooking) return;
    try {
      const res = await api.get(`/bookings/${confirmedBooking.id}/ical`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `seat_booking_${confirmedBooking.id}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setCalendarError('Failed to generate the calendar file.');
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-200 bg-white overflow-hidden text-xs">
      <div className="px-3.5 py-2.5 bg-gradient-to-r from-[#005691] to-[#007bc0] text-white font-bold text-xs">
        {step === 'form' && `Book a ${bookingTypeLabel}`}
        {step === 'results' && `Available ${bookingTypeLabel}s`}
        {step === 'review' && 'Selected Room'}
        {step === 'confirmed' && 'Booking Confirmed'}
      </div>

      <div className="p-3.5 space-y-3">
        {step === 'form' && (
          <>
            <div>
              <label className="block font-semibold text-gray-600 mb-1 flex items-center gap-1.5"><Building2 size={12} /> Branch</label>
              <select
                value={branchId} onChange={e => onBranchChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-gray-50 text-[11px] outline-none focus:ring-2 focus:ring-[#007bc0]/30"
              >
                <option value="">Select Branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            {floors.length > 0 && (
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Floor (optional)</label>
                <select value={floor} onChange={e => setFloor(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-gray-50 text-[11px] outline-none focus:ring-2 focus:ring-[#007bc0]/30">
                  <option value="">Any floor</option>
                  {floors.map(f => <option key={f} value={f}>Floor {f}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="block font-semibold text-gray-600 mb-1 flex items-center gap-1.5"><CalIcon size={12} /> Booking Date</label>
              <input type="date" min={todayIso()} value={date} onChange={e => setDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-gray-50 text-[11px] outline-none focus:ring-2 focus:ring-[#007bc0]/30" />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold text-gray-600 mb-1 flex items-center gap-1.5"><Clock size={12} /> Start Time</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-gray-50 text-[11px] outline-none focus:ring-2 focus:ring-[#007bc0]/30" />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1 flex items-center gap-1.5"><Clock size={12} /> End Time</label>
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-gray-50 text-[11px] outline-none focus:ring-2 focus:ring-[#007bc0]/30" />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-gray-600 mb-1 flex items-center gap-1.5"><Users size={12} /> Number of Attendees</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setAttendees(a => Math.max(1, a - 1))} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"><Minus size={12} /></button>
                <span className="flex-1 text-center font-bold text-gray-800">{attendees}</span>
                <button type="button" onClick={() => setAttendees(a => a + 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700"><Plus size={12} /></button>
              </div>
            </div>

            {facilities.length > 0 && (
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Amenities</label>
                <div className="flex flex-wrap gap-1.5">
                  {facilities.map(f => (
                    <label key={f.id} className={`flex items-center gap-1 px-2 py-1 rounded-md border cursor-pointer text-[10px] font-semibold ${amenities.includes(f.name) ? 'bg-blue-50 border-[#007bc0] text-[#005691]' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      <input type="checkbox" checked={amenities.includes(f.name)} onChange={() => toggleAmenity(f.name)} className="w-3 h-3" />
                      {f.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {formError && <div className="flex items-center gap-1.5 text-red-600 text-[11px]"><AlertCircle size={12} /> {formError}</div>}

            <button
              onClick={handleFindRooms} disabled={searching}
              className="w-full py-2 bg-[#007bc0] hover:bg-[#005691] text-white rounded-lg font-bold text-xs shadow flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {searching ? <><Loader2 size={13} className="animate-spin" /> Searching...</> : <><Search size={13} /> Find Available Rooms</>}
            </button>
          </>
        )}

        {step === 'results' && (
          <>
            {results.length === 0 ? (
              <p className="text-gray-500 text-[11px]">No rooms matched. Try a different time, floor, or fewer required amenities.</p>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                {results.filter(r => r.status === 'AVAILABLE').map(r => (
                  <RoomCard key={r.room_id} room={r} selected={false} duration={duration} onSelect={() => { setSelectedRoom(r); setStep('review'); }} />
                ))}
              </div>
            )}
            <button onClick={() => setStep('form')} className="w-full py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5">
              <ArrowLeft size={12} /> Change Search
            </button>
          </>
        )}

        {step === 'review' && selectedRoom && (
          <>
            <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-2.5 space-y-1 text-[11px] text-gray-700">
              <div className="font-black text-sm text-gray-900">{selectedRoom.name}</div>
              <div>{bookingTypeLabel}{selectedRoom.floor ? ` · Floor ${selectedRoom.floor}` : ''}</div>
              <div>Capacity: {selectedRoom.capacity}</div>
              <div><strong>Date:</strong> {date}</div>
              <div><strong>Time:</strong> {startTime} – {endTime}</div>
              <div><strong>Attendees:</strong> {attendees}</div>
              {amenities.length > 0 && <div><strong>Amenities:</strong> {amenities.join(', ')}</div>}
              <div className="font-bold text-gray-900">₹{((selectedRoom.price_per_hour * duration) / 60).toFixed(2)}</div>
            </div>
            {confirmError && <div className="flex items-center gap-1.5 text-red-600 text-[11px]"><AlertCircle size={12} /> {confirmError}</div>}
            <div className="flex gap-2">
              <button onClick={() => setStep('results')} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-[11px]">Change Selection</button>
              <button
                onClick={handleConfirmBooking} disabled={confirming}
                className="flex-1 py-2 bg-[#007bc0] hover:bg-[#005691] text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {confirming ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />} Confirm Booking
              </button>
            </div>
          </>
        )}

        {step === 'confirmed' && selectedRoom && confirmedBooking && (
          <>
            <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-xs">
              <CheckCircle2 size={15} /> Booking Confirmed
            </div>
            <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-2.5 space-y-1 text-[11px] text-gray-700">
              <div className="font-black text-sm text-gray-900">{selectedRoom.name}</div>
              <div>{bookingTypeLabel}{selectedRoom.floor ? ` · Floor ${selectedRoom.floor}` : ''}</div>
              <div><strong>Booking ID:</strong> #{String(confirmedBooking.id).substring(0, 8).toUpperCase()}</div>
              <div>{date}</div>
              <div>{startTime} – {endTime}</div>
              <div>{attendees} attendees</div>
              {amenities.length > 0 && <div>{amenities.join(', ')}</div>}
              <div className="font-bold text-gray-900">₹{confirmedBooking.amount}</div>
            </div>
            {calendarError && <div className="flex items-center gap-1.5 text-red-600 text-[11px]"><AlertCircle size={12} /> {calendarError}</div>}
            <div className="flex gap-2">
              <button onClick={() => navigate('/my-bookings')} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-bold text-[11px]">View Booking</button>
              <button
                onClick={handleAddToCalendar}
                className="flex-1 py-2 bg-[#007bc0] hover:bg-[#005691] text-white rounded-lg font-bold text-[11px] flex items-center justify-center gap-1.5"
              >
                <CalendarPlus size={12} /> Add to Calendar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default BookingFlowCard;
