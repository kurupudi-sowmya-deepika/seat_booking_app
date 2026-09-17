import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle, ArrowRight, Building2, Calendar as CalendarIcon, CheckCircle2, Clock,
  Filter, MapPin, Search, Wallet, X, LayoutGrid, Grid3x3
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useLocation } from '../context/LocationContext';
import RoomCardComponent from './RoomCard';
import AvailabilityTimeline from './AvailabilityTimeline';
import type { TimelineRoom } from './AvailabilityTimeline';
import AmenityBadge from './AmenityBadge';
import EmptyState from './EmptyState';
import LoadingState from './LoadingState';
import PriceSummary from './PriceSummary';
import FloorPlanCanvas from './floorplan/FloorPlanCanvas';
import type { LayoutItem } from './floorplan/FloorPlanCanvas';

type RoomKind = 'MEETING_ROOM' | 'CONFERENCE_ROOM';
const OPEN = 8 * 60;
const CLOSE = 20 * 60;
const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];
const AMENITY_OPTIONS = ['Wi-Fi', 'Display', 'Video Conferencing', 'Whiteboard', 'AC', 'Parking', 'Power Outlet', 'Coffee/Tea'];
const toTime = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const times = Array.from({ length: (CLOSE - OPEN) / 15 }, (_, i) => toTime(OPEN + i * 15));
const durationLabel = (minutes: number) => (minutes < 60 ? `${minutes} min` : `${minutes / 60} hr${minutes === 60 ? '' : 's'}`);

const emptyFilters = {
  amenities: [] as string[],
  capacity: '',
  customCapacity: '',
  floor: '',
  availability: '',
  minPrice: '',
  maxPrice: '',
  search: '',
};

export default function RoomSlotBooking({ kind }: { kind: RoomKind }) {
  const roomLabel = kind === 'CONFERENCE_ROOM' ? 'Conference Room' : 'Meeting Room';
  const navigate = useNavigate();
  const { selectedLocation, selectedOffice, locations, offices, fetchLocations, fetchOffices } = useLocation();
  const [locationId, setLocationId] = useState(selectedLocation || '');
  const [branchId, setBranchId] = useState(selectedOffice || '');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('10:00');
  const [duration, setDuration] = useState(60);
  const [rooms, setRooms] = useState<any[]>([]);
  const [room, setRoom] = useState<any>(null);
  const [timelines, setTimelines] = useState<TimelineRoom[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [wallet, setWallet] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [draftFilters, setDraftFilters] = useState(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState(emptyFilters);

  // Employee-facing floor-plan view: only shown when the branch has a published
  // floor containing a room of this kind - falls back to the existing card grid
  // otherwise (employees only ever see the Published version, never a draft).
  const [floorPlanFloor, setFloorPlanFloor] = useState<any | null>(null);
  const [floorPlanItems, setFloorPlanItems] = useState<LayoutItem[]>([]);
  const [resultsView, setResultsView] = useState<'grid' | 'floorplan'>('grid');

  const startMinutes = Number(startTime.slice(0, 2)) * 60 + Number(startTime.slice(3));
  const permittedDurations = DURATIONS.filter((value) => startMinutes + value <= CLOSE);
  const endTime = toTime(startMinutes + duration);
  const price = ((room?.price_per_hour || 0) * duration) / 60;
  const balance = wallet?.balance ?? 0;
  const loc = locations.find((item) => item.id === locationId);
  const branch = offices.find((item) => item.id === branchId) || { name: '' };

  useEffect(() => {
    fetchLocations();
    api.get('/wallet/').then((r) => setWallet(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedLocation) {
      setLocationId(selectedLocation);
      fetchOffices(selectedLocation);
    }
    if (selectedOffice) setBranchId(selectedOffice);
  }, [selectedLocation, selectedOffice]);

  useEffect(() => {
    if (locationId) fetchOffices(locationId);
  }, [locationId]);

  useEffect(() => {
    if (!permittedDurations.includes(duration)) setDuration(permittedDurations.at(-1) || 15);
  }, [startTime]);

  useEffect(() => {
    if (!branchId) return;
    let current = true;
    setLoading(true);
    setError('');
    api
      .get('/bookings/availability/room', {
        params: { branch_id: branchId, booking_date: date, start_time: `${startTime}:00`, end_time: `${endTime}:00` },
      })
      .then((r) => {
        if (!current) return;
        const matching = r.data.filter((item: any) => item.room_type === kind);
        setRooms(matching);
        setRoom((selected: any) => matching.find((item: any) => item.room_id === selected?.room_id) || null);
      })
      .catch(() => current && setError('Could not check room availability. Please try again.'))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [branchId, date, startTime, endTime, kind]);

  useEffect(() => {
    if (!branchId) {
      setTimelines([]);
      return;
    }
    let current = true;
    setTimelineLoading(true);
    api
      .get('/bookings/availability/rooms/timeline', { params: { branch_id: branchId, booking_date: date, room_type: kind } })
      .then((response) => current && setTimelines(response.data || []))
      .catch(() => current && setError('Could not load the room timeline.'))
      .finally(() => current && setTimelineLoading(false));
    return () => {
      current = false;
    };
  }, [branchId, date, kind]);

  useEffect(() => {
    setFloorPlanFloor(null);
    setFloorPlanItems([]);
    setResultsView('grid');
    if (!branchId) return;

    let cancelled = false;
    (async () => {
      try {
        const floorsRes = await api.get('/floor-plans/floors', { params: { branch_id: branchId } });
        const publishedFloors = (floorsRes.data || []).filter((f: any) => f.published_at);
        for (const f of publishedFloors) {
          const pubRes = await api.get(`/floor-plans/floors/${f.id}/published`);
          const items: any[] = pubRes.data.items || [];
          const hasRoomOfKind = items.some((it) => it.item_type === 'ROOM' && it.room_type === kind);
          if (hasRoomOfKind) {
            if (!cancelled) {
              setFloorPlanFloor(pubRes.data.floor);
              setFloorPlanItems(items);
            }
            return;
          }
        }
      } catch {
        // No published floor plan available for this branch - the existing card grid covers it.
      }
    })();

    return () => { cancelled = true; };
  }, [branchId, kind]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((item: any) => {
      if (appliedFilters.amenities.length > 0) {
        const facilities = item.facilities || [];
        if (!appliedFilters.amenities.every((amenity) => facilities.includes(amenity))) return false;
      }
      if (appliedFilters.capacity === '1-4' && item.capacity > 4) return false;
      if (appliedFilters.capacity === '5-8' && (item.capacity < 5 || item.capacity > 8)) return false;
      if (appliedFilters.capacity === '9-12' && (item.capacity < 9 || item.capacity > 12)) return false;
      if (appliedFilters.capacity === '13-20' && (item.capacity < 13 || item.capacity > 20)) return false;
      if (appliedFilters.capacity === '20+' && item.capacity <= 20) return false;
      if (appliedFilters.customCapacity && item.capacity < Number(appliedFilters.customCapacity)) return false;
      if (appliedFilters.floor && String(item.floor) !== appliedFilters.floor) return false;
      if (appliedFilters.availability === 'AVAILABLE' && item.status !== 'AVAILABLE') return false;
      if (appliedFilters.availability === 'BOOKED' && item.status === 'AVAILABLE') return false;
      if (appliedFilters.minPrice && item.price_per_hour < Number(appliedFilters.minPrice)) return false;
      if (appliedFilters.maxPrice && item.price_per_hour > Number(appliedFilters.maxPrice)) return false;
      if (appliedFilters.search) {
        const query = appliedFilters.search.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(query);
        const facilityMatch = (item.facilities || []).some((f: string) => f.toLowerCase().includes(query));
        if (!nameMatch && !facilityMatch) return false;
      }
      return true;
    });
  }, [rooms, appliedFilters]);

  const filteredTimelines = useMemo(
    () => timelines.filter((item) => filteredRooms.some((roomItem) => roomItem.room_id === item.room_id)),
    [timelines, filteredRooms]
  );

  const floors = useMemo(
    () => Array.from(new Set(rooms.map((item) => item.floor).filter((value: number | null) => value != null))).sort(),
    [rooms]
  );

  const unavailableRoomIds = useMemo(
    () => new Set(filteredRooms.filter((item: any) => item.status !== 'AVAILABLE').map((item: any) => item.room_id)),
    [filteredRooms]
  );

  const submit = async () => {
    if (!room || !locationId || !branchId) {
      setError('Select a location, office, and room before confirming.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const r = await api.post('/bookings/', {
        booking_type: kind,
        location_id: locationId,
        branch_id: branchId,
        room_id: room.room_id,
        booking_date: date,
        start_time: `${startTime}:00`,
        end_time: `${endTime}:00`,
      });
      navigate(`/booking/success?session_id=${r.data.id}`);
    } catch (e: any) {
      setError(e.response?.data?.detail || `Failed to book ${roomLabel}`);
      setReviewing(false);
    } finally {
      setSubmitting(false);
    }
  };

  const onSelectTimelineSlot = (roomId: string, time: string) => {
    const match = rooms.find((item) => item.room_id === roomId);
    if (match) setRoom(match);
    setStartTime(time);
  };

  return (
    <div className="w-full space-y-8">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-sm bg-[#007bc0] text-white">
          <Building2 size={16} />
        </span>
        <div>
          <h1 className="page-heading">Book a {roomLabel}</h1>
          <p className="text-[15px] text-gray-500">Choose a room card, then pick an available time on the timeline.</p>
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-between rounded-lg border-l-4 border-[#EA0016] bg-red-50 p-4 text-[15px] text-red-800">
            <span className="flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </span>
            {error.includes('Insufficient') && (
              <Link to="/wallet" className="font-semibold underline">
                Add credits
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-heading">Filters</h2>
          <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2 text-[13px] font-bold text-gray-700">
            <Filter size={14} /> {showFilters ? 'Hide filters' : 'Show filters'}
          </button>
        </div>
        {showFilters && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Location" icon={<MapPin size={14} />}>
                <select value={locationId} onChange={(e) => { setLocationId(e.target.value); setBranchId(''); setRoom(null); }}>
                  <option value="">Select location</option>
                  {locations.map((x: any) => (
                    <option key={x.id} value={x.id}>{x.name} ({x.city})</option>
                  ))}
                </select>
              </Field>
              <Field label="Office" icon={<Building2 size={14} />}>
                <select disabled={!locationId} value={branchId} onChange={(e) => { setBranchId(e.target.value); setRoom(null); }}>
                  <option value="">Select office</option>
                  {offices.filter((x: any) => x.location_id === locationId).map((x: any) => (
                    <option key={x.id} value={x.id}>{x.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Start date" icon={<CalendarIcon size={14} />}>
                <input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
              <Field label="End date" icon={<CalendarIcon size={14} />}>
                <input type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
              <Field label="Start time" icon={<Clock size={14} />}>
                <select value={startTime} onChange={(e) => { setStartTime(e.target.value); setRoom(null); }}>
                  {times.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </Field>
              <Field label="Duration">
                <select value={duration} onChange={(e) => { setDuration(Number(e.target.value)); setRoom(null); }}>
                  {permittedDurations.map((value) => <option key={value} value={value}>{durationLabel(value)}</option>)}
                </select>
              </Field>
              <Field label="Room type">
                <input value={roomLabel} disabled />
              </Field>
              <Field label="Availability">
                <select value={draftFilters.availability} onChange={(e) => setDraftFilters({ ...draftFilters, availability: e.target.value })}>
                  <option value="">All</option>
                  <option value="AVAILABLE">Available</option>
                  <option value="BOOKED">Booked</option>
                </select>
              </Field>
              <Field label="Capacity">
                <select value={draftFilters.capacity} onChange={(e) => setDraftFilters({ ...draftFilters, capacity: e.target.value })}>
                  <option value="">All</option>
                  <option value="1-4">1–4</option>
                  <option value="5-8">5–8</option>
                  <option value="9-12">9–12</option>
                  <option value="13-20">13–20</option>
                  <option value="20+">20+</option>
                </select>
              </Field>
              <Field label="Custom capacity">
                <input type="number" min={1} placeholder="Min seats" value={draftFilters.customCapacity} onChange={(e) => setDraftFilters({ ...draftFilters, customCapacity: e.target.value })} />
              </Field>
              <Field label="Floor">
                <select value={draftFilters.floor} onChange={(e) => setDraftFilters({ ...draftFilters, floor: e.target.value })}>
                  <option value="">All floors</option>
                  {floors.map((floor: number) => <option key={floor} value={floor}>Floor {floor}</option>)}
                </select>
              </Field>
              <Field label="Search">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className="!pl-9" placeholder="Room or amenity" value={draftFilters.search} onChange={(e) => setDraftFilters({ ...draftFilters, search: e.target.value })} />
                </div>
              </Field>
              <Field label="Min price">
                <input type="number" min={0} value={draftFilters.minPrice} onChange={(e) => setDraftFilters({ ...draftFilters, minPrice: e.target.value })} />
              </Field>
              <Field label="Max price">
                <input type="number" min={0} value={draftFilters.maxPrice} onChange={(e) => setDraftFilters({ ...draftFilters, maxPrice: e.target.value })} />
              </Field>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold text-gray-600">Amenities</p>
              <div className="flex flex-wrap gap-2">
                {AMENITY_OPTIONS.map((amenity) => (
                  <button
                    key={amenity}
                    type="button"
                    onClick={() => setDraftFilters((prev) => ({
                      ...prev,
                      amenities: prev.amenities.includes(amenity) ? prev.amenities.filter((a) => a !== amenity) : [...prev.amenities, amenity],
                    }))}
                    className={`rounded-lg px-3 py-1.5 text-[13px] font-bold ${draftFilters.amenities.includes(amenity) ? 'bg-[#007bc0] text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
                  >
                    {amenity}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => setAppliedFilters(draftFilters)} className="rounded-xl bg-[#007bc0] px-5 py-2.5 text-[15px] font-bold text-white">Apply Filters</button>
              <button type="button" onClick={() => { setDraftFilters(emptyFilters); setAppliedFilters(emptyFilters); }} className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-[15px] font-bold text-gray-700">Clear Filters</button>
            </div>
          </div>
        )}
      </section>

      {branchId && floorPlanFloor && !loading && filteredRooms.length > 0 && (
        <div className="flex items-center justify-end">
          <div className="inline-flex rounded-full bg-gray-100 p-1">
            <button
              onClick={() => setResultsView('grid')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[13px] font-bold ${resultsView === 'grid' ? 'bg-white shadow text-[#007bc0]' : 'text-gray-500'}`}
            ><LayoutGrid size={14} /> Grid</button>
            <button
              onClick={() => setResultsView('floorplan')}
              className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[13px] font-bold ${resultsView === 'floorplan' ? 'bg-white shadow text-[#007bc0]' : 'text-gray-500'}`}
            ><Grid3x3 size={14} /> Floor Plan</button>
          </div>
        </div>
      )}

      {!branchId ? (
        <EmptyState icon={<Building2 size={42} />} title="Choose a location and office" description="Select an office to load meeting and conference rooms for that campus." />
      ) : loading ? (
        <LoadingState label="Loading rooms..." />
      ) : filteredRooms.length === 0 ? (
        <EmptyState title={`No ${roomLabel.toLowerCase()}s match your filters.`} />
      ) : resultsView === 'floorplan' && floorPlanFloor ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-gray-600">
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-[#10b981] bg-[#ecfdf5]" />Available</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-[#ef4444] bg-[#fee2e2]" />Booked</span>
            <span className="text-gray-400">Click an available room to select it.</span>
          </div>
          <div className="h-[500px] rounded-2xl border border-gray-200 overflow-hidden">
            <FloorPlanCanvas
              mode="view"
              canvasWidth={floorPlanFloor.canvas_width}
              canvasHeight={floorPlanFloor.canvas_height}
              items={floorPlanItems.filter((it) => it.item_type !== 'ROOM' || it.room_type === kind)}
              unavailableRoomIds={unavailableRoomIds}
              onItemActivate={(item) => {
                if (item.item_type !== 'ROOM' || item.room_type !== kind) return;
                const matching = filteredRooms.find((r: any) => r.room_id === item.room_id);
                if (matching && matching.status !== 'UNAVAILABLE') setRoom(matching);
              }}
            />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
          {filteredRooms.map((item: any) => (
            <RoomCardComponent key={item.room_id} room={item} selected={room?.room_id === item.room_id} duration={duration} onSelect={() => setRoom(item)} />
          ))}
        </div>
      )}

      {branchId && (
        <AvailabilityTimeline
          rooms={filteredTimelines}
          loading={timelineLoading}
          startTime={startTime}
          duration={duration}
          onSelectSlot={onSelectTimelineSlot}
        />
      )}

      {room && (
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-[#B7DDF1] bg-[#EAF4FA] p-5 sm:flex-row">
          <div>
            <strong className="text-[17px] text-gray-800">Selected: {room.name}</strong>
            <p className="mt-1 text-[14px] text-gray-600">{date} · {startTime}–{endTime} · {durationLabel(duration)}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(room.facilities || []).map((facility: string) => <AmenityBadge key={facility} name={facility} />)}
            </div>
          </div>
          <button onClick={() => {
            if (!locationId || !branchId || !date || !startTime || !room) {
              setError('Complete location, office, date, time, and room before booking.');
              return;
            }
            setReviewing(true);
          }} className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#007bc0] px-5 py-3 text-[15px] font-bold text-white sm:w-auto">
            Review and book <ArrowRight size={16} />
          </button>
        </div>
      )}

      <AnimatePresence>
        {reviewing && room && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
              <button aria-label="Close review" onClick={() => setReviewing(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-700"><X size={20} /></button>
              <h3 className="text-[20px] font-bold text-gray-800">Confirm {roomLabel} booking</h3>
              <p className="mt-1 text-[14px] text-gray-500">{loc?.name} · {branch?.name}</p>
              <div className="mt-5 space-y-2 text-[15px]">
                <p className="flex justify-between"><span>Room</span><strong>{room.name}</strong></p>
                <p className="flex justify-between"><span>Schedule</span><strong>{date} · {startTime}–{endTime}</strong></p>
              </div>
              <div className="mt-4">
                <PriceSummary hourlyRate={room.price_per_hour} durationHours={duration / 60} total={price} />
              </div>
              <div className="mt-4 rounded-lg bg-[#EAF4FA] p-3 text-[14px]">
                <p className="flex justify-between"><span>Wallet balance</span><strong>₹{balance.toFixed(2)}</strong></p>
                <p className="flex justify-between"><span>After booking</span><strong className={balance >= price ? 'text-emerald-700' : 'text-red-700'}>₹{(balance - price).toFixed(2)}</strong></p>
              </div>
              {balance < price ? (
                <Link to="/wallet" className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#007bc0] py-3 text-[15px] font-bold text-white"><Wallet size={16} />Add credits</Link>
              ) : (
                <button disabled={submitting} onClick={submit} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#007bc0] py-3 text-[15px] font-bold text-white disabled:opacity-60">
                  {submitting ? 'Booking…' : <><CheckCircle2 size={17} />Confirm booking</>}
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block text-[13px] font-semibold text-gray-600">
      <span className="mb-1.5 flex items-center gap-1">{icon}{label}</span>
      <div className="[&_input]:w-full [&_input]:rounded-lg [&_input]:border [&_input]:border-gray-300 [&_input]:bg-gray-50 [&_input]:px-3 [&_input]:py-2.5 [&_input]:text-[15px] [&_select]:w-full [&_select]:rounded-lg [&_select]:border [&_select]:border-gray-300 [&_select]:bg-gray-50 [&_select]:px-3 [&_select]:py-2.5 [&_select]:text-[15px] [&_select:disabled]:opacity-50">
        {children}
      </div>
    </label>
  );
}
