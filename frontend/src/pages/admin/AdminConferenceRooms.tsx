import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { ShieldCheck, Plus, Edit2, Trash2, Users, Building2, Sparkles, AlertCircle, RefreshCw, Presentation } from 'lucide-react';

export const AdminConferenceRooms: React.FC = () => {
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
    room_type: 'CONFERENCE_ROOM',
    capacity: 20,
    price_per_hour: 1200,
    facility_ids: [] as string[],
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, bRes, fRes] = await Promise.all([
        api.get('/rooms/?room_type=CONFERENCE_ROOM'),
        api.get('/branches/'),
        api.get('/facilities/')
      ]);
      setRooms((rRes.data || []).filter((r: any) => r.room_type === 'CONFERENCE_ROOM'));
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
      description: 'Executive conference hall with stage, laser projector, multi-mic audio, and livestreaming setup.',
      room_type: 'CONFERENCE_ROOM',
      capacity: 25,
      price_per_hour: 1500,
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
      room_type: 'CONFERENCE_ROOM',
      capacity: rm.capacity || 20,
      price_per_hour: rm.price_per_hour || 1200,
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
      setError(err.response?.data?.detail || 'Failed to save conference hall');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this conference hall?')) return;
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
            <Presentation className="text-[#007bc0]" />
            Conference & Boardrooms
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage large executive boardrooms, keynote auditoriums, presentation facilities, and premium tariffs.
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
            Add Conference Hall
          </button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">Loading conference rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">No conference rooms found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((rm) => (
            <div key={rm.id} className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    rm.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {rm.status}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openEdit(rm)}
                      className="p-1.5 text-gray-400 hover:text-[#007bc0] hover:bg-blue-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(rm.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900">{rm.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                    <Building2 size={14} className="text-[#007bc0]" />
                    <span>{getBranchName(rm.branch_id)}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {rm.description || 'Spacious boardroom with podium, dual screens, and premium executive seating.'}
                </p>

                {rm.facilities && rm.facilities.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {rm.facilities.map((f: any) => (
                      <span key={f.id} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-bold rounded-md flex items-center gap-1">
                        <Sparkles size={10} />
                        {f.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Auditorium Capacity</span>
                  <span className="text-sm font-black text-gray-900 flex items-center gap-1">
                    <Users size={14} className="text-gray-400" />
                    {rm.capacity} Seats
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Rate / Hour</span>
                  <span className="text-xl font-black text-[#007bc0]">
                    ₹{rm.price_per_hour || 0}/hr
                  </span>
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
              {editingId ? 'Edit Conference Hall' : 'Add Conference Hall'}
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
                  Hall / Boardroom Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Executive Boardroom Alpha"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Description & Tech Equipment
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Seating Capacity
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
                    Rate (₹ / Hour)
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
                  Included Amenities & AV Equipment
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
                  id="cr_status"
                  checked={formData.status === 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                  className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                />
                <label htmlFor="cr_status" className="text-sm font-semibold text-gray-700">
                  Hall is Active and Bookable
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
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Conference Hall'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminConferenceRooms;
