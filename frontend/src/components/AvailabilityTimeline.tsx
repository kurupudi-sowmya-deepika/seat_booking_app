import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface TimelineSlot {
  start_time: string;
  end_time: string;
  status: string;
  is_mine?: boolean;
  booked_by?: string | null;
  booking_type?: string | null;
  booking_start?: string | null;
  booking_end?: string | null;
}

export interface TimelineRoom {
  room_id: string;
  name: string;
  floor?: number | null;
  capacity: number;
  room_type: string;
  slots: TimelineSlot[];
}

function toMinutes(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
}

function formatTime12(value: string) {
  const [h, m] = value.slice(0, 5).split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${ampm}`;
}

function typeLabel(type?: string | null) {
  if (type === 'CONFERENCE_ROOM') return 'Conference Room';
  if (type === 'MEETING_ROOM') return 'Meeting Room';
  return type || 'Room booking';
}

interface AvailabilityTimelineProps {
  rooms: TimelineRoom[];
  loading?: boolean;
  startTime: string;
  duration: number;
  onSelectSlot: (roomId: string, startTime: string) => void;
}

export const AvailabilityTimeline: React.FC<AvailabilityTimelineProps> = ({
  rooms,
  loading,
  startTime,
  duration,
  onSelectSlot,
}) => {
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const selectedStart = toMinutes(startTime);
  const selectedEnd = selectedStart + duration;
  const headers = rooms[0]?.slots || [];

  if (loading) {
    return (
      <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-gray-200 bg-white">
        <Loader2 className="animate-spin text-[#007bc0]" size={28} />
      </div>
    );
  }

  if (!rooms.length) return null;

  return (
    <div className="mt-8 rounded-xl border border-gray-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-[20px] font-bold text-gray-900">Room availability</h3>
          <p className="text-[14px] text-gray-500">
            Gray blocks are booked. Light blocks are available. Hover a booked slot for booking details.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px] font-semibold text-gray-600">
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-3 w-4 rounded-sm bg-emerald-100 border border-emerald-300" /> Available
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-3 w-4 rounded-sm bg-slate-400" /> Booked
          </span>
          <span className="inline-flex items-center gap-1.5">
            <i className="inline-block h-3 w-4 rounded-sm bg-[#007bc0]" /> Selected
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="sticky left-0 z-10 min-w-[160px] bg-gray-50 px-3 py-3 text-left text-[13px] font-bold uppercase text-gray-600">
                Room
              </th>
              {headers.map((slot) => (
                <th
                  key={slot.start_time}
                  className="min-w-[72px] px-1 py-3 text-center text-[11px] font-bold text-gray-500 whitespace-nowrap"
                >
                  {formatTime12(slot.start_time)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <tr key={room.room_id} className="border-t border-gray-100">
                <td className="sticky left-0 z-10 bg-white px-3 py-3 align-top">
                  <p className="text-[16px] font-bold text-gray-900">{room.name}</p>
                  <p className="text-[13px] italic text-gray-500">
                    {room.floor ? `Floor ${room.floor}` : typeLabel(room.room_type)}
                  </p>
                  <p className="text-[12px] text-gray-400">{room.capacity} seater</p>
                </td>
                {room.slots.map((slot) => {
                  const start = toMinutes(slot.start_time);
                  const booked = slot.status === 'BOOKED';
                  const selected = start >= selectedStart && start < selectedEnd;
                  const key = `${room.room_id}-${slot.start_time}`;
                  const label = booked ? (slot.is_mine ? 'Your booking' : 'Booked') : 'Available';

                  return (
                    <td key={slot.start_time} className="px-0.5 py-2">
                      <button
                        type="button"
                        disabled={booked}
                        aria-label={`${room.name} ${formatTime12(slot.start_time)} ${label}`}
                        title={label}
                        onMouseEnter={() => setHoverKey(key)}
                        onMouseLeave={() => setHoverKey(null)}
                        onFocus={() => setHoverKey(key)}
                        onBlur={() => setHoverKey(null)}
                        onClick={() => {
                          if (!booked) onSelectSlot(room.room_id, slot.start_time.slice(0, 5));
                        }}
                        className={`relative h-9 w-full rounded-sm border text-[10px] font-bold ${
                          booked
                            ? 'cursor-not-allowed border-slate-300 bg-slate-400 text-white'
                            : selected
                              ? 'border-[#005691] bg-[#007bc0] text-white'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-[#007bc0]'
                        }`}
                      >
                        <span className="sr-only">{label}</span>
                        {hoverKey === key && booked && (
                          <div className="absolute left-1/2 top-full z-30 mt-1 w-52 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left text-[12px] font-medium text-gray-700 shadow-lg">
                            <p className="font-bold text-gray-900">Booked</p>
                            <p>Booked by: {slot.booked_by || 'Employee'}</p>
                            <p>Booking type: {typeLabel(slot.booking_type)}</p>
                            <p>Start: {slot.booking_start ? formatTime12(String(slot.booking_start)) : formatTime12(slot.start_time)}</p>
                            <p>End: {slot.booking_end ? formatTime12(String(slot.booking_end)) : formatTime12(slot.end_time)}</p>
                          </div>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AvailabilityTimeline;
