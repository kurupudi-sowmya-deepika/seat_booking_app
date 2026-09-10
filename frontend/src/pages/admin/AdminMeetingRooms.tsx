import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Video, Plus, Edit2, Trash2, Users, Building2, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

export const AdminMeetingRooms: React.FC = () => {
  const [rooms, setRooms] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    branch_id: '',
    name: '',
    description: '',
    room_type: 'MEETING_ROOM',
    capacity: 6,
    floor: null as number | null,
    price_per_hour: 400,
    facility_ids: [] as string[],
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, bRes, fRes] = await Promise.all([
        api.get('/rooms/?room_type=MEETING_ROOM'),
        api.get('/branches/'),
        api.get('/facilities/')
      ]);
      setRooms((rRes.data || []).filter((r: any) => r.room_type === 'MEETING_ROOM'));
      setBranches(bRes.data || []);
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

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      branch_id: branches[0]?.id || '',
      name: '',
      description: 'Equipped with 4K Display, HD Video Conferencing, and Digital Whiteboard.',
      room_type: 'MEETING_ROOM',
      capacity: 6,
      floor: null,
      price_per_hour: 400,
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
      room_type: 'MEETING_ROOM',
      capacity: rm.capacity || 6,
      floor: rm.floor ?? null,
      price_per_hour: rm.price_per_hour || 400,
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
      price_per_hour: Number(formData.price_per_hour)
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
      setError(err.response?.data?.detail || 'Failed to save meeting room');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this meeting room?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete room');
    }
  };

  const getBranchName = (bId: string) => {
    const b = branches.find(br => br.id === bId);
    return b ? b.name : 'Unknown Branch';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Video className="text-[#007bc0]" />
            Meeting Rooms Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure collaborative huddle spaces, hourly rates, AV setups, and room equipment.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchData} 
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition shadow-[#007bc0]/20"
          >
            <Plus size={18} />
            Add Meeting Room
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">Loading meeting rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">No meeting rooms found.</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {rooms.map((rm) => (
            <div
              key={rm.id}
              className="aspect-square bg-white rounded-2xl border border-gray-200/80 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 flex flex-col overflow-hidden"
            >
              {/* Coloured header strip */}
              <div className="relative bg-gradient-to-br from-[#007bc0] to-[#005a8c] p-3 flex-shrink-0">
                <div className="flex items-start justify-between">
                  <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                    <Video size={16} className="text-white" />
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(rm)}
                      className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded-md transition"
                      title="Edit"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(rm.id)}
                      className="p-1 text-white/70 hover:text-red-300 hover:bg-white/20 rounded-md transition"
                      title="Delete"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <span className={`mt-2 inline-block px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                  rm.status === 'ACTIVE' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-red-400/20 text-red-200'
                }`}>
                  {rm.status}
                </span>
              </div>

              {/* Body */}
              <div className="flex-1 p-3 flex flex-col justify-between min-h-0">
                <div className="space-y-1.5">
                  <h3 className="text-sm font-black text-gray-900 leading-tight line-clamp-1">{rm.name}</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <div className="flex items-center gap-1 text-[10px] text-gray-500 font-medium">
                      <Building2 size={11} className="text-[#007bc0]" />
                      <span className="line-clamp-1">{getBranchName(rm.branch_id)}</span>
                    </div>
                    {rm.floor != null && (
                      <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 text-[9px] font-bold rounded">
                        Fl.{rm.floor}
                      </span>
                    )}
                  </div>

                  {rm.facilities && rm.facilities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {rm.facilities.slice(0, 3).map((f: any) => (
                        <span key={f.id} className="px-1.5 py-0.5 bg-blue-50 text-[#007bc0] text-[9px] font-bold rounded">
                          {f.name}
                        </span>
                      ))}
                      {rm.facilities.length > 3 && (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-bold rounded">
                          +{rm.facilities.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Stats pinned to bottom */}
                <div className="pt-2 border-t border-gray-100 flex items-end justify-between mt-2">
                  <div>
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Capacity</span>
                    <span className="text-xs font-black text-gray-800 flex items-center gap-0.5">
                      <Users size={11} className="text-gray-400" />
                      {rm.capacity}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] uppercase font-bold text-gray-400 block">Rate</span>
                    <span className="text-sm font-black text-[#007bc0]">₹{rm.price_per_hour || 0}/hr</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4">
              {editingId ? 'Edit Meeting Room' : 'Add Meeting Room'}
            </h3>

            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Branch
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Room Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Brainstorm Bay 1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Description & Tech Setup
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Floor No.
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 2"
                    value={formData.floor ?? ''}
                    onChange={(e) => setFormData({ ...formData, floor: e.target.value === '' ? null : Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Price (₹/hr)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.price_per_hour}
                    onChange={(e) => setFormData({ ...formData, price_per_hour: Number(e.target.value) })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Included Amenities & Facilities
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-gray-50 border border-gray-200 rounded-xl">
                  {facilities.map((fac) => {
                    const checked = formData.facility_ids.includes(fac.id);
                    return (
                      <label key={fac.id} className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFacility(fac.id)}
                          className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                        />
                        {fac.name}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="mr_status"
                  checked={formData.status === 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                  className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                />
                <label htmlFor="mr_status" className="text-sm font-semibold text-gray-700">
                  Room is Active and Bookable
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#007bc0] hover:bg-[#005a8c] text-white shadow-md transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Room'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMeetingRooms;
