import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import {
  Building2, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle,
  LayoutGrid, Copy, CheckCircle2, XCircle, Armchair, DoorOpen, Wrench, Clock, Sparkles,
  Bot, Maximize, Minimize, MessageSquare
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

interface FloorStats {
  id: string;
  branch_id: string;
  branch_name: string;
  name: string;
  floor_number: number;
  status: string;
  has_draft_changes: boolean;
  published_at: string | null;
  updated_at: string;
  total_seats: number;
  available_seats: number;
  meeting_rooms: number;
  facilities_count: number;
}

export const AdminFloorPlans: React.FC = () => {
  const navigate = useNavigate();
  const [floors, setFloors] = useState<FloorStats[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isFullScreen, setIsFullScreen] = useState(false);

  const [buildingModalOpen, setBuildingModalOpen] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ location_id: '', name: '', address: '' });
  const [savingBuilding, setSavingBuilding] = useState(false);

  const [floorModalOpen, setFloorModalOpen] = useState(false);
  const [editingFloorId, setEditingFloorId] = useState<string | null>(null);
  const [floorForm, setFloorForm] = useState({
    branch_id: '', name: '', floor_number: 0, canvas_width: 1200, canvas_height: 800, status: 'ACTIVE'
  });
  const [savingFloor, setSavingFloor] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [floorsRes, branchesRes, locationsRes] = await Promise.all([
        api.get('/floor-plans/floors'),
        api.get('/branches/'),
        api.get('/locations/'),
      ]);
      setFloors(floorsRes.data || []);
      setBranches(branchesRes.data || []);
      setLocations(locationsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const getBranchName = (id: string) => branches.find(b => b.id === id)?.name || 'Unknown';

  // ----- Add Building (= existing Branch entity, see CLAUDE.md for why) -----
  const openAddBuilding = () => {
    setBuildingForm({ location_id: locations[0]?.id || '', name: '', address: '' });
    setError('');
    setBuildingModalOpen(true);
  };

  const handleAddBuilding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBuilding(true);
    setError('');
    try {
      await api.post('/branches/', { ...buildingForm, status: 'ACTIVE' });
      setBuildingModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create building');
    } finally {
      setSavingBuilding(false);
    }
  };

  // ----- Add / Edit Floor -----
  const openAddFloor = (branchId?: string) => {
    setEditingFloorId(null);
    setFloorForm({
      branch_id: branchId || branches[0]?.id || '', name: '', floor_number: 0,
      canvas_width: 1200, canvas_height: 800, status: 'ACTIVE'
    });
    setError('');
    setFloorModalOpen(true);
  };

  const openEditFloor = (floor: FloorStats) => {
    setEditingFloorId(floor.id);
    setFloorForm({
      branch_id: floor.branch_id, name: floor.name, floor_number: floor.floor_number,
      canvas_width: 1200, canvas_height: 800, status: floor.status
    });
    setError('');
    setFloorModalOpen(true);
  };

  const handleSaveFloor = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingFloor(true);
    setError('');
    try {
      if (editingFloorId) {
        await api.put(`/floor-plans/floors/${editingFloorId}`, {
          name: floorForm.name, floor_number: floorForm.floor_number, status: floorForm.status
        });
      } else {
        await api.post('/floor-plans/floors', floorForm);
      }
      setFloorModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save floor');
    } finally {
      setSavingFloor(false);
    }
  };

  const handleDuplicateFloor = async (floorId: string) => {
    try {
      await api.post(`/floor-plans/floors/${floorId}/duplicate`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to duplicate floor');
    }
  };

  const handleToggleActive = async (floor: FloorStats) => {
    try {
      await api.put(`/floor-plans/floors/${floor.id}`, { status: floor.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' });
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to update floor status');
    }
  };

  const handleDeleteFloor = async (floorId: string) => {
    if (!window.confirm('Delete this floor? This only works if it has never been published.')) return;
    try {
      await api.delete(`/floor-plans/floors/${floorId}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete floor');
    }
  };

  const handleBootstrapFloor = async (branchId: string) => {
    setLoading(true);
    try {
      const branchObj = branches.find(b => b.id === branchId);
      const branchName = branchObj ? branchObj.name : 'Main';
      const fRes = await api.post('/floor-plans/floors', {
        branch_id: branchId,
        name: `${branchName} - Main Floor`,
        floor_number: 1,
        canvas_width: 1200,
        canvas_height: 800,
        status: 'ACTIVE'
      });
      const newFloor = fRes.data;

      const [rRes, sRes] = await Promise.all([
        api.get('/rooms/'),
        api.get('/seats/').catch(() => ({ data: [] }))
      ]);
      const branchRooms = (rRes.data || []).filter((r: any) => r.branch_id === branchId);
      const branchSeats = sRes.data || [];

      let currentX = 50;
      let currentY = 50;
      const initialItems: any[] = [];

      branchRooms.forEach((rm: any) => {
        const isMeeting = rm.room_type === 'MEETING_ROOM';
        const isConf = rm.room_type === 'CONFERENCE_ROOM';
        const shape = isConf ? 'OVAL' : isMeeting ? 'CIRCLE' : 'RECTANGLE';
        const width = isConf ? 260 : isMeeting ? 180 : 360;
        const height = isConf ? 180 : isMeeting ? 180 : 240;

        const roomItemId = `init-room-${rm.id}`;
        initialItems.push({
          id: roomItemId,
          item_type: 'ROOM',
          label: rm.name,
          x: currentX,
          y: currentY,
          width,
          height,
          rotation: 0,
          shape,
          z_index: 1,
          room_id: rm.id,
          properties: {
            name: rm.name,
            room_type: rm.room_type || 'WORKSPACE',
            capacity: rm.capacity || 10,
            price_per_hour: rm.price_per_hour || 0
          }
        });

        const roomSeats = branchSeats.filter((s: any) => s.room_id === rm.id);
        let seatX = currentX + 20;
        let seatY = currentY + 40;
        roomSeats.forEach((st: any) => {
          initialItems.push({
            id: `init-seat-${st.id}`,
            item_type: 'SEAT',
            parent_item_id: roomItemId,
            label: st.seat_number,
            x: seatX,
            y: seatY,
            width: 32,
            height: 32,
            rotation: 0,
            shape: 'RECTANGLE',
            z_index: 2,
            seat_id: st.id,
            properties: {
              seat_number: st.seat_number,
              seat_type: st.seat_type || 'STANDARD',
              price: st.price || 150,
              status: st.status || 'ACTIVE'
            }
          });
          seatX += 40;
          if (seatX + 40 > currentX + width - 10) {
            seatX = currentX + 20;
            seatY += 40;
          }
        });

        currentX += width + 40;
        if (currentX + 300 > 1150) {
          currentX = 50;
          currentY += height + 50;
        }
      });

      if (initialItems.length > 0) {
        await api.post(`/floor-plans/floors/${newFloor.id}/save`, { items: initialItems });
      }

      await fetchData();
      navigate(`/admin/floor-plans/${newFloor.id}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to auto-bootstrap floor layout');
    } finally {
      setLoading(false);
    }
  };

  const floorsByBranch = branches.map(b => ({
    branch: b,
    floors: floors.filter(f => f.branch_id === b.id).sort((a, b2) => a.floor_number - b2.floor_number),
  }));

  const openAiAssistant = (prompt?: string) => {
    window.dispatchEvent(new CustomEvent('open-ai-chat', { detail: { prompt } }));
  };

  return (
    <div className={isFullScreen ? 'fixed inset-0 z-50 bg-[#f8fafc] p-6 overflow-auto shadow-2xl space-y-6' : 'space-y-6'}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
            <ChevronRight size={16} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Floor Plan Management</h1>
            <p className="text-xs text-gray-500">Corporate campus floor governance, spatial mapping & AI booking concierge.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => openAiAssistant('Find an available meeting room in the corporate building')}
            className="px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Bot size={16} /> AI Assistant
          </button>
          <button
            onClick={() => setIsFullScreen(!isFullScreen)}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-gray-300"
          >
            {isFullScreen ? <><Minimize size={16} /> Exit Full Screen</> : <><Maximize size={16} /> Open Full Screen</>}
          </button>
          <button
            onClick={openAddBuilding}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-gray-300"
          >
            <Building2 size={16} /> Add Building
          </button>
          <button
            onClick={() => openAddFloor()}
            className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Floor
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-white border border-gray-200 rounded-2xl">
          <Loader2 className="animate-spin text-[#007bc0]" size={36} />
        </div>
      ) : branches.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-2xl">
          <Building2 size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium">No buildings yet. Add one to get started.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {floorsByBranch.map(({ branch, floors: branchFloors }) => (
            <div key={branch.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-5 py-4 bg-gray-50/70 border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Building2 size={18} className="text-[#007bc0]" />
                  <h2 className="font-bold text-gray-800 text-sm">{branch.name}</h2>
                  <span className="text-[10px] text-gray-400">{branchFloors.length} floor{branchFloors.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => openAddFloor(branch.id)}
                  className="text-[11px] font-bold text-[#007bc0] hover:underline flex items-center gap-1"
                >
                  <Plus size={12} /> Add Floor
                </button>
              </div>

              {branchFloors.length === 0 ? (
                <div className="p-8 text-center bg-gray-50/50 space-y-3">
                  <p className="text-xs text-gray-500 font-medium">No floor plan layouts configured for {branch.name} yet.</p>
                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => handleBootstrapFloor(branch.id)}
                      className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-[#007bc0] border border-blue-200 text-xs font-bold rounded-xl shadow-sm transition flex items-center gap-1.5"
                    >
                      <Sparkles size={14} /> Auto-Generate Floor from DB Rooms & Seats
                    </button>
                    <button
                      onClick={() => openAddFloor(branch.id)}
                      className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 text-xs font-bold rounded-xl transition flex items-center gap-1.5"
                    >
                      <Plus size={14} /> Blank Floor
                    </button>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        <th className="py-3 px-4">Floor</th>
                        <th className="py-3 px-4">Total Seats</th>
                        <th className="py-3 px-4">Available</th>
                        <th className="py-3 px-4">Meeting Rooms</th>
                        <th className="py-3 px-4">Facilities</th>
                        <th className="py-3 px-4">Last Updated</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-xs">
                      {branchFloors.map((floor) => (
                        <tr key={floor.id} className="hover:bg-gray-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-gray-800">{floor.name}</div>
                            {floor.has_draft_changes && (
                              <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold text-amber-600">
                                <Clock size={10} /> Unpublished changes
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-700">
                            <span className="inline-flex items-center gap-1"><Armchair size={13} className="text-gray-400" /> {floor.total_seats}</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-emerald-700">{floor.available_seats}</td>
                          <td className="py-3.5 px-4 font-semibold text-gray-700">
                            <span className="inline-flex items-center gap-1"><DoorOpen size={13} className="text-gray-400" /> {floor.meeting_rooms}</span>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-gray-700">
                            <span className="inline-flex items-center gap-1"><Wrench size={13} className="text-gray-400" /> {floor.facilities_count}</span>
                          </td>
                          <td className="py-3.5 px-4 text-gray-500">{new Date(floor.updated_at).toLocaleDateString()}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              floor.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {floor.status === 'ACTIVE' ? <CheckCircle2 size={11} /> : <XCircle size={11} />}
                              {floor.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => navigate(`/admin/floor-plans/${floor.id}`)}
                                title="Manage Layout"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-[#007bc0] rounded-lg transition-all"
                              >
                                <LayoutGrid size={14} />
                              </button>
                              <button onClick={() => openEditFloor(floor)} title="Edit Floor" className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all">
                                <Edit2 size={14} />
                              </button>
                              <button onClick={() => handleDuplicateFloor(floor.id)} title="Duplicate Floor" className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all">
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleToggleActive(floor)}
                                title={floor.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg transition-all"
                              >
                                {floor.status === 'ACTIVE' ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                              </button>
                              <button onClick={() => handleDeleteFloor(floor.id)} title="Delete" className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Building modal */}
      <AnimatePresence>
        {buildingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button onClick={() => setBuildingModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">Add Building</h3>
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <form onSubmit={handleAddBuilding} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Location</label>
                  <select
                    required
                    value={buildingForm.location_id}
                    onChange={(e) => setBuildingForm({ ...buildingForm, location_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  >
                    <option value="">Select Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Building Name</label>
                  <input
                    required
                    placeholder="e.g. Whitefield Tower"
                    value={buildingForm.name}
                    onChange={(e) => setBuildingForm({ ...buildingForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Address</label>
                  <input
                    required
                    value={buildingForm.address}
                    onChange={(e) => setBuildingForm({ ...buildingForm, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setBuildingModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                  <button type="submit" disabled={savingBuilding} className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow">
                    {savingBuilding ? 'Saving...' : 'Add Building'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add/Edit Floor modal */}
      <AnimatePresence>
        {floorModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button onClick={() => setFloorModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">{editingFloorId ? 'Edit Floor' : 'Add Floor'}</h3>
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}
              <form onSubmit={handleSaveFloor} className="space-y-3 text-xs">
                {!editingFloorId && (
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Building</label>
                    <select
                      required
                      value={floorForm.branch_id}
                      onChange={(e) => setFloorForm({ ...floorForm, branch_id: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    >
                      <option value="">Select Building</option>
                      {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Floor Name</label>
                  <input
                    required
                    placeholder="e.g. Ground Floor, Floor 1"
                    value={floorForm.name}
                    onChange={(e) => setFloorForm({ ...floorForm, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Floor Number</label>
                    <input
                      type="number"
                      value={floorForm.floor_number}
                      onChange={(e) => setFloorForm({ ...floorForm, floor_number: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Status</label>
                    <select
                      value={floorForm.status}
                      onChange={(e) => setFloorForm({ ...floorForm, status: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    >
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>
                {!editingFloorId && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Canvas Width (px)</label>
                      <input
                        type="number"
                        value={floorForm.canvas_width}
                        onChange={(e) => setFloorForm({ ...floorForm, canvas_width: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-gray-600 mb-1">Canvas Height (px)</label>
                      <input
                        type="number"
                        value={floorForm.canvas_height}
                        onChange={(e) => setFloorForm({ ...floorForm, canvas_height: Number(e.target.value) })}
                        className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                      />
                    </div>
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setFloorModalOpen(false)} className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl">Cancel</button>
                  <button type="submit" disabled={savingFloor} className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow">
                    {savingFloor ? 'Saving...' : 'Save Floor'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminFloorPlans;
