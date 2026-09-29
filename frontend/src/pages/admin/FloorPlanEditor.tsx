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
  CheckCircle2, Eye, Edit3, Clock, AlertTriangle, Building2, Bot
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

  // DB entities for linking existing rooms and seats without duplicates
  const [dbRooms, setDbRooms] = useState<any[]>([]);
  const [dbSeats, setDbSeats] = useState<any[]>([]);

  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingSeatId, setEditingSeatId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

  const [seatForm, setSeatForm] = useState({
    seat_id: null as string | null,
    seat_number: '',
    seat_type: 'STANDARD',
    price: 100,
    status: 'AVAILABLE',
    monitor_available: false,
    power_available: false,
    near_window: false
  });

  const [roomForm, setRoomForm] = useState({
    room_id: null as string | null,
    name: '',
    room_number: '',
    room_type: 'MEETING_ROOM',
    capacity: 4,
    price_per_hour: 500,
    shape: 'RECTANGLE' as LayoutItem['shape']
  });

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiRegeneratingRoom, setAiRegeneratingRoom] = useState<string | null>(null);
  const [aiPreview, setAiPreview] = useState<GenerateRoomsResponse | null>(null);
  const [aiLastRequest, setAiLastRequest] = useState<GenerateRoomsRequest | null>(null);
  const [aiError, setAiError] = useState('');

  // Workflow modes: 'edit' (Draft editor), 'preview' (Live employee view), '3d' (3D isometric view)
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | '3d'>('edit');
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
      const [floorsRes, layoutRes, facRes, roomsRes, seatsRes] = await Promise.all([
        api.get('/floor-plans/floors'),
        api.get(`/floor-plans/floors/${floorId}/layout`, { params: { draft: true } }),
        api.get('/facilities/'),
        api.get('/rooms/').catch(() => ({ data: [] })),
        api.get('/seats/').catch(() => ({ data: [] }))
      ]);
      const f = (floorsRes.data || []).find((fl: any) => fl.id === floorId);
      setFloor(f || null);
      setItems(layoutRes.data || []);
      setLastSavedItems(layoutRes.data || []);
      setFacilities(facRes.data || []);
      setDbRooms(roomsRes.data || []);
      setDbSeats(seatsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [floorId]);

  // Warn before closing the tab/reloading with unsaved changes.
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
    setSeatForm({
      seat_id: null,
      seat_number: '',
      seat_type: 'STANDARD',
      price: 100,
      status: 'AVAILABLE',
      monitor_available: false,
      power_available: false,
      near_window: false
    });
    setSeatModalOpen(true);
  };

  const openEditSeat = (item: LayoutItem) => {
    setEditingSeatId(item.id);
    setSeatForm({
      seat_id: item.seat_id || null,
      seat_number: item.properties?.seat_number || item.label || '',
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
    const { seat_id, ...seatProps } = seatForm;
    if (editingSeatId) {
      applyItems(items.map(it => it.id === editingSeatId ? { ...it, label: seatForm.seat_number, seat_id: seat_id || it.seat_id || null, properties: { ...it.properties, ...seatProps } } : it));
    } else {
      const { items: withRoom, roomId } = getOrCreateDefaultWorkspace(items);
      const seat: LayoutItem = {
        id: newId(), item_type: 'SEAT', parent_item_id: roomId, label: seatForm.seat_number,
        x: 60, y: 60, width: 40, height: 40, rotation: 0, shape: 'SQUARE', z_index: 1,
        seat_id: seat_id || null,
        properties: { ...seatProps },
      };
      applyItems([...withRoom, seat]);
    }
    setSeatModalOpen(false);
  };

  // ----- Add / Edit Meeting/Conference Room -----
  const ROOM_SHAPES: LayoutItem['shape'][] = ['RECTANGLE', 'SQUARE', 'CIRCLE', 'OVAL', 'L_SHAPE', 'CUSTOM'];

  const defaultSizeForShape = (shape: LayoutItem['shape']): { width: number; height: number } => {
    if (shape === 'CIRCLE' || shape === 'SQUARE') return { width: 160, height: 160 };
    if (shape === 'OVAL') return { width: 220, height: 140 };
    if (shape === 'L_SHAPE') return { width: 220, height: 180 };
    return { width: 180, height: 140 };
  };

  const openAddRoom = () => {
    setEditingRoomId(null);
    setRoomForm({ room_id: null, name: '', room_number: '', room_type: 'MEETING_ROOM', capacity: 4, price_per_hour: 500, shape: 'RECTANGLE' });
    setRoomModalOpen(true);
  };

  const openEditRoom = (item: LayoutItem) => {
    setEditingRoomId(item.id);
    setRoomForm({
      room_id: item.room_id || null,
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
    const { shape, room_id, ...roomProps } = roomForm;
    if (editingRoomId) {
      applyItems(items.map(it => {
        if (it.id !== editingRoomId) return it;
        const sizePatch = it.shape !== shape ? defaultSizeForShape(shape) : {};
        return { 
          ...it, 
          label: roomForm.name, 
          shape, 
          room_id: room_id || it.room_id || null, 
          ...sizePatch, 
          properties: { ...it.properties, ...roomProps } 
        };
      }));
    } else {
      const room: LayoutItem = {
        id: newId(), item_type: 'ROOM', label: roomForm.name,
        x: 100, y: 100, ...defaultSizeForShape(shape), rotation: 0, shape, z_index: 1,
        room_id: room_id || null,
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
      rotation: 0, shape: 'RECTANGLE', z_index: type === 'ZONE' ? -1 : 2,
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
        alert('Floor plan published successfully! Employees can now view and book this workspace layout.');
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

  // ----- AI proposals -----
  const handleGenerate = async (req: GenerateRoomsRequest) => {
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/generate-rooms`, req);
      setAiPreview(res.data);
      setAiLastRequest(req);
      setAiModalOpen(false);
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'AI generation failed.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRegenerateAll = async () => {
    if (!aiLastRequest) return;
    setAiGenerating(true);
    setAiError('');
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/generate-rooms`, aiLastRequest);
      setAiPreview(res.data);
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'AI regeneration failed.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleRegenerateOne = async (proposedRoomId: string) => {
    if (!aiPreview || !aiLastRequest) return;
    const targetBundle = aiPreview.rooms.find(b => b.room.id === proposedRoomId);
    if (!targetBundle) return;
    setAiRegeneratingRoom(proposedRoomId);
    setAiError('');
    try {
      const res = await api.post(`/floor-plans/floors/${floorId}/generate-rooms`, {
        ...aiLastRequest,
        regenerate_room_name: targetBundle.spec.name,
        pending_rooms: aiPreview.rooms.map(b => b.spec),
      });
      const newBundle = res.data.rooms[0];
      if (newBundle) {
        setAiPreview({
          ...aiPreview,
          rooms: aiPreview.rooms.map(b => b.room.id === proposedRoomId ? newBundle : b),
          issues: res.data.issues || []
        });
      }
    } catch (err: any) {
      setAiError(err.response?.data?.detail || 'Regeneration failed.');
    } finally {
      setAiRegeneratingRoom(null);
    }
  };

  const handleAcceptAndSave = async () => {
    if (!aiPreview) return;
    const merged = [...items, ...flattenProposal(aiPreview)];
    applyItems(merged);
    setAiPreview(null);
    await handleSave(merged);
  };

  const handleEditLayoutFromProposal = () => {
    if (!aiPreview) return;
    const merged = [...items, ...flattenProposal(aiPreview)];
    applyItems(merged);
    setAiPreview(null);
  };

  const handleBack = () => {
    if (isDirty && !window.confirm('You have unsaved floor layout changes. Leave anyway?')) return;
    navigate('/admin/floor-plans');
  };

  if (loading || !floor) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-4 border-[#007bc0] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-gray-500">Loading Floor Canvas...</p>
        </div>
      </div>
    );
  }

  const facilitiesByCategory: Record<string, any[]> = {};
  facilities.forEach(f => {
    const c = f.category || 'General';
    if (!facilitiesByCategory[c]) facilitiesByCategory[c] = [];
    facilitiesByCategory[c].push(f);
  });

  const selectedItem = selectedIds.length === 1 ? items.find(i => i.id === selectedIds[0]) : null;

  return (
    <div ref={editorContainerRef} className={`space-y-4 ${isFullscreen ? 'p-6 bg-gray-50 overflow-auto h-screen' : ''}`}>
      {/* Draft -> Preview -> Published Workflow Header */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button onClick={handleBack} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-600 transition">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-gray-900">{floor.name} Layout Workspace</h1>
              {floor.has_draft_changes || isDirty ? (
                <span className="px-2.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
                  <Clock size={11} /> DRAFT CHANGES
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-extrabold rounded-full inline-flex items-center gap-1">
                  <CheckCircle2 size={11} /> PUBLISHED LIVE
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {isDirty ? <span className="text-amber-600 font-bold">Unsaved draft edits present</span> : 'Draft matches saved state'}
              {floor.published_at && <span className="text-gray-400"> &bull; Published {new Date(floor.published_at).toLocaleDateString()}</span>}
            </p>
          </div>
        </div>

        {/* Workflow Mode Switcher Segmented Control */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode('edit')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'edit' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Edit3 size={14} /> Edit Draft
            </button>

            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'preview' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Eye size={14} /> Employee Preview
            </button>

            <button
              onClick={() => setViewMode('3d')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === '3d' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Box size={14} /> 3D View
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <Save size={14} /> {saving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={handlePublish}
              disabled={publishing || isDirty}
              title={isDirty ? 'Save draft changes before publishing' : 'Publish to live portal'}
              className="px-4 py-2 bg-[#007bc0] hover:bg-[#005a8c] text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5 disabled:opacity-40"
            >
              <UploadCloud size={14} /> {publishing ? 'Publishing...' : 'Publish Layout'}
            </button>
          </div>
        </div>
      </div>

      {/* Editor toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-gray-200 rounded-2xl p-2.5 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto">
          {viewMode === 'edit' && (
            <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
              <button
                onClick={() => cancelDrawing()} title="Select Tool"
                className={`p-2 rounded-lg transition ${drawTool === 'select' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              ><MousePointer2 size={15} /></button>
              <button
                onClick={() => { setDrawTool('wall'); setWallStart(null); }} title="Draw Wall"
                className={`p-2 rounded-lg transition ${drawTool === 'wall' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              ><PenLine size={15} /></button>
              <button
                onClick={() => { setDrawTool('polygon'); setPolygonPoints([]); }} title="Draw Custom Polygon Room"
                className={`p-2 rounded-lg transition ${drawTool === 'polygon' ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              ><Spline size={15} /></button>
              {drawTool === 'polygon' && (
                <>
                  <span className="text-[10px] font-bold text-gray-500 px-1">{(polygonPoints?.length || 0)} point(s)</span>
                  <button onClick={finishPolygon} className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold">Finish</button>
                  <button onClick={cancelDrawing} className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-[10px] font-bold">Cancel</button>
                </>
              )}
            </div>
          )}

          {viewMode === 'edit' && (
            <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
              <button onClick={undo} title="Undo" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><Undo2 size={15} /></button>
              <button onClick={redo} title="Redo" className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600"><Redo2 size={15} /></button>
              <button onClick={duplicateSelected} title="Duplicate" disabled={!selectedIds.length} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 disabled:opacity-40"><Copy size={15} /></button>
              <button onClick={deleteSelected} title="Delete" disabled={!selectedIds.length} className="p-2 bg-red-50 hover:bg-red-100 rounded-lg text-red-600 disabled:opacity-40"><Trash2 size={15} /></button>
            </div>
          )}

          <div className="flex items-center gap-1 pr-2 border-r border-gray-100">
            <button
              onClick={() => setShowGrid(g => !g)} title="Toggle grid"
              className={`p-2 rounded-lg transition ${showGrid ? 'bg-blue-50 text-[#007bc0]' : 'bg-gray-100 text-gray-400'}`}
            ><Grid3x3 size={15} /></button>
            <button
              onClick={() => setSnapEnabled(s => !s)} title="Toggle snap-to-grid"
              className={`p-2 rounded-lg transition ${snapEnabled ? 'bg-blue-50 text-[#007bc0]' : 'bg-gray-100 text-gray-400'}`}
            ><Magnet size={15} /></button>
          </div>

          {viewMode === '3d' && (
            <button
              onClick={() => setIsoRotation(r => (r === 0 ? 90 : r === 90 ? 180 : r === 180 ? 270 : 0) as 0 | 90 | 180 | 270)}
              title="Rotate 3D Floor 90°" className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600"
            ><RotateCw size={15} /></button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {issues.length === 0 ? (
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg border border-emerald-200 flex items-center gap-1">
              <CheckCircle2 size={13} /> Layout Valid
            </span>
          ) : (
            <span className="px-3 py-1 bg-amber-50 text-amber-800 text-xs font-bold rounded-lg border border-amber-300 flex items-center gap-1">
              <AlertTriangle size={13} /> {issues.length} Validation Warning(s)
            </span>
          )}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai-chat'))}
            title="Open AI Assistant"
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#007bc0] border border-indigo-200 flex items-center gap-1.5 text-xs font-bold transition shadow-sm"
          >
            <Bot size={15} />
            AI Assistant
          </button>
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Full Screen" : "Open Full Screen"}
            className="px-3 py-1.5 rounded-xl bg-gray-900 hover:bg-black text-white flex items-center gap-1.5 text-xs font-bold transition shadow-sm"
          >
            {isFullscreen ? <><Minimize size={15} /> Exit Full Screen</> : <><Maximize size={15} /> Open Full Screen</>}
          </button>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
          <div className="flex items-center gap-1.5 font-bold"><ShieldAlert size={14} /> Layout configuration issues found:</div>
          {issues.map((iss, idx) => <div key={idx} className="pl-5">&bull; {iss.message}</div>)}
        </div>
      )}

      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-240px)] min-h-[520px]">
        {/* Facility & Item library sidebar */}
        <div className="col-span-12 lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-4 overflow-y-auto space-y-4">
          <div>
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Place Layout Objects</h3>
            <div className="space-y-2">
              <button onClick={openAddSeat} className="w-full flex items-center justify-between px-3 py-2 bg-blue-50 hover:bg-blue-100 rounded-xl text-xs font-bold text-[#007bc0] transition">
                <span className="flex items-center gap-2"><Armchair size={15} /> Add Workspace Seat</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-blue-200">+ Seat</span>
              </button>

              <button onClick={openAddRoom} className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 hover:bg-indigo-100 rounded-xl text-xs font-bold text-indigo-700 transition">
                <span className="flex items-center gap-2"><DoorOpen size={15} /> Add Room / Zone</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-indigo-200">+ Room</span>
              </button>

              <button onClick={() => { setAiError(''); setAiModalOpen(true); }} className="w-full flex items-center justify-between px-3 py-2 bg-purple-50 hover:bg-purple-100 rounded-xl text-xs font-bold text-purple-700 transition">
                <span className="flex items-center gap-2"><Sparkles size={15} /> AI Room Generator</span>
                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-purple-200">Auto</span>
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Architectural Shapes</h3>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => addSimpleItem('ZONE')} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 border border-gray-200/80">
                <Layers size={14} className="text-blue-500" /> Zone Area
              </button>
              <button onClick={() => addSimpleItem('WALL')} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 border border-gray-200/80">
                <RectangleHorizontal size={14} className="text-gray-600" /> Wall Partition
              </button>
              <button onClick={() => addSimpleItem('DOOR')} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 border border-gray-200/80">
                <Square size={14} className="text-amber-600" /> Doorway
              </button>
              <button onClick={() => addSimpleItem('WINDOW')} className="flex items-center gap-2 p-2 bg-gray-50 hover:bg-gray-100 rounded-xl text-xs font-semibold text-gray-700 border border-gray-200/80">
                <Square size={14} className="text-sky-500" /> Window
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Facility & Amenities Library</h3>
            {Object.keys(facilitiesByCategory).length === 0 && <p className="text-xs text-gray-400 italic">No facility items available.</p>}
            {Object.entries(facilitiesByCategory).map(([cat, facs]) => (
              <div key={cat} className="mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{cat}</p>
                <div className="flex flex-wrap gap-1.5">
                  {facs.map(f => (
                    <button key={f.id} onClick={() => addFacility(f)} className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold rounded-lg border border-amber-200 transition">
                      {f.name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Canvas Center */}
        <div className="col-span-12 lg:col-span-6 bg-gray-100 rounded-2xl overflow-hidden border border-gray-200 shadow-inner flex flex-col">
          <FloorPlanCanvas
            mode={viewMode === '3d' ? 'isometric' : viewMode === 'preview' ? 'view' : 'edit'}
            canvasWidth={floor.canvas_width}
            canvasHeight={floor.canvas_height}
            items={items}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onItemsChange={(next) => applyItems(next)}
            onCanvasClick={viewMode === 'edit' && drawTool !== 'select' ? handleCanvasClick : undefined}
            showGrid={showGrid}
            snapToGrid={snapEnabled}
            isoRotation={isoRotation}
          />
        </div>

        {/* Item Properties Panel */}
        <div className="col-span-12 lg:col-span-3 bg-white border border-gray-200 rounded-2xl p-4 overflow-y-auto space-y-4">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Properties & Selection</h3>
          {!selectedItem ? (
            <div className="p-4 bg-gray-50 rounded-xl text-center text-xs text-gray-400">
              Select an item on the canvas to inspect or edit its properties.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{selectedItem.label || selectedItem.item_type}</span>
                  <span className="px-2 py-0.5 bg-white text-[#007bc0] border border-blue-200 text-[10px] font-extrabold rounded-md uppercase">
                    {selectedItem.item_type}
                  </span>
                </div>
                {selectedItem.shape && (
                  <p className="text-[10px] text-gray-500 mt-1 font-semibold">Shape: {selectedItem.shape}</p>
                )}
              </div>

              {(selectedItem.item_type === 'SEAT' || selectedItem.item_type === 'ROOM') && (
                <button
                  onClick={() => selectedItem.item_type === 'SEAT' ? openEditSeat(selectedItem) : openEditRoom(selectedItem)}
                  className="w-full py-2 bg-blue-50 hover:bg-blue-100 text-[#007bc0] font-bold rounded-xl border border-blue-200 transition"
                >
                  Edit {selectedItem.item_type === 'SEAT' ? 'Seat' : 'Room'} Configuration
                </button>
              )}

              {liveResourceStatus && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-emerald-800 block">Live DB Item State</span>
                  <p className="text-emerald-700">Status: <b>{liveResourceStatus.status}</b></p>
                  {liveResourceStatus.capacity != null && (
                    <p className="text-emerald-700">Capacity: <b>{liveResourceStatus.capacity} Persons</b></p>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-gray-100">
                <label className="block font-semibold text-gray-600">Label / Name</label>
                <input
                  type="text"
                  value={selectedItem.label || ''}
                  onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, label: e.target.value } : it))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-gray-600">Width (px)</label>
                  <input
                    type="number"
                    value={selectedItem.width}
                    onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, width: Number(e.target.value) } : it))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600">Height (px)</label>
                  <input
                    type="number"
                    value={selectedItem.height}
                    onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, height: Number(e.target.value) } : it))}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Zone Assignment</label>
                <select
                  value={selectedItem.zone_item_id || ''}
                  onChange={(e) => applyItems(items.map(it => it.id === selectedItem.id ? { ...it, zone_item_id: e.target.value || null } : it))}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                >
                  <option value="">No zone</option>
                  {items.filter(i => i.item_type === 'ZONE').map(z => <option key={z.id} value={z.id}>{z.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {selectedIds.length > 1 && (
            <div className="pt-3 border-t border-gray-100 space-y-2">
              <p className="text-[11px] font-bold text-gray-500 uppercase">Align Selected ({selectedIds.length})</p>
              <div className="flex gap-2">
                <button onClick={() => alignSelected('left')} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-gray-700">Align Left</button>
                <button onClick={() => alignSelected('top')} className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl font-bold text-xs text-gray-700">Align Top</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Seat Modal with DB Link Dropdown */}
      {seatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-3">
            <button onClick={() => setSeatModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-base font-bold text-gray-800">{editingSeatId ? 'Edit Seat Details' : 'Add Seat to Floor'}</h3>
            
            <form onSubmit={handleSaveSeatForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Link to Existing DB Seat (Optional)</label>
                <select
                  value={seatForm.seat_id || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedSt = dbSeats.find(s => s.id === selectedId);
                    if (selectedSt) {
                      setSeatForm(prev => ({
                        ...prev,
                        seat_id: selectedSt.id,
                        seat_number: selectedSt.seat_number,
                        seat_type: selectedSt.seat_type || 'STANDARD',
                        price: selectedSt.price || 100,
                        status: selectedSt.status || 'AVAILABLE'
                      }));
                    } else {
                      setSeatForm(prev => ({ ...prev, seat_id: null }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                >
                  <option value="">Create New Seat or Unlinked</option>
                  {dbSeats
                    .filter(s => {
                      if (!floor?.branch_id) return true;
                      const parentRoom = dbRooms.find(r => r.id === s.room_id);
                      return parentRoom ? parentRoom.branch_id === floor.branch_id : true;
                    })
                    .map(s => (
                      <option key={s.id} value={s.id}>Desk {s.seat_number} ({s.seat_type || 'STANDARD'})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Seat Number / Code</label>
                <input required value={seatForm.seat_number} onChange={(e) => setSeatForm({ ...seatForm, seat_number: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Seat Type</label>
                  <select value={seatForm.seat_type} onChange={(e) => setSeatForm({ ...seatForm, seat_type: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-medium">
                    <option value="STANDARD">Standard</option>
                    <option value="ERGONOMIC">Ergonomic</option>
                    <option value="WINDOW">Window</option>
                    <option value="QUIET_ZONE">Quiet Zone</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Status</label>
                  <select value={seatForm.status} onChange={(e) => setSeatForm({ ...seatForm, status: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-medium">
                    <option value="AVAILABLE">Available</option>
                    <option value="DISABLED">Disabled</option>
                    <option value="MAINTENANCE">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Price per slot (₹)</label>
                <input type="number" min="0" value={seatForm.price} onChange={(e) => setSeatForm({ ...seatForm, price: Number(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-semibold" />
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={seatForm.monitor_available} onChange={(e) => setSeatForm({ ...seatForm, monitor_available: e.target.checked })} /> Monitor</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={seatForm.power_available} onChange={(e) => setSeatForm({ ...seatForm, power_available: e.target.checked })} /> Power</label>
                <label className="flex items-center gap-1.5 cursor-pointer"><input type="checkbox" checked={seatForm.near_window} onChange={(e) => setSeatForm({ ...seatForm, near_window: e.target.checked })} /> Window</label>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setSeatModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow">{editingSeatId ? 'Save Configuration' : 'Add to Floor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Room Modal with DB Link & Shape Selector */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-3">
            <button onClick={() => setRoomModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            <h3 className="text-base font-bold text-gray-800">{editingRoomId ? 'Edit Room Configuration' : 'Add Meeting / Conference Room'}</h3>
            
            <form onSubmit={handleSaveRoomForm} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-gray-600 mb-1">Link to Existing DB Room (Optional)</label>
                <select
                  value={roomForm.room_id || ''}
                  onChange={(e) => {
                    const selectedId = e.target.value;
                    const selectedRm = dbRooms.find(r => r.id === selectedId);
                    if (selectedRm) {
                      setRoomForm(prev => ({
                        ...prev,
                        room_id: selectedRm.id,
                        name: selectedRm.name,
                        room_type: selectedRm.room_type || 'MEETING_ROOM',
                        capacity: selectedRm.capacity || 4,
                        price_per_hour: selectedRm.price_per_hour || 500
                      }));
                    } else {
                      setRoomForm(prev => ({ ...prev, room_id: null }));
                    }
                  }}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl"
                >
                  <option value="">Create New Room or Unlinked</option>
                  {dbRooms
                    .filter(r => !floor?.branch_id || r.branch_id === floor.branch_id)
                    .map(r => (
                      <option key={r.id} value={r.id}>{r.name} ({r.room_type || 'WORKSPACE'})</option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Room Name</label>
                <input required value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-bold" />
              </div>

              <div>
                <label className="block font-semibold text-gray-600 mb-1">Room Architectural Shape</label>
                <div className="grid grid-cols-6 gap-1.5">
                  {ROOM_SHAPES.map((s) => {
                    const shapeClass = s === 'CIRCLE' ? 'rounded-full' : s === 'OVAL' ? 'rounded-full aspect-[3/2]' : s === 'SQUARE' ? 'rounded-sm' : s === 'L_SHAPE' ? 'rounded-sm' : s === 'CUSTOM' ? 'rounded-md border-dashed' : 'rounded-sm';
                    const active = roomForm.shape === s;
                    return (
                      <button
                        key={s} type="button" title={s.replace('_', ' ')}
                        onClick={() => setRoomForm({ ...roomForm, shape: s })}
                        className={`flex flex-col items-center gap-1 py-1.5 rounded-lg border transition ${active ? 'border-[#007bc0] bg-blue-50 ring-2 ring-[#007bc0]/20' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                      >
                        <div className={`w-4 h-4 border-2 ${active ? 'border-[#007bc0]' : 'border-gray-400'} ${shapeClass}`} />
                        <span className="text-[8px] font-bold text-gray-600">{s === 'L_SHAPE' ? 'L-Shape' : s.slice(0, 4)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Room Code / Number</label>
                  <input value={roomForm.room_number} onChange={(e) => setRoomForm({ ...roomForm, room_number: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Type</label>
                  <select value={roomForm.room_type} onChange={(e) => setRoomForm({ ...roomForm, room_type: e.target.value })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-medium">
                    <option value="WORKSPACE">Open Workspace</option>
                    <option value="MEETING_ROOM">Meeting Room</option>
                    <option value="CONFERENCE_ROOM">Conference Room</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Max Capacity</label>
                  <input type="number" min="1" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: Number(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-semibold" />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Cost / hour (₹)</label>
                  <input type="number" min="0" value={roomForm.price_per_hour} onChange={(e) => setRoomForm({ ...roomForm, price_per_hour: Number(e.target.value) })} className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl font-semibold" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRoomModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                <button type="submit" className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow">{editingRoomId ? 'Save Configuration' : 'Add to Floor'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Room Generator Modals */}
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
