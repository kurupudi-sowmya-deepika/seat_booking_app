import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import FloorPlanCanvas from '../../components/floorplan/FloorPlanCanvas';
import type { LayoutItem } from '../../components/floorplan/FloorPlanCanvas';
import AiRoomGeneratorModal from '../../components/floorplan/AiRoomGeneratorModal';
import AiRoomProposalPreview from '../../components/floorplan/AiRoomProposalPreview';
import type { GenerateRoomsRequest, GenerateRoomsResponse } from '../../types/floorPlanAi';
import { flattenProposal } from '../../types/floorPlanAi';
import {
  ArrowLeft, Save, UploadCloud, Undo2, Redo2, Trash2, Copy,
  Armchair, DoorOpen, Square, RectangleHorizontal, ShieldAlert, X, Layers, Sparkles,
  Grid3x3, Magnet, Box, Maximize, Minimize, PenLine, Spline, RotateCw, MousePointer2,
} from 'lucide-react';

let uid = 0;
const newId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  uid += 1;
  return `local-${Date.now()}-${uid}`;
};

const DEFAULT_WORKSPACE_MARKER = 'is_default_workspace';

export const FloorPlanEditor: React.FC = () => {
  const { floorId } = useParams<{ floorId: string }>();
  const navigate = useNavigate();

  const [floor, setFloor] = useState<any>(null);
  const [items, setItems] = useState<LayoutItem[]>([]);
  const [lastSavedItems, setLastSavedItems] = useState<LayoutItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [issues, setIssues] = useState<{ item_id?: string; message: string }[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);

  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [seatForm, setSeatForm] = useState({ seat_number: '', seat_type: 'STANDARD', price: 100, status: 'AVAILABLE', monitor_available: false, power_available: false, near_window: false });
  const [roomForm, setRoomForm] = useState({ name: '', room_number: '', room_type: 'MEETING_ROOM', capacity: 4, price_per_hour: 500, shape: 'RECTANGLE' as LayoutItem['shape'] });

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRegeneratingRoom, setAiRegeneratingRoom] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<GenerateRoomsResponse | null>(null);
  const [aiLastRequest, setAiLastRequest] = useState<GenerateRoomsRequest | null>(null);
  const [aiError, setAiError] = useState('');

  // ----- 3D/isometric view + editor tools -----
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [isoRotation, setIsoRotation] = useState<0 | 90 | 180 | 270>(0);
  const [showGrid, setShowGrid] = useState(true);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [drawTool, setDrawTool] = useState<'select' | 'wall' | 'polygon'>('select');
  const [wallStart, setWallStart] = useState<{ x: number; y: number } | null>(null);
  const [polygonPoints, setPolygonPoints] = useState<{ x: number; y: number }[] | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [liveResourceStatus, setLiveResourceStatus] = useState<{ status?: string; capacity?: number } | null>(null);

  const history = useRef<LayoutItem[][]>([]);
  const future = useRef<LayoutItem[][]>([]);

  const isDirty = useMemo(() => JSON.stringify(items) !== JSON.stringify(lastSavedItems), [items, lastSavedItems]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [floorsRes, layoutRes, facRes] = await Promise.all([
        api.get('/floor-plans/floors'),
        api.get(`/floor-plans/floors/${floorId}/layout`, { params: { draft: true } }),
        api.get('/facilities/'),
      ]);
      const f = (floorsRes.data || []).find((fl: any) => fl.id === floorId);
      setFloor(f || null);
      setItems(layoutRes.data || []);
      setLastSavedItems(layoutRes.data || []);
      setFacilities(facRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); /* eslint-disable-next-line */ }, [floorId]);

  // Warn before closing the tab/reloading with unsaved changes (requirement 10).
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  const pushHistory = (snapshot: LayoutItem[]) => {
    history.current.push(snapshot);
    if (history.current.length > 50) history.current.shift();
    future.current = [];
  };

  const applyItems = (next: LayoutItem[], recordHistory = true) => {
    if (recordHistory) pushHistory(items);
    setItems(next);
  };

  const undo = () => {
    if (history.current.length === 0) return;
    const prev = history.current.pop()!;
    future.current.push(items);
    setItems(prev);
  };

  const redo = () => {
    if (future.current.length === 0) return;
    const next = future.current.pop()!;
    history.current.push(items);
    setItems(next);
  };

  const getOrCreateDefaultWorkspace = (current: LayoutItem[]): { items: LayoutItem[]; roomId: string } => {
    const existing = current.find(i => i.item_type === 'ROOM' && i.properties?.[DEFAULT_WORKSPACE_MARKER]);
    if (existing) return { items: current, roomId: existing.id };
    const room: LayoutItem = {
      id: newId(), item_type: 'ROOM', label: 'Open Workspace',
      x: 20, y: 20, width: (floor?.canvas_width || 1200) - 40, height: (floor?.canvas_height || 800) - 40,
      rotation: 0, shape: 'RECTANGLE', z_index: 0,
      properties: { name: 'Open Workspace', room_type: 'WORKSPACE', capacity: 999, [DEFAULT_WORKSPACE_MARKER]: true },
    };
    return { items: [...current, room], roomId: room.id };
  };

  // ----- Add / Edit Seat -----
  const openAddSeat = () => {
    setEditingSeatId(null);
    setSeatForm({ seat_number: '', seat_type: 'STANDARD', price: 100, status: 'AVAILABLE', monitor_available: false, power_available: false, near_window: false });
    setSeatModalOpen(true);
  };

  const openEditSeat = (item: LayoutItem) => {
    setEditingSeatId(item.id);
    setSeatForm({
      seat_number: item.properties?.seat_number || '',
      seat_type: item.properties?.seat_type || 'STANDARD',
      price: item.properties?.price ?? 100,
      status: item.properties?.status || 'AVAILABLE',
      monitor_available: !!item.properties?.monitor_available,
      power_available: !!item.properties?.power_available,
      near_window: !!item.properties?.near_window,
    });
    setSeatModalOpen(true);
  };

  const handleSaveSeatForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSeatId) {
      applyItems(items.map(it => it.id === editingSeatId ? { ...it, label: seatForm.seat_number, properties: { ...it.properties, ...seatForm } } : it));
    } else {
      const { items: withRoom, roomId } = getOrCreateDefaultWorkspace(items);
      const seat: LayoutItem = {
        id: newId(), item_type: 'SEAT', parent_item_id: roomId, label: seatForm.seat_number,
        x: 60, y: 60, width: 40, height: 40, rotation: 0, shape: 'SQUARE', z_index: 1,
        properties: { ...seatForm },
      };
      applyItems([...withRoom, seat]);
    }
    setSeatModalOpen(false);
  };

  // ----- Add / Edit Meeting/Conference Room -----
  const ROOM_SHAPES: LayoutItem['shape'][] = ['RECTANGLE', 'SQUARE', 'CIRCLE', 'OVAL', 'L_SHAPE', 'CUSTOM'];

  // CIRCLE/SQUARE need an equal width/height footprint to actually render as a circle
  // rather than an oval/rectangle - picking a shape immediately updates these defaults
  // so the canvas preview looks right the moment the admin selects it.
  const defaultSizeForShape = (shape: LayoutItem['shape']): { width: number; height: number } => {
    if (shape === 'CIRCLE' || shape === 'SQUARE') return { width: 160, height: 160 };
    if (shape === 'L_SHAPE') return { width: 220, height: 180 };
    return { width: 180, height: 140 };
  };

  const openAddRoom = () => {
    setEditingRoomId(null);
    setRoomForm({ name: '', room_number: '', room_type: 'MEETING_ROOM', capacity: 4, price_per_hour: 500, shape: 'RECTANGLE' });
    setRoomModalOpen(true);
  };

  const openEditRoom = (item: LayoutItem) => {
    setEditingRoomId(item.id);
    setRoomForm({
      name: item.properties?.name || item.label || '',
      room_number: item.properties?.room_number || '',
      room_type: item.properties?.room_type || 'MEETING_ROOM',
      capacity: item.properties?.capacity ?? 4,
      price_per_hour: item.properties?.price_per_hour ?? 500,
      shape: item.shape,
    });
    setRoomModalOpen(true);
  };

  const handleSaveRoomForm = (e: React.FormEvent) => {
    e.preventDefault();
    const { shape, ...roomProps } = roomForm;
    if (editingRoomId) {
      applyItems(items.map(it => {
        if (it.id !== editingRoomId) return it;
        // Reset to a shape-appropriate footprint only when the shape actually changed -
        // an equal-dimension default so CIRCLE/SQUARE render as such, not an oval/rectangle.
        const sizePatch = it.shape !== shape ? defaultSizeForShape(shape) : {};
        return { ...it, label: roomForm.name, shape, ...sizePatch, properties: { ...it.properties, ...roomProps } };
      }));
    } else {
      const room: LayoutItem = {
        id: newId(), item_type: 'ROOM', label: roomForm.name,
        x: 100, y: 100, ...defaultSizeForShape(shape), rotation: 0, shape, z_index: 1,
        properties: { ...roomProps },
      };
      applyItems([...items, room]);
    }
    setRoomModalOpen(false);
  };

  // ----- Generic add for zones / walls / doors / windows / facilities -----
  const addSimpleItem = (type: LayoutItem['item_type'], overrides: Partial<LayoutItem> = {}) => {
    const item: LayoutItem = {
      id: newId(), item_type: type,
      x: 40, y: 40, width: type === 'ZONE' ? 200 : type === 'WALL' ? 120 : 30,
      height: type === 'ZONE' ? 150 : type === 'WALL' ? 10 : 30,
      rotation: 0, shape: type === 'DOOR' || type === 'WINDOW' ? 'RECTANGLE' : 'RECTANGLE', z_index: type === 'ZONE' ? -1 : 2,
      label: type === 'ZONE' ? 'New Zone' : undefined,
      color: type === 'ZONE' ? '#60a5fa' : undefined,
      properties: type === 'ZONE' ? { description: '' } : null,
      ...overrides,
    };
    applyItems([...items, item]);
    setSelectedIds([item.id]);
  };

  const addFacility = (facility: any) => {
    const parentRoom = selectedIds.length === 1 ? items.find(i => i.id === selectedIds[0] && i.item_type === 'ROOM') : null;
    const item: LayoutItem = {
      id: newId(), item_type: 'FACILITY', parent_item_id: parentRoom?.id || null,
      x: parentRoom ? parentRoom.x + 20 : 60, y: parentRoom ? parentRoom.y + 20 : 60,
      width: 30, height: 30, rotation: 0, shape: 'RECTANGLE', z_index: 3,
      label: facility.name, properties: { facility_id: facility.id },
    };
    applyItems([...items, item]);
  };

  const deleteSelected = () => {
    if (selectedIds.length === 0) return;
    const idsToRemove = new Set(selectedIds);
    // Also remove children (facilities nested in a deleted room; seats nested in a deleted workspace room).
    items.forEach(it => { if (it.parent_item_id && idsToRemove.has(it.parent_item_id)) idsToRemove.add(it.id); });
    applyItems(items.filter(it => !idsToRemove.has(it.id)));
    setSelectedIds([]);
  };

  const duplicateSelected = () => {
    if (selectedIds.length === 0) return;
    const idMap: Record<string, string> = {};
    const copies = items.filter(it => selectedIds.includes(it.id)).map(it => {
      const newItemId = newId();
      idMap[it.id] = newItemId;
      return { ...it, id: newItemId, x: it.x + 20, y: it.y + 20 };
    });
    applyItems([...items, ...copies]);
    setSelectedIds(copies.map(c => c.id));
  };

  const alignSelected = (axis: 'left' | 'top') => {
    if (selectedIds.length < 2) return;
    const selected = items.filter(it => selectedIds.includes(it.id));
    const target = axis === 'left' ? Math.min(...selected.map(i => i.x)) : Math.min(...selected.map(i => i.y));
    applyItems(items.map(it => selectedIds.includes(it.id) ? { ...it, [axis === 'left' ? 'x' : 'y']: target } : it));
  };

  // ----- Draw Wall / Draw Custom Shape -----
  const handleCanvasClick = (pos: { x: number; y: number }) => {
    if (drawTool === 'wall') {
      if (!wallStart) { setWallStart(pos); return; }
      const dx = pos.x - wallStart.x, dy = pos.y - wallStart.y;
      const length = Math.max(20, Math.round(Math.hypot(dx, dy)));
      const angle = Math.round((Math.atan2(dy, dx) * 180) / Math.PI);
      const wall: LayoutItem = {
        id: newId(), item_type: 'WALL',
        x: Math.round(wallStart.x), y: Math.round(wallStart.y) - 5,
        width: length, height: 10, rotation: angle, shape: 'RECTANGLE', z_index: 2,
      };
      applyItems([...items, wall]);
      setWallStart(null);
      setDrawTool('select');
    } else if (drawTool === 'polygon') {
      setPolygonPoints(prev => [...(prev || []), pos]);
    }
  };

  const finishPolygon = () => {
    if (!polygonPoints || polygonPoints.length < 3) { cancelDrawing(); return; }
    const minX = Math.min(...polygonPoints.map(p => p.x));
    const minY = Math.min(...polygonPoints.map(p => p.y));
    const maxX = Math.max(...polygonPoints.map(p => p.x));
    const maxY = Math.max(...polygonPoints.map(p => p.y));
    const item: LayoutItem = {
      id: newId(), item_type: 'ROOM', label: 'Custom Room',
      x: Math.round(minX), y: Math.round(minY),
      width: Math.max(20, Math.round(maxX - minX)), height: Math.max(20, Math.round(maxY - minY)),
      rotation: 0, shape: 'CUSTOM', z_index: 1,
      properties: {
        name: 'Custom Room', room_type: 'MEETING_ROOM', capacity: 4,
        // Practical, bounded polygon support (see ItemShape in FloorPlanCanvas.tsx) -
        // points are relative to the item's own x/y, placed once at creation time.
        polygon_points: polygonPoints.map(p => ({ x: Math.round(p.x - minX), y: Math.round(p.y - minY) })),
      },
    };
    applyItems([...items, item]);
    cancelDrawing();
  };

  const cancelDrawing = () => { setWallStart(null); setPolygonPoints(null); setDrawTool('select'); };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) editorContainerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Live status/capacity of the selected item's real Seat/Room row, if it was already
  // published once before (seat_id/room_id set) - fetched once per selection, not per
  // render, so re-editing an already-published item shows its current live state.
  useEffect(() => {
    const item = selectedIds.length === 1 ? items.find(i => i.id === selectedIds[0]) : null;
    setLiveResourceStatus(null);
    if (!item) return;
    if (item.seat_id) {
      api.get(`/seats/`).then(res => {
        const seat = (res.data || []).find((s: any) => s.id === item.seat_id);
        if (seat) setLiveResourceStatus({ status: seat.status });
      }).catch(() => {});
    } else if (item.room_id) {
      api.get(`/rooms/${item.room_id}`).then(res => {
        setLiveResourceStatus({ status: res.data.status, capacity: res.data.capacity });
      }).catch(() => {});
    }
  }, [selectedIds, items]);

  const handleSave = async (itemsOverride?: LayoutItem[]) => {
    // `itemsOverride` matters when a caller (e.g. Accept & Save below) just called
    // applyItems(merged) synchronously beforehand - React batches that state update,
    // so `items` in this closure would still be the stale pre-merge array without it.
    const payload = itemsOverride ?? items;
    setSaving(true);
    setIssues([]);
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/save`, { items: payload });
      if (res.data.success) {
        setLastSavedItems(res.data.items);
        setItems(res.data.items);
      } else {
        setIssues(res.data.issues || []);
      }
    } catch (err: any) {
      setIssues([{ message: err.response?.data?.detail || 'Failed to save layout.' }]);
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (isDirty) {
      alert('Save your changes before publishing.');
      return;
    }
    setPublishing(true);
    setIssues([]);
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/publish`);
      if (res.data.success) {
        alert('Floor plan published! Employees will now see this layout.');
        setFloor(res.data.floor);
      } else {
        setIssues(res.data.issues || []);
      }
    } catch (err: any) {
      setIssues([{ message: err.response?.data?.detail || 'Failed to publish.' }]);
    } finally {
      setPublishing(false);
    }
  };

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved changes. Leave without saving?')) return;
    navigate('/admin/floor-plans');
  };

  // ----- AI Room Generation -----
  const handleGenerate = async (request: GenerateRoomsRequest) => {
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/generate-rooms`, request);
      setAiLastRequest(request);
      setAiPreview(res.data);
      setAiModalOpen(false);
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'Failed to generate rooms.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRegenerateAll = async (tweak: string) => {
    if (!aiLastRequest) return;
    const request: GenerateRoomsRequest = {
      ...aiLastRequest,
      nl_request: [aiLastRequest.nl_request, tweak].filter(Boolean).join('. ') || null,
      pending_rooms: null,
      regenerate_room_name: null,
    };
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/generate-rooms`, request);
      setAiLastRequest(request);
      setAiPreview(res.data);
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'Failed to regenerate.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRegenerateOne = async (roomName: string, tweak: string) => {
    if (!aiPreview || !aiLastRequest) return;
    setAiRegeneratingRoom(roomName);
    setAiError('');
    try {
      const request: GenerateRoomsRequest = {
        ...aiLastRequest,
        nl_request: tweak || aiLastRequest.nl_request || null,
        pending_rooms: aiPreview.rooms.map((b) => b.spec),
        regenerate_room_name: roomName,
      };
      const res = await api.post(`/floor-plans/floors/${floorId}/generate-rooms`, request);
      const replacement = res.data.rooms[0];
      if (replacement) {
        setAiPreview({
          ...aiPreview,
          rooms: aiPreview.rooms.map((b) => (b.spec.name === roomName ? replacement : b)),
          issues: res.data.issues,
        });
      }
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'Failed to regenerate that room.');
    } finally {
      setAiRegeneratingRoom(null);
    }
  };

  const handleAcceptAndSave = () => {
    if (!aiPreview) return;
    const merged = [...items, ...flattenProposal(aiPreview)];
    applyItems(merged);
    handleSave(merged);
    setAiPreview(null);
  };

  const handleEditLayoutFromProposal = () => {
    if (!aiPreview) return;
    applyItems([...items, ...flattenProposal(aiPreview)]);
    setAiPreview(null);
  };

  const selectedItem = selectedIds.length === 1 ? items.find(i => i.id === selectedIds[0]) : null;
  const facilitiesByCategory = useMemo(() => {
    const groups: Record<string, any[]> = {};
    facilities.forEach(f => {
      const cat = f.category || 'Other';
      groups[cat] = groups[cat] || [];
      groups[cat].push(f);
    });
    return groups;
  }, [facilities]);

  if (loading) return <div className="p-12 text-center text-gray-400">Loading floor plan...</div>;
  if (!floor) return <div className="p-12 text-center text-gray-400">Floor not found.</div>;

  return (
    <div ref={editorContainerRef} className={`space-y-4 ${isFullscreen ? 'bg-gray-50/70 p-4 overflow-y-auto h-screen' : ''}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-800">{floor.name} - Layout Editor</h1>
            <p className="text-[11px] text-gray-400">
              {isDirty ? <span className="text-amber-600 font-bold">Unsaved changes</span> : 'All changes saved'}
              {floor.published_at && <span> &bull; Last published {new Date(floor.published_at).toLocaleString()}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={undo} title="Undo" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><Undo2 size={15} /></button>
          <button onClick={redo} title="Redo" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><Redo2 size={15} /></button>
          <button onClick={duplicateSelected} title="Duplicate" disabled={!selectedIds.length} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 disabled:opacity-40"><Copy size={15} /></button>
          <button onClick={deleteSelected} title="Delete" disabled={!selectedIds.length} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 disabled:opacity-40"><Trash2 size={15} /></button>
          <button
            onClick={() => handleSave()} disabled={saving}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-60"
          >
            <Save size={14} /> {saving ? 'Saving...' : 'Save Floor Plan'}
          </button>
          <button
            onClick={handlePublish} disabled={publishing || isDirty}
            title={isDirty ? 'Save first' : 'Publish'}
            className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow flex items-center gap-1.5 disabled:opacity-40"
          >
            <UploadCloud size={14} /> {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>

      {/* Editor toolbar: Select/Draw Wall/Draw Custom Shape | Grid/Snap | 2D/3D + Rotate | Fullscreen */}
      <div className="flex flex-wrap items-center gap-2 bg-white border border-gray-200 rounded-2xl p-2">
        <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
          <button
            onClick={() => cancelDrawing()} title="Select"
            className={`p-2 rounded-lg ${drawTool === 'select' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          ><MousePointer2 size={15} /></button>
          <button
            onClick={() => { setDrawTool('wall'); setWallStart(null); }} title="Draw Wall - click a start point, then an end point"
            className={`p-2 rounded-lg ${drawTool === 'wall' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          ><PenLine size={15} /></button>
          <button
            onClick={() => { setDrawTool('polygon'); setPolygonPoints([]); }} title="Draw Custom Shape - click points, then Finish"
            className={`p-2 rounded-lg ${drawTool === 'polygon' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          ><Spline size={15} /></button>
          {drawTool === 'polygon' && (
            <>
              <span className="text-[10px] font-bold text-gray-500 px-1">{(polygonPoints?.length || 0)} point(s)</span>
              <button onClick={finishPolygon} className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">Finish</button>
              <button onClick={cancelDrawing} className="px-2 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold">Cancel</button>
            </>
          )}
          {drawTool === 'wall' && (
            <span className="text-[10px] font-bold text-gray-500 px-1">{wallStart ? 'Click end point...' : 'Click start point...'}</span>
          )}
        </div>

        <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
          <button
            onClick={() => setShowGrid(g => !g)} title="Toggle grid"
            className={`p-2 rounded-lg ${showGrid ? 'bg-blue-50 text-[#007bc0]' : 'bg-gray-100 text-gray-400'}`}
          ><Grid3x3 size={15} /></button>
          <button
            onClick={() => setSnapEnabled(s => !s)} title="Toggle snap-to-grid"
            className={`p-2 rounded-lg ${snapEnabled ? 'bg-blue-50 text-[#007bc0]' : 'bg-gray-100 text-gray-400'}`}
          ><Magnet size={15} /></button>
        </div>

        <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
          <button
            onClick={() => setViewMode(m => (m === '2d' ? '3d' : '2d'))}
            title={viewMode === '2d' ? 'Switch to 3D isometric view' : 'Switch to 2D edit view'}
            className={`px-2.5 py-2 rounded-lg text-[11px] font-bold flex items-center gap-1.5 ${viewMode === '3d' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          ><Box size={15} /> {viewMode === '2d' ? '2D' : '3D'}</button>
          {viewMode === '3d' && (
            <button
              onClick={() => setIsoRotation(r => (r === 0 ? 90 : r === 90 ? 180 : r === 180 ? 270 : 0) as 0 | 90 | 180 | 270)}
              title="Rotate floor 90°" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
            ><RotateCw size={15} /></button>
          )}
        </div>

        <button
          onClick={toggleFullscreen} title="Fullscreen"
          className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
        >{isFullscreen ? <Minimize size={15} /> : <Maximize size={15} />}</button>

        {viewMode === '3d' && (
          <span className="text-[10px] text-gray-400 ml-auto">Editing (drag/resize/rotate) happens in 2D - switch back to make changes.</span>
        )}
      </div>

      {issues.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
          <div className="flex items-center gap-1.5 font-bold"><ShieldAlert size={14} /> Fix these before saving/publishing:</div>
          {issues.map((iss, idx) => <div key={idx} className="pl-5">&bull; {iss.message}</div>)}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        {/* Facility library */}
        <div className="col-span-2 bg-white border border-gray-200 rounded-2xl p-3 overflow-y-auto">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase mb-2">Add to Floor</h3>
          <div className="space-y-1.5 mb-4">
            <button onClick={openAddSeat} className="w-full flex items-center gap-2 px-2.5 py-2 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs font-bold text-[#007bc0]"><Armchair size={14} /> Add Seat</button>
            <button onClick={openAddRoom} className="w-full flex items-center gap-2 px-2.5 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-lg text-xs font-bold text-indigo-700"><DoorOpen size={14} /> Add Room</button>
            <button onClick={() => { setAiError(''); setAiModalOpen(true); }} className="w-full flex items-center gap-2 px-2.5 py-2 bg-purple-50 hover:bg-purple-100 rounded-lg text-xs font-bold text-purple-700"><Sparkles size={14} /> Generate Rooms with AI</button>
            <button onClick={() => addSimpleItem('ZONE')} className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-600"><Layers size={14} /> Add Zone</button>
            <button onClick={() => addSimpleItem('WALL')} className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-600"><RectangleHorizontal size={14} /> Add Wall</button>
            <button onClick={() => addSimpleItem('DOOR')} className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-600"><Square size={14} /> Add Door</button>
            <button onClick={() => addSimpleItem('WINDOW')} className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 hover:bg-gray-100 rounded-lg text-xs font-bold text-gray-600"><Square size={14} /> Add Window</button>
          </div>

          <h3 className="text-[11px] font-bold text-gray-500 uppercase mb-2">Facility Library</h3>
          {Object.keys(facilitiesByCategory).length === 0 && <p className="text-[11px] text-gray-400">No facilities defined yet (Admin &gt; Facilities).</p>}
          {Object.entries(facilitiesByCategory).map(([cat, facs]) => (
            <div key={cat} className="mb-3">
              <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{cat}</p>
              <div className="flex flex-wrap gap-1.5">
                {facs.map(f => (
                  <button key={f.id} onClick={() => addFacility(f)} className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold rounded-md">
                    {f.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Canvas */}
        <div className="col-span-7">
          <FloorPlanCanvas
            mode={viewMode === '3d' ? 'isometric' : 'edit'}
            canvasWidth={floor.canvas_width}
            canvasHeight={floor.canvas_height}
            items={items}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onItemsChange={(next) => applyItems(next)}
            onCanvasClick={viewMode === '2d' && drawTool !== 'select' ? handleCanvasClick : undefined}
            showGrid={showGrid}
            snapToGrid={snapEnabled}
            isoRotation={isoRotation}
          />
        </div>

        {/* Properties panel */}
        <div className="col-span-3 bg-white border border-gray-200 rounded-2xl p-4 overflow-y-auto">
          <h3 className="text-[11px] font-bold text-gray-500 uppercase mb-3">Properties</h3>
          {!selectedItem ? (
            <p className="text-xs text-gray-400">Select an item on the canvas to edit its properties, or use Align below with multiple selected.</p>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex justify-between"><span className="text-gray-500">Name</span><span className="font-bold">{selectedItem.label || selectedItem.properties?.name || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-bold">{selectedItem.item_type}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Room/Resource</span><span className="font-mono text-[10px]">{(selectedItem.room_id || selectedItem.seat_id) ? 'Published' : 'Draft only'}</span></div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">X</label>
                  <input type="number" value={Math.round(selectedItem.x)} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, x: Number(e.target.value) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Y</label>
                  <input type="number" value={Math.round(selectedItem.y)} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, y: Number(e.target.value) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Width</label>
                  <input type="number" min="10" value={Math.round(selectedItem.width)} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, width: Math.max(10, Number(e.target.value)) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Height</label>
                  <input type="number" min="10" value={Math.round(selectedItem.height)} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, height: Math.max(10, Number(e.target.value)) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Rotation</label>
                  <input type="number" value={Math.round(selectedItem.rotation)} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, rotation: Number(e.target.value) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Elevation</label>
                  <input type="number" min="0" value={Math.round(selectedItem.elevation || 0)} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, elevation: Math.max(0, Number(e.target.value)) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" title="Visual height off the floor - isometric (3D) view only" />
                </div>
                <div className="col-span-2">
                  <label className="block font-semibold text-gray-600 mb-1">Z-Index (layering)</label>
                  <input type="number" value={selectedItem.z_index} onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, z_index: Number(e.target.value) } : it))} className="w-full px-2 py-1.5 bg-gray-50 border border-gray-300 rounded-lg" />
                </div>
              </div>

              {selectedItem.item_type === 'ROOM' && (
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Shape</label>
                  <div className="grid grid-cols-6 gap-1">
                    {ROOM_SHAPES.map((s) => (
                      <button
                        key={s} type="button" title={s.replace('_', ' ')}
                        onClick={() => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, shape: s, ...(it.shape !== s ? defaultSizeForShape(s) : {}) } : it))}
                        className={`py-1.5 rounded-lg border text-[8px] font-bold ${selectedItem.shape === s ? 'border-[#007bc0] bg-blue-50 text-[#007bc0]' : 'border-gray-200 bg-white text-gray-500'}`}
                      >{s === 'L_SHAPE' ? 'L' : s.slice(0, 4)}</button>
                    ))}
                  </div>
                </div>
              )}

              {(selectedItem.item_type === 'ROOM' || selectedItem.item_type === 'FACILITY') && (
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Color</label>
                  <input
                    type="color" value={selectedItem.color || '#eff6ff'}
                    onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, color: e.target.value } : it), false)}
                    className="w-full h-8"
                  />
                </div>
              )}

              {selectedItem.item_type === 'ZONE' && (
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Zone Name</label>
                  <input
                    value={selectedItem.label || ''}
                    onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, label: e.target.value } : it), false)}
                    className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                  />
                  <label className="block font-semibold text-gray-600 mb-1 mt-2">Color</label>
                  <input
                    type="color"
                    value={selectedItem.color || '#60a5fa'}
                    onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, color: e.target.value } : it), false)}
                    className="w-full h-8"
                  />
                </div>
              )}

              {(selectedItem.item_type === 'ROOM') && (
                <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2">
                  <div><span className="block text-[9px] text-gray-500 uppercase font-semibold">Capacity</span><span className="font-bold">{liveResourceStatus?.capacity ?? selectedItem.properties?.capacity ?? '—'}</span></div>
                  <div><span className="block text-[9px] text-gray-500 uppercase font-semibold">Live Status</span><span className="font-bold">{liveResourceStatus?.status ?? 'Not yet published'}</span></div>
                </div>
              )}
              {selectedItem.item_type === 'SEAT' && (
                <div className="bg-gray-50 rounded-lg p-2">
                  <span className="block text-[9px] text-gray-500 uppercase font-semibold">Live Status</span>
                  <span className="font-bold">{liveResourceStatus?.status ?? selectedItem.properties?.status ?? 'Not yet published'}</span>
                </div>
              )}

              {(selectedItem.item_type === 'SEAT' || selectedItem.item_type === 'ROOM') && (
                <button
                  onClick={() => selectedItem.item_type === 'SEAT' ? openEditSeat(selectedItem) : openEditRoom(selectedItem)}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#007bc0] font-bold rounded-lg"
                >
                  Edit {selectedItem.item_type === 'SEAT' ? 'Seat' : 'Room'} Details
                </button>
              )}

              {selectedItem.item_type === 'ROOM' && (
                <p className="text-[10px] text-gray-400">Click a facility in the library while this room is selected to place it inside.</p>
              )}

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Zone Assignment</label>
                <select
                  value={selectedItem.zone_item_id || ''}
                  onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, zone_item_id: e.target.value || null } : it))}
                  className="w-full px-2.5 py-1.5 bg-gray-50 border border-gray-300 rounded-lg"
                >
                  <option value="">No zone</option>
                  {items.filter(i => i.item_type === 'ZONE').map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {selectedIds.length > 1 && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="text-[11px] font-bold text-gray-500 uppercase mb-2">Align ({selectedIds.length} selected)</p>
              <div className="flex gap-2">
                <button onClick={() => alignSelected('left')} className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-[11px]">Align Left</button>
                <button onClick={() => alignSelected('top')} className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold text-[11px]">Align Top</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Seat modal */}
      {seatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-3">
            <button onClick={() => setSeatModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-base font-bold text-gray-800">{editingSeatId ? 'Edit Seat' : 'Add Seat'}</h3>
            <form onSubmit={handleSaveSeatForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Seat Number</label>
                <input required value={seatForm.seat_number} onChange={(e) => setSeatForm({ ...seatForm, seat_number: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Seat Type</label>
                  <select value={seatForm.seat_type} onChange={(e) => setSeatForm({ ...seatForm, seat_type: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl">
                    <option value="STANDARD">Standard</option>
                    <option value="ERGONOMIC">Ergonomic</option>
                    <option value="WINDOW">Window</option>
                    <option value="QUIET_ZONE">Quiet Zone</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Status</label>
                  <select value={seatForm.status} onChange={(e) => setSeatForm({ ...seatForm, status: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl">
                    <option value="AVAILABLE">Available</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Price per slot (₹)</label>
                <input type="number" min="0" value={seatForm.price} onChange={(e) => setSeatForm({ ...seatForm, price: Number(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
              </div>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={seatForm.monitor_available} onChange={(e) => setSeatForm({ ...seatForm, monitor_available: e.target.checked })} /> Monitor</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={seatForm.power_available} onChange={(e) => setSeatForm({ ...seatForm, power_available: e.target.checked })} /> Power</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={seatForm.near_window} onChange={(e) => setSeatForm({ ...seatForm, near_window: e.target.checked })} /> Window</label>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSeatModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow">{editingSeatId ? 'Save' : 'Add to Floor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Room modal */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-3">
            <button onClick={() => setRoomModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-base font-bold text-gray-800">{editingRoomId ? 'Edit Room' : 'Add Meeting/Conference Room'}</h3>
            <form onSubmit={handleSaveRoomForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Room Name</label>
                <input required value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
              </div>
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Room Shape</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {ROOM_SHAPES.map((s) => {
                    const shapeClass = s === 'CIRCLE' ? 'rounded-full' : s === 'OVAL' ? 'rounded-full aspect-[3/2]' : s === 'SQUARE' ? 'rounded-sm' : s === 'L_SHAPE' ? 'rounded-sm' : s === 'CUSTOM' ? 'rounded-md border-dashed' : 'rounded-sm';
                    const active = roomForm.shape === s;
                    return (
                      <button
                        key={s} type="button" title={s.replace('_', ' ')}
                        onClick={() => setRoomForm({ ...roomForm, shape: s })}
                        className={`flex flex-col items-center gap-1 py-1.5 rounded-lg border ${active ? 'border-[#007bc0] bg-blue-50' : 'border-gray-200 bg-white'}`}
                      >
                        <div className={`w-4 h-4 border-2 ${active ? 'border-[#007bc0]' : 'border-gray-400'} ${shapeClass}`} />
                        <span className="text-[8px] font-bold text-gray-500">{s === 'L_SHAPE' ? 'L' : s.slice(0, 4)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Room Number</label>
                  <input value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Type</label>
                  <select value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl">
                    <option value="MEETING_ROOM">Meeting Room</option>
                    <option value="CONFERENCE_ROOM">Conference Room</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Capacity</label>
                  <input type="number" min="1" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Cost / hour (₹)</label>
                  <input type="number" min="0" value={roomForm.price_per_hour} onChange={(e) => setRoomForm({ ...roomForm, price_per_hour: Number(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRoomModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow">{editingRoomId ? 'Save' : 'Add to Floor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Room Generator */}
      {aiModalOpen && (
        <AiRoomGeneratorModal
          facilities={facilities}
          submitting={aiGenerating}
          error={aiError}
          onCancel={() => setAiModalOpen(false)}
          onSubmit={handleGenerate}
        />
      )}
      {aiPreview && (
        <AiRoomProposalPreview
          canvasWidth={floor.canvas_width}
          canvasHeight={floor.canvas_height}
          currentDraftItems={items}
          proposal={aiPreview}
          regeneratingRoom={aiRegeneratingRoom}
          error={aiError}
          onAcceptAndSave={handleAcceptAndSave}
          onEditLayout={handleEditLayoutFromProposal}
          onRegenerateAll={handleRegenerateAll}
          onRegenerateOne={handleRegenerateOne}
          onCancel={() => setAiPreview(null)}
        />
      )}
    </div>
  );
};

export default FloorPlanEditor;
