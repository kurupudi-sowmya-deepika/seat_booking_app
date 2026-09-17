import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { 
  DoorOpen, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle, 
  Armchair, Video, Presentation, LayoutGrid, List, MapPin, Building2, Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminRooms: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab')?.toUpperCase() || 'ALL';
  const validTabs = ['ALL', 'WORKSPACE', 'MEETING_ROOM', 'CONFERENCE_ROOM'];
  const [activeTab, setActiveTab] = useState<string>(validTabs.includes(rawTab) ? rawTab : 'ALL');
  
  // View mode state: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')?.toUpperCase();
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (tabId === 'ALL') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const [rooms, setRooms] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    branch_id: '',
    name: '',
    description: '',
    room_type: 'WORKSPACE',
    capacity: 10,
    floor: null as number | null,
    price_per_hour: 0,
    facility_ids: [] as string[],
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, bRes, lRes, fRes] = await Promise.all([
        api.get('/rooms/'),
        api.get('/branches/'),
        api.get('/locations/'),
        api.get('/facilities/')
      ]);
      setRooms(rRes.data || []);
      setBranches(bRes.data || []);
      setLocations(lRes.data || []);
      setFacilities(fRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreate = (preselectedBranchId?: string) => {
    const defaultType = activeTab !== 'ALL' ? activeTab : 'WORKSPACE';
    setEditingId(null);
    setFormData({
      branch_id: preselectedBranchId || branches[0]?.id || '',
      name: '',
      description: '',
      room_type: defaultType,
      capacity: defaultType === 'MEETING_ROOM' ? 6 : defaultType === 'CONFERENCE_ROOM' ? 20 : 10,
      floor: null,
      price_per_hour: defaultType === 'MEETING_ROOM' ? 400 : defaultType === 'CONFERENCE_ROOM' ? 1200 : 0,
      facility_ids: [],
      status: 'ACTIVE'
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (rm: any) => {
    setEditingId(rm.id);
    setFormData({
      branch_id: rm.branch_id,
      name: rm.name,
      description: rm.description || '',
      room_type: rm.room_type || 'WORKSPACE',
      capacity: rm.capacity || 10,
      floor: rm.floor ?? null,
      price_per_hour: rm.price_per_hour || 0,
      facility_ids: (rm.facilities || []).map((f: any) => f.id),
      status: rm.status
    });
    setError('');
    setModalOpen(true);
  };

  const toggleFacility = (facId: string) => {
    setFormData(prev => ({
      ...prev,
      facility_ids: prev.facility_ids.includes(facId)
        ? prev.facility_ids.filter(id => id !== facId)
        : [...prev.facility_ids, facId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...formData,
      capacity: Number(formData.capacity),
      price_per_hour: formData.room_type !== 'WORKSPACE' ? Number(formData.price_per_hour) : null
    };

    try {
      if (editingId) {
        await api.put(`/rooms/${editingId}`, payload);
      } else {
        await api.post('/rooms/', payload);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete room');
    }
  };

  const filteredRooms = rooms.filter((rm) => {
    if (activeTab === 'ALL') return true;
    const type = rm.room_type || 'WORKSPACE';
    return type === activeTab;
  });

  // Group rooms hierarchically by Location -> Branch
  const groupedHierarchy = locations.map(loc => {
    const locBranches = branches.filter(b => b.location_id === loc.id);
    const branchesWithRooms = locBranches.map(br => {
      const brRooms = filteredRooms.filter(r => r.branch_id === br.id);
      return { branch: br, rooms: brRooms };
    }).filter(item => item.rooms.length > 0 || branches.length === 0);

    const totalRoomsInLoc = branchesWithRooms.reduce((acc, b) => acc + b.rooms.length, 0);
    return { location: loc, branches: branchesWithRooms, totalRooms: totalRoomsInLoc };
  }).filter(group => group.totalRooms > 0 || locations.length === 0);

  // Fallback for rooms whose branch/location is missing
  const unassignedRooms = filteredRooms.filter(rm => {
    const br = branches.find(b => b.id === rm.branch_id);
    return !br;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
            <ChevronRight size={16} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Rooms & Zones Management</h1>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Switcher: Grid vs Table */}
          <div className="flex bg-gray-200/80 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Table View"
            >
              <List size={15} /> Table
            </button>
          </div>

          <button
            onClick={() => openCreate()}
            className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5"
          >
            <Plus size={16} /> Add Room / Zone
          </button>
        </div>
      </div>

      {/* Workspace, Meeting Room, Conference Room Tabs */}
      <div className="flex border-b border-gray-200 bg-white px-3 pt-2 gap-1 rounded-2xl shadow-sm overflow-x-auto">
        {[
          { id: 'ALL', label: 'All Rooms', icon: <DoorOpen size={15} />, count: rooms.length },
          { id: 'WORKSPACE', label: 'Workspace', icon: <Armchair size={15} />, count: rooms.filter(r => (r.room_type || 'WORKSPACE') === 'WORKSPACE').length },
          { id: 'MEETING_ROOM', label: 'Meeting Room', icon: <Video size={15} />, count: rooms.filter(r => r.room_type === 'MEETING_ROOM').length },
          { id: 'CONFERENCE_ROOM', label: 'Conference Room', icon: <Presentation size={15} />, count: rooms.filter(r => r.room_type === 'CONFERENCE_ROOM').length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-[#007bc0] text-[#007bc0] bg-blue-50/60 rounded-t-xl'
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                isActive ? 'bg-[#007bc0] text-white' : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center bg-white border border-gray-200 rounded-2xl">
          <Loader2 className="animate-spin text-[#007bc0]" size={36} />
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="p-12 text-center text-gray-500 bg-white border border-gray-200 rounded-2xl">
          <DoorOpen size={40} className="text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium">No {activeTab !== 'ALL' ? activeTab.replace('_', ' ').toLowerCase() + 's' : 'rooms'} configured yet.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedHierarchy.map(locGroup => (
            <div key={locGroup.location.id} className="space-y-4">
              {/* Location Header */}
              <div className="flex items-center gap-2 pb-2 border-b-2 border-[#007bc0]/30">
                <MapPin className="text-[#007bc0]" size={20} />
                <h2 className="text-lg font-black text-gray-800">
                  {locGroup.location.name} <span className="text-sm font-semibold text-gray-500">({locGroup.location.city})</span>
                </h2>
                <span className="ml-auto text-xs font-extrabold px-2.5 py-1 bg-blue-100 text-[#007bc0] rounded-full">
                  {locGroup.totalRooms} Rooms
                </span>
              </div>

              {/* Branches under Location */}
              <div className="pl-2 sm:pl-4 space-y-6">
                {locGroup.branches.map(brGroup => (
                  <div key={brGroup.branch.id} className="space-y-3">
                    {/* Branch Title */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-slate-100 to-white px-4 py-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Building2 className="text-[#005691]" size={16} />
                        <h3 className="text-sm font-bold text-gray-800">{brGroup.branch.name} Campus</h3>
                        <span className="text-xs text-gray-500">— {brGroup.rooms.length} Rooms</span>
                      </div>
                      <button
                        onClick={() => openCreate(brGroup.branch.id)}
                        className="text-xs text-[#007bc0] hover:underline font-bold flex items-center gap-1"
                      >
                        <Plus size={14} /> Add Room Here
                      </button>
                    </div>

                    {/* View Mode: GRID vs TABLE */}
                    {viewMode === 'grid' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {brGroup.rooms.map(rm => (
                          <div
                            key={rm.id}
                            className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <h4 className="font-bold text-gray-900 text-sm leading-snug">{rm.name}</h4>
                                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                                  rm.room_type === 'WORKSPACE' ? 'bg-blue-100 text-blue-800' :
                                  rm.room_type === 'MEETING_ROOM' ? 'bg-indigo-100 text-indigo-800' :
                                  'bg-purple-100 text-purple-800'
                                }`}>
                                  {rm.room_type || 'WORKSPACE'}
                                </span>
                              </div>

                              <div className="space-y-1.5 text-xs text-gray-600 mb-3">
                                <div className="flex items-center gap-2">
                                  <Users size={14} className="text-gray-400" />
                                  <span>Capacity: <strong>{rm.capacity} Persons</strong></span>
                                </div>
                                {rm.floor != null && (
                                  <div className="flex items-center gap-2">
                                    <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded">Floor {rm.floor}</span>
                                  </div>
                                )}
                                <div className="font-semibold text-gray-800 pt-1">
                                  Rate: {rm.price_per_hour ? <span className="text-[#007bc0]">₹{rm.price_per_hour}/hr</span> : <span className="text-gray-500">Per Seat</span>}
                                </div>
                              </div>

                              {rm.facilities && rm.facilities.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-3">
                                  {rm.facilities.map((f: any) => (
                                    <span key={f.id} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px]">
                                      {f.name}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                              <button
                                onClick={() => openEdit(rm)}
                                className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                                title="Edit"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDelete(rm.id)}
                                className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                title="Delete"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                <th className="py-3 px-4">Room Name</th>
                                <th className="py-3 px-4">Room Type</th>
                                <th className="py-3 px-4">Floor</th>
                                <th className="py-3 px-4">Capacity</th>
                                <th className="py-3 px-4">Hourly Price</th>
                                <th className="py-3 px-4">Facilities</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 text-xs">
                              {brGroup.rooms.map(rm => (
                                <tr key={rm.id} className="hover:bg-gray-50/80 transition-colors">
                                  <td className="py-3.5 px-4 font-bold text-gray-800">{rm.name}</td>
                                  <td className="py-3.5 px-4">
                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                      rm.room_type === 'WORKSPACE' ? 'bg-blue-100 text-blue-800' :
                                      rm.room_type === 'MEETING_ROOM' ? 'bg-indigo-100 text-indigo-800' :
                                      'bg-purple-100 text-purple-800'
                                    }`}>
                                      {rm.room_type || 'WORKSPACE'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-gray-700">
                                    {rm.floor != null ? (
                                      <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md">Floor {rm.floor}</span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 font-semibold text-gray-800">{rm.capacity} Persons</td>
                                  <td className="py-3.5 px-4 font-semibold text-gray-800">
                                    {rm.price_per_hour ? `₹${rm.price_per_hour}/hr` : 'Per Seat'}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      {(rm.facilities || []).map((f: any) => (
                                        <span key={f.id} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-[10px]">
                                          {f.name}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => openEdit(rm)}
                                        className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(rm.id)}
                                        className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Unassigned Rooms Section */}
          {unassignedRooms.length > 0 && (
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold text-gray-700">Other Unassigned Rooms</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {unassignedRooms.map(rm => (
                  <div key={rm.id} className="bg-white border p-4 rounded-2xl">
                    <h4 className="font-bold text-sm">{rm.name}</h4>
                    <p className="text-xs text-gray-500">Capacity: {rm.capacity}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {editingId ? 'Edit Room' : 'Add Room / Zone'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Branch</label>
                  <select
                    required
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Room Name</label>
                  <input
                    required
                    placeholder="e.g. Room A - Quiet Zone"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Room Type</label>
                    <select
                      value={formData.room_type}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    >
                      <option value="WORKSPACE">WORKSPACE</option>
                      <option value="MEETING_ROOM">MEETING_ROOM</option>
                      <option value="CONFERENCE_ROOM">CONFERENCE_ROOM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Capacity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Floor No.</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1"
                      value={formData.floor ?? ''}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                </div>

                {formData.room_type !== 'WORKSPACE' && (
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Price Per Hour (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={formData.price_per_hour}
                      onChange={(e) => setFormData({ ...formData, price_per_hour: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-gray-600 mb-1.5">Attached Facilities</label>
                  <div className="grid grid-cols-2 gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200 max-h-36 overflow-y-auto">
                    {facilities.map(fac => (
                      <label key={fac.id} className="flex items-center gap-2 text-[11px] text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.facility_ids.includes(fac.id)}
                          onChange={() => toggleFacility(fac.id)}
                          className="rounded text-[#007bc0]"
                        />
                        <span>{fac.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white font-bold rounded-xl shadow"
                  >
                    {saving ? 'Saving...' : 'Save Room'}
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

export default AdminRooms;
