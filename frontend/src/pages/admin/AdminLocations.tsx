import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { 
  MapPin, Building2, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminLocations: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab')?.toLowerCase();
  const [activeTab, setActiveTab] = useState<'locations' | 'branches'>(
    rawTab === 'branches' ? 'branches' : 'locations'
  );

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')?.toLowerCase();
    if (tabFromUrl === 'branches' || tabFromUrl === 'locations') {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tab: 'locations' | 'branches') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // State for Locations
  const [locations, setLocations] = useState<any[]>([]);
  const [locLoading, setLocLoading] = useState(true);
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [editingLocId, setEditingLocId] = useState<string | null>(null);
  const [locFormData, setLocFormData] = useState({
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

  // State for Branches
  const [branches, setBranches] = useState<any[]>([]);
  const [brLoading, setBrLoading] = useState(true);
  const [brModalOpen, setBrModalOpen] = useState(false);
  const [editingBrId, setEditingBrId] = useState<string | null>(null);
  const [brFormData, setBrFormData] = useState({
    location_id: '',
    name: '',
    address: '',
    description: '',
    status: 'ACTIVE'
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLocLoading(true);
    setBrLoading(true);
    try {
      const [lRes, bRes] = await Promise.all([
        api.get('/locations/'),
        api.get('/branches/')
      ]);
      setLocations(lRes.data || []);
      setBranches(bRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLocLoading(false);
      setBrLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Location Handlers ---
  const openCreateLoc = () => {
    setEditingLocId(null);
    setLocFormData({
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
    setLocModalOpen(true);
  };

  const openEditLoc = (loc: any) => {
    setEditingLocId(loc.id);
    setLocFormData({
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
    setLocModalOpen(true);
  };

  const handleLocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      ...locFormData,
      latitude: locFormData.latitude ? parseFloat(locFormData.latitude) : null,
      longitude: locFormData.longitude ? parseFloat(locFormData.longitude) : null
    };

    try {
      if (editingLocId) {
        await api.put(`/locations/${editingLocId}`, payload);
      } else {
        await api.post('/locations/', payload);
      }
      setLocModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleLocDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this location?')) return;
    try {
      await api.delete(`/locations/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete location');
    }
  };

  // --- Branch Handlers ---
  const openCreateBr = () => {
    setEditingBrId(null);
    setBrFormData({
      location_id: locations[0]?.id || '',
      name: '',
      address: '',
      description: '',
      status: 'ACTIVE'
    });
    setError('');
    setBrModalOpen(true);
  };

  const openEditBr = (br: any) => {
    setEditingBrId(br.id);
    setBrFormData({
      location_id: br.location_id,
      name: br.name,
      address: br.address,
      description: br.description || '',
      status: br.status
    });
    setError('');
    setBrModalOpen(true);
  };

  const handleBrSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      if (editingBrId) {
        await api.put(`/branches/${editingBrId}`, brFormData);
      } else {
        await api.post('/branches/', brFormData);
      }
      setBrModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const handleBrDelete = async (id: string) => {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
            <ChevronRight size={16} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Locations & Branches Management</h1>
        </div>

        {activeTab === 'locations' ? (
          <button
            onClick={openCreateLoc}
            className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={16} /> Add Location
          </button>
        ) : (
          <button
            onClick={openCreateBr}
            className="px-4 py-2 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus size={16} /> Add Branch
          </button>
        )}
      </div>

      {/* 2 Tabs: Locations & Branches */}
      <div className="flex border-b border-gray-200 bg-white px-3 pt-2 gap-2 rounded-2xl shadow-sm">
        <button
          onClick={() => handleTabChange('locations')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'locations'
              ? 'border-[#007bc0] text-[#007bc0] bg-blue-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl'
          }`}
        >
          <MapPin size={16} />
          <span>Locations ({locations.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('branches')}
          className={`flex items-center gap-2 px-5 py-3 text-xs font-bold border-b-2 transition-all ${
            activeTab === 'branches'
              ? 'border-[#007bc0] text-[#007bc0] bg-blue-50/60 rounded-t-xl'
              : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50 rounded-t-xl'
          }`}
        >
          <Building2 size={16} />
          <span>Branches ({branches.length})</span>
        </button>
      </div>

      {/* TAB 1: LOCATIONS */}
      {activeTab === 'locations' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {locLoading ? (
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
                    <th className="py-3 px-4">Associated Branches</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {locations.map((loc) => {
                    const locBranches = branches.filter(b => b.location_id === loc.id);
                    return (
                      <tr key={loc.id} className="hover:bg-gray-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-gray-800">{loc.name}</td>
                        <td className="py-3.5 px-4 text-gray-700">{loc.city}, {loc.state}</td>
                        <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{loc.address}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {locBranches.length > 0 ? (
                              locBranches.map(b => (
                                <span key={b.id} className="px-2 py-0.5 bg-blue-50 text-[#007bc0] text-[10px] font-bold rounded-md">
                                  {b.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-gray-400 italic">No branches</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                            {loc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditLoc(loc)}
                              className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                              title="Edit"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleLocDelete(loc.id)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg transition-all"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BRANCHES */}
      {activeTab === 'branches' && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          {brLoading ? (
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
                      <td className="py-3.5 px-4 font-semibold text-[#007bc0]">{getLocationName(br.location_id)}</td>
                      <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">{br.address}</td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                          {br.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditBr(br)}
                            className="p-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleBrDelete(br.id)}
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
      )}

      {/* Location Modal */}
      <AnimatePresence>
        {locModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <button onClick={() => setLocModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {editingLocId ? 'Edit Location' : 'Add Office Location'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleLocSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Location Name</label>
                  <input
                    required
                    placeholder="e.g. Bangalore HQ"
                    value={locFormData.name}
                    onChange={(e) => setLocFormData({ ...locFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Address</label>
                  <input
                    required
                    placeholder="e.g. Outer Ring Road, Tech Park"
                    value={locFormData.address}
                    onChange={(e) => setLocFormData({ ...locFormData, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">City</label>
                    <input
                      required
                      placeholder="e.g. Bangalore"
                      value={locFormData.city}
                      onChange={(e) => setLocFormData({ ...locFormData, city: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">State</label>
                    <input
                      required
                      placeholder="e.g. Karnataka"
                      value={locFormData.state}
                      onChange={(e) => setLocFormData({ ...locFormData, state: e.target.value })}
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
                      value={locFormData.postal_code}
                      onChange={(e) => setLocFormData({ ...locFormData, postal_code: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Country</label>
                    <input
                      required
                      value={locFormData.country}
                      onChange={(e) => setLocFormData({ ...locFormData, country: e.target.value })}
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
                      value={locFormData.latitude}
                      onChange={(e) => setLocFormData({ ...locFormData, latitude: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-gray-600 mb-1">Longitude (GPS)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 77.6946"
                      value={locFormData.longitude}
                      onChange={(e) => setLocFormData({ ...locFormData, longitude: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setLocModalOpen(false)}
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

      {/* Branch Modal */}
      <AnimatePresence>
        {brModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
              <button onClick={() => setBrModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-gray-800">
                {editingBrId ? 'Edit Branch' : 'Add New Branch'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleBrSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Parent Location</label>
                  <select
                    required
                    value={brFormData.location_id}
                    onChange={(e) => setBrFormData({ ...brFormData, location_id: e.target.value })}
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
                    value={brFormData.name}
                    onChange={(e) => setBrFormData({ ...brFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Branch Address</label>
                  <input
                    required
                    placeholder="e.g. ITPL Main Road"
                    value={brFormData.address}
                    onChange={(e) => setBrFormData({ ...brFormData, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-600 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Flagship tech campus hub..."
                    value={brFormData.description}
                    onChange={(e) => setBrFormData({ ...brFormData, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setBrModalOpen(false)}
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

export default AdminLocations;
