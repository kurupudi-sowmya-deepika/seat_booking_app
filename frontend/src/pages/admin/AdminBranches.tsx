import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Building2, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminBranches: React.FC = () => {
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    location_id: '',
    name: '',
    address: '',
    description: '',
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, lRes] = await Promise.all([
        api.get('/branches/'),
        api.get('/locations/')
      ]);
      setBranches(bRes.data || []);
      setLocations(lRes.data || []);
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
      location_id: locations[0]?.id || '',
      name: '',
      address: '',
      description: '',
      status: 'ACTIVE'
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (br: any) => {
    setEditingId(br.id);
    setFormData({
      location_id: br.location_id,
      name: br.name,
      address: br.address,
      description: br.description || '',
      status: br.status
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingId) {
        await api.put(`/branches/${editingId}`, formData);
      } else {
        await api.post('/branches/', formData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this branch?')) return;
    try {
      await api.delete(`/branches/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete branch');
    }
  };

  const getLocationName = (locId: string) => {
    const loc = locations.find(l => l.id === locId);
    return loc ? `${loc.name} (${loc.city})` : 'Unknown';
  };

  return (
    <div className="space-y-6 font-['Inter']">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
            <ChevronRight size={16} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Branch Management</h1>
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> Add Branch
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#007bc0]" size={36} />
          </div>
        ) : branches.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Building2 size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No branches configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Branch Name</th>
                  <th className="py-3 px-4">Parent Location</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {branches.map((br) => (
                  <tr key={br.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-800">{br.name}</td>
                    <td className="py-3.5 px-4 font-medium text-gray-700">{getLocationName(br.location_id)}</td>
                    <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{br.address}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {br.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(br)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(br.id)}
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
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {editingId ? 'Edit Branch' : 'Add New Branch'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Parent Location</label>
                  <select
                    required
                    value={formData.location_id}
                    onChange={(e) => setFormData({ ...formData, location_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  >
                    <option value="">Select Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Branch Name</label>
                  <input
                    required
                    placeholder="e.g. Whitefield"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Branch Address</label>
                  <input
                    required
                    placeholder="e.g. ITPL Main Road"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Flagship tech campus hub..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
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
                    {saving ? 'Saving...' : 'Save Branch'}
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

export default AdminBranches;
