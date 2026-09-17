import React, { useState } from 'react';
import { Sparkles, X, Loader2, AlertCircle } from 'lucide-react';
import type { GenerateRoomsRequest } from '../../types/floorPlanAi';

interface AiRoomGeneratorModalProps {
  facilities: any[];
  submitting: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (request: GenerateRoomsRequest) => void;
}

/** One form, two tabs over the same underlying request object - "Structured" and
 * "Describe It" aren't mutually exclusive, matching the backend's single-combined-prompt
 * design (both feed the same generation call). */
export const AiRoomGeneratorModal: React.FC<AiRoomGeneratorModalProps> = ({ facilities, submitting, error, onCancel, onSubmit }) => {
  const [tab, setTab] = useState<'structured' | 'describe'>('structured');
  const [meetingRoomCount, setMeetingRoomCount] = useState<string>('');
  const [conferenceRoomCount, setConferenceRoomCount] = useState<string>('');
  const [areaSqft, setAreaSqft] = useState<string>('');
  const [capacityMin, setCapacityMin] = useState<string>('');
  const [capacityMax, setCapacityMax] = useState<string>('');
  const [style, setStyle] = useState('');
  const [amenities, setAmenities] = useState<string[]>([]);
  const [nlRequest, setNlRequest] = useState('');

  const toggleAmenity = (name: string) => {
    setAmenities((prev) => (prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const request: GenerateRoomsRequest = {
      meeting_room_count: meetingRoomCount ? Number(meetingRoomCount) : null,
      conference_room_count: conferenceRoomCount ? Number(conferenceRoomCount) : null,
      available_area_sqft: areaSqft ? Number(areaSqft) : null,
      capacity_min: capacityMin ? Number(capacityMin) : null,
      capacity_max: capacityMax ? Number(capacityMax) : null,
      required_amenities: amenities.length ? amenities : null,
      style: style || null,
      nl_request: nlRequest || null,
    };
    onSubmit(request);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Sparkles size={18} className="text-purple-600" /> Generate Rooms with AI
        </h3>

        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-center gap-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl text-xs font-bold">
          <button type="button" onClick={() => setTab('structured')} className={`flex-1 py-1.5 rounded-lg ${tab === 'structured' ? 'bg-white shadow text-[#007bc0]' : 'text-gray-500'}`}>Structured</button>
          <button type="button" onClick={() => setTab('describe')} className={`flex-1 py-1.5 rounded-lg ${tab === 'describe' ? 'bg-white shadow text-[#007bc0]' : 'text-gray-500'}`}>Describe It</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {tab === 'structured' ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Meeting Rooms</label>
                  <input type="number" min="0" value={meetingRoomCount} onChange={(e) => setMeetingRoomCount(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Conference Rooms</label>
                  <input type="number" min="0" value={conferenceRoomCount} onChange={(e) => setConferenceRoomCount(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Capacity Min</label>
                  <input type="number" min="1" value={capacityMin} onChange={(e) => setCapacityMin(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Capacity Max</label>
                  <input type="number" min="1" value={capacityMax} onChange={(e) => setCapacityMax(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Available Area (sq ft)</label>
                <input type="number" min="0" value={areaSqft} onChange={(e) => setAreaSqft(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" placeholder="Soft sizing guidance only" />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Preferred Style</label>
                <input value={style} onChange={(e) => setStyle(e.target.value)} placeholder="e.g. Modern / Professional" className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Required Amenities</label>
                <div className="flex flex-wrap gap-1.5">
                  {facilities.map((f) => (
                    <button
                      type="button" key={f.id} onClick={() => toggleAmenity(f.name)}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold ${amenities.includes(f.name) ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}
                    >
                      {f.name}
                    </button>
                  ))}
                  {facilities.length === 0 && <p className="text-[11px] text-gray-400">No facilities defined yet.</p>}
                </div>
              </div>
            </>
          ) : (
            <div>
              <label className="block font-semibold text-gray-600 mb-1">Describe what you need</label>
              <textarea
                rows={5} value={nlRequest} onChange={(e) => setNlRequest(e.target.value)}
                placeholder='e.g. "Create 3 small meeting rooms for 6 people each and 2 conference rooms for 20 people."'
                className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onCancel} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
            <button
              type="submit" disabled={submitting}
              className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {submitting ? <><Loader2 size={14} className="animate-spin" /> Generating...</> : 'Generate Proposal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AiRoomGeneratorModal;
