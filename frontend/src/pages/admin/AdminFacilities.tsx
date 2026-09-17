import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { Sparkles, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminFacilities: React.FC = () => {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: ''
  });
  const FACILITY_CATEGORIES = ['Furniture', 'Equipment', 'Facilities', 'Building'];
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchFacilities = async () => {
    setLoading(true);
    try {
      const res = await api.get('/facilities/');
      setFacilities(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData({ name: '', description: '', category: '' });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (fac: any) => {
    setEditingId(fac.id);
    setFormData({ name: fac.name, description: fac.description || '', category: fac.category || '' });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        await api.put(`/facilities/${editingId}`, formData);
      } else {
        await api.post('/facilities/', formData);
      }
      setModalOpen(false);
      fetchFacilities();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save facility');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this facility?')) return;
    try {
      await api.delete(`/facilities/${id}`);
      fetchFacilities();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete facility');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
            <ChevronRight size={16} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Facilities & Amenities Master</h1>
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> Add Facility
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#007bc0]" size={36} />
          </div>
        ) : facilities.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Sparkles size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No facilities created yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Facility Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {facilities.map((fac) => (
                  <tr key={fac.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-800">{fac.name}</td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {fac.category ? (
                        <span className="px-2 py-0.5 bg-blue-50 text-[#007bc0] rounded-full text-[10px] font-bold">{fac.category}</span>
                      ) : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">{fac.description}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(fac)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(fac.id)}
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

      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {editingId ? 'Edit Facility' : 'Add Facility'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Facility Name</label>
                  <input
                    required
                    placeholder="e.g. Dual 4K Monitors"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  >
                    <option value="">Uncategorized</option>
                    {FACILITY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="USB-C docking station with dual 4K monitors..."
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
                    {saving ? 'Saving...' : 'Save Facility'}
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

export default AdminFacilities;
