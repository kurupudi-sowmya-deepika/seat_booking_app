import React, { useState } from 'react';
import { X, CheckCircle2, RefreshCw, Pencil, ShieldAlert, AlertTriangle, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import FloorPlanCanvas from './FloorPlanCanvas';
import type { LayoutItem } from './FloorPlanCanvas';
import type { GenerateRoomsResponse } from '../../types/floorPlanAi';
import { flattenProposal, proposalItemIds } from '../../types/floorPlanAi';

interface AiRoomProposalPreviewProps {
  canvasWidth: number;
  canvasHeight: number;
  currentDraftItems: LayoutItem[];
  proposal: GenerateRoomsResponse;
  regeneratingRoom: string | null;
  error?: string;
  onAcceptAndSave: () => void;
  onEditLayout: () => void;
  onRegenerateAll: (tweak: string) => void;
  onRegenerateOne: (roomName: string, tweak: string) => void;
  onCancel: () => void;
}

export const AiRoomProposalPreview: React.FC<AiRoomProposalPreviewProps> = ({
  canvasWidth, canvasHeight, currentDraftItems, proposal, regeneratingRoom, error,
  onAcceptAndSave, onEditLayout, onRegenerateAll, onRegenerateOne, onCancel,
}) => {
  const [tweak, setTweak] = useState('');
  const [roomTweaks, setRoomTweaks] = useState<Record<string, string>>({});

  const proposedItems = flattenProposal(proposal);
  const proposedIds = proposalItemIds(proposal);
  const errors = proposal.issues.filter((i) => i.severity === 'error');
  const warnings = proposal.issues.filter((i) => i.severity === 'warning');

  const handleAccept = () => {
    if (errors.length > 0 && !window.confirm('This proposal has unresolved errors that will likely be rejected on save. Accept anyway?')) return;
    onAcceptAndSave();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-6xl w-full h-[90vh] p-5 shadow-2xl relative flex flex-col gap-3">
        <button onClick={onCancel} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
          <Sparkles size={18} className="text-purple-600" /> AI Generated Layout Preview
        </h3>
        {proposal.notes && <p className="text-xs text-gray-500 italic">{proposal.notes}</p>}
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 flex items-center gap-2">
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {(errors.length > 0 || warnings.length > 0) && (
          <div className="space-y-1.5">
            {errors.length > 0 && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl text-[11px] text-red-700 space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold"><ShieldAlert size={13} /> Issues (likely to be rejected):</div>
                {errors.map((iss, idx) => <div key={idx} className="pl-5">&bull; {iss.message}</div>)}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700 space-y-0.5">
                <div className="flex items-center gap-1.5 font-bold"><AlertTriangle size={13} /> Warnings (accept anyway if fine):</div>
                {warnings.map((iss, idx) => <div key={idx} className="pl-5">&bull; {iss.message}</div>)}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
          <div className="col-span-8 min-h-0">
            <FloorPlanCanvas
              mode="preview"
              canvasWidth={canvasWidth}
              canvasHeight={canvasHeight}
              items={[...currentDraftItems, ...proposedItems]}
              proposedItemIds={proposedIds}
            />
          </div>

          <div className="col-span-4 overflow-y-auto space-y-2.5 pr-1">
            {proposal.rooms.map((bundle) => (
              <div key={bundle.room.id} className="border border-amber-200 bg-amber-50/40 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-xs">{bundle.spec.name}</span>
                  <span className="text-[10px] font-bold text-gray-500">{bundle.room.properties?.room_type}{bundle.room.properties?.size_tier ? ` (${bundle.room.properties.size_tier})` : ''}</span>
                </div>
                <div className="text-[11px] text-gray-500">Capacity: {bundle.spec.capacity} &bull; Room #{bundle.spec.room_number}</div>
                {bundle.spec.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bundle.spec.amenities.map((a) => (
                      <span key={a} className="px-1.5 py-0.5 bg-white border border-amber-200 rounded text-[10px] text-amber-700">{a}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1.5 pt-1">
                  <input
                    value={roomTweaks[bundle.spec.name] || ''}
                    onChange={(e) => setRoomTweaks((prev) => ({ ...prev, [bundle.spec.name]: e.target.value }))}
                    placeholder="Tweak, e.g. capacity 8 + VC"
                    className="flex-1 px-2 py-1 bg-white border border-gray-200 rounded-lg text-[10px]"
                  />
                  <button
                    onClick={() => onRegenerateOne(bundle.spec.name, roomTweaks[bundle.spec.name] || '')}
                    disabled={!!regeneratingRoom}
                    className="px-2 py-1 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 disabled:opacity-50"
                  >
                    {regeneratingRoom === bundle.spec.name ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          <input
            value={tweak} onChange={(e) => setTweak(e.target.value)}
            placeholder="Optional tweak before regenerating the whole batch..."
            className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs"
          />
          <button onClick={() => onRegenerateAll(tweak)} disabled={!!regeneratingRoom} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5 disabled:opacity-50">
            <RefreshCw size={13} /> Regenerate
          </button>
          <button onClick={onEditLayout} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 flex items-center gap-1.5">
            <Pencil size={13} /> Edit Layout
          </button>
          <button onClick={onCancel} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700">
            Cancel
          </button>
          <button onClick={handleAccept} className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5">
            <CheckCircle2 size={14} /> Accept & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiRoomProposalPreview;
