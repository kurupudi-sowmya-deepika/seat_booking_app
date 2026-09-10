import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  MapPin, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminLocations: React.FC = () => {
  const [locations, setLocations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    country: 'India',
    postal_code: '',
    latitude: '',
    longitude: '',
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLocations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/locations/');
      setLocations(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLocations();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      country: 'India',
      postal_code: '',
      latitude: '',
      longitude: '',
      status: 'ACTIVE'
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (loc: any) => {
    setEditingId(loc.id);
    setFormData({
      name: loc.name,
      address: loc.address,
      city: loc.city,
      state: loc.state,
      country: loc.country,
      postal_code: loc.postal_code,
      latitude: loc.latitude !== null ? String(loc.latitude) : '',
      longitude: loc.longitude !== null ? String(loc.longitude) : '',
      status: loc.status
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...formData,
      latitude: formData.latitude ? parseFloat(formData.latitude) : null,
      longitude: formData.longitude ? parseFloat(formData.longitude) : null
    };

    try {
      if (editingId) {
        await api.put(`/locations/${editingId}`, payload);
      } else {
        await api.post('/locations/', payload);
      }
      setModalOpen(false);
      fetchLocations();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await api.delete(`/locations/${id}`);
      fetchLocations();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete location');
    }
  };

  return (
    <div className="space-y-6 font-['Inter']">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
            <ChevronRight size={16} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Office Locations Management</h1>
        </div>

        <button
          onClick={openCreate}
          className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus size={16} /> Add Location
        </button>
      </div>

      {/* Locations Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#007bc0]" size={36} />
          </div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <MapPin size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No locations configured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Location Name</th>
                  <th className="py-3 px-4">City / State</th>
                  <th className="py-3 px-4">Address</th>
                  <th className="py-3 px-4">GPS Coordinates (Auto-detect)</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-gray-800">{loc.name}</td>
                    <td className="py-3.5 px-4 text-gray-700">{loc.city}, {loc.state}</td>
                    <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{loc.address}</td>
                    <td className="py-3.5 px-4 font-mono text-[11px] text-gray-600">
                      {loc.latitude && loc.longitude ? `${loc.latitude}, ${loc.longitude}` : 'Not configured'}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {loc.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(loc)}
                          className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                          title="Edit"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(loc.id)}
                          className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                          title="Delete"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {editingId ? 'Edit Location' : 'Add Office Location'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Location Name</label>
                  <input
                    required
                    placeholder="e.g. Bangalore HQ"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Address</label>
                  <input
                    required
                    placeholder="e.g. Outer Ring Road, Tech Park"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">City</label>
                    <input
                      required
                      placeholder="e.g. Bangalore"
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">State</label>
                    <input
                      required
                      placeholder="e.g. Karnataka"
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Postal Code</label>
                    <input
                      required
                      placeholder="e.g. 560103"
                      value={formData.postal_code}
                      onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Country</label>
                    <input
                      required
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Latitude (GPS)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 12.9352"
                      value={formData.latitude}
                      onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Longitude (GPS)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 77.6946"
                      value={formData.longitude}
                      onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
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
                    {saving ? 'Saving...' : 'Save Location'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminLocations;
