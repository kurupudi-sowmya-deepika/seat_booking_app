import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { 
  MapPin, Building2, Plus, Edit2, Trash2, Loader2, ChevronRight, X, AlertCircle, Search, Filter, 
  Download, MoreVertical, RotateCcw
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
    setCurrentPage(1);
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

  // Search, Filters & Pagination state
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

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

  // Filter Locations
  const filteredLocations = locations.filter(loc => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = loc.name.toLowerCase().includes(q);
      const matchCity = loc.city.toLowerCase().includes(q);
      const matchAddr = loc.address.toLowerCase().includes(q);
      if (!matchName && !matchCity && !matchAddr) return false;
    }
    if (cityFilter !== 'ALL' && loc.city !== cityFilter) return false;
    if (statusFilter !== 'ALL' && loc.status !== statusFilter) return false;
    return true;
  });

  // Filter Branches
  const filteredBranches = branches.filter(br => {
    const loc = locations.find(l => l.id === br.location_id);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = br.name.toLowerCase().includes(q);
      const matchAddr = br.address.toLowerCase().includes(q);
      const matchLoc = loc && (loc.name.toLowerCase().includes(q) || loc.city.toLowerCase().includes(q));
      if (!matchName && !matchAddr && !matchLoc) return false;
    }
    if (cityFilter !== 'ALL' && loc?.city !== cityFilter) return false;
    if (statusFilter !== 'ALL' && br.status !== statusFilter) return false;
    return true;
  });

  const hasActiveFilters = searchQuery !== '' || cityFilter !== 'ALL' || statusFilter !== 'ALL';

  const clearFilters = () => {
    setSearchQuery('');
    setCityFilter('ALL');
    setStatusFilter('ALL');
    setCurrentPage(1);
  };

  // Export CSV helper
  const exportCSV = () => {
    const data = activeTab === 'locations' ? filteredLocations : filteredBranches;
    const headers = activeTab === 'locations'
      ? ['ID', 'Name', 'City', 'State', 'Address', 'Status']
      : ['ID', 'Name', 'Location ID', 'Address', 'Status'];
    
    const rows = data.map(item => 
      activeTab === 'locations'
        ? [item.id, item.name, item.city, item.state, `"${item.address}"`, item.status]
        : [item.id, item.name, item.location_id, `"${item.address}"`, item.status]
    );

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${activeTab}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Pagination for active tab
  const activeItems = activeTab === 'locations' ? filteredLocations : filteredBranches;
  const totalPages = Math.ceil(activeItems.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLocations = filteredLocations.slice(startIndex, startIndex + pageSize);
  const paginatedBranches = filteredBranches.slice(startIndex, startIndex + pageSize);

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

  const uniqueCities = Array.from(new Set(locations.map(l => l.city).filter(Boolean)));

  return (
    <div className="space-y-6 font-sans text-slate-900">
      {/* Global Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span>Workspace Governance</span>
        <ChevronRight size={13} className="text-slate-400" />
        <span className="text-slate-900 font-semibold">Locations & Branches</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Locations & Branches</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage multi-region corporate offices, physical hubs, and associated branch workspaces.
          </p>
        </div>

        {/* Action Button */}
        {activeTab === 'locations' ? (
          <button
            onClick={openCreateLoc}
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus size={16} /> Add Location
          </button>
        ) : (
          <button
            onClick={openCreateBr}
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus size={16} /> Add Branch
          </button>
        )}
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-fit border border-slate-200/80">
        <button
          onClick={() => handleTabChange('locations')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'locations'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <MapPin size={15} className={activeTab === 'locations' ? 'text-[#2563EB]' : 'text-slate-400'} />
          <span>Locations ({locations.length})</span>
        </button>

        <button
          onClick={() => handleTabChange('branches')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'branches'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Building2 size={15} className={activeTab === 'branches' ? 'text-[#2563EB]' : 'text-slate-400'} />
          <span>Branches ({branches.length})</span>
        </button>
      </div>

      {/* Integrated Filter Bar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={`Search ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
          />
        </div>

        {/* Dropdown filters & Export */}
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter size={14} />
            <span>Filters:</span>
          </div>

          <select
            value={cityFilter}
            onChange={(e) => { setCityFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Cities / Regions</option>
            {uniqueCities.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-xs text-[#2563EB] hover:underline font-semibold flex items-center gap-1"
            >
              <RotateCcw size={13} /> Clear Filters
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

          <button
            onClick={exportCSV}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg flex items-center gap-1.5 transition"
            title="Export CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* TAB 1: LOCATIONS DATA TABLE */}
      {activeTab === 'locations' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {locLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#2563EB]" size={36} />
            </div>
          ) : paginatedLocations.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <MapPin size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium">No locations found matching your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Location Name</th>
                    <th className="py-3.5 px-4">City / State</th>
                    <th className="py-3.5 px-4">Address</th>
                    <th className="py-3.5 px-4">Associated Branches</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {paginatedLocations.map((loc) => {
                    const locBranches = branches.filter(b => b.location_id === loc.id);
                    return (
                      <tr key={loc.id} className="hover:bg-slate-50/75 transition-colors group">
                        <td className="py-3.5 px-4 font-semibold text-slate-900">{loc.name}</td>
                        <td className="py-3.5 px-4 font-medium text-slate-700">{loc.city}, {loc.state}</td>
                        <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{loc.address}</td>
                        <td className="py-3.5 px-4">
                          <div className="flex flex-wrap gap-1">
                            {locBranches.length > 0 ? (
                              locBranches.map(b => (
                                <span 
                                  key={b.id} 
                                  className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[11px] font-medium hover:border-blue-400 transition"
                                >
                                  {b.name}
                                </span>
                              ))
                            ) : (
                              <span className="text-slate-400 italic">No branches</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3.5 px-4">
                          {loc.status === 'ACTIVE' ? (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full font-medium text-[11px] px-2.5 py-0.5 inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Active
                            </span>
                          ) : (
                            <span className="bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-medium text-[11px] px-2.5 py-0.5 inline-flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditLoc(loc)}
                              className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                              title="Edit Location"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => handleLocDelete(loc.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                              title="Delete Location"
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

      {/* TAB 2: BRANCHES DATA TABLE */}
      {activeTab === 'branches' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          {brLoading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#2563EB]" size={36} />
            </div>
          ) : paginatedBranches.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <Building2 size={40} className="text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium">No branches found matching your query.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-3.5 px-4">Branch Name</th>
                    <th className="py-3.5 px-4">Parent Location</th>
                    <th className="py-3.5 px-4">Physical Address</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                  {paginatedBranches.map((br) => (
                    <tr key={br.id} className="hover:bg-slate-50/75 transition-colors group">
                      <td className="py-3.5 px-4 font-semibold text-slate-900">{br.name}</td>
                      <td className="py-3.5 px-4 font-medium text-[#2563EB]">{getLocationName(br.location_id)}</td>
                      <td className="py-3.5 px-4 text-slate-500 max-w-xs truncate">{br.address}</td>
                      <td className="py-3.5 px-4">
                        {br.status === 'ACTIVE' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-full font-medium text-[11px] px-2.5 py-0.5 inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            Active
                          </span>
                        ) : (
                          <span className="bg-slate-100 text-slate-600 border border-slate-200 rounded-full font-medium text-[11px] px-2.5 py-0.5 inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEditBr(br)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                            title="Edit Branch"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleBrDelete(br.id)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                            title="Delete Branch"
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

      {/* Table Footer / Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-5 py-3.5 border border-slate-200 rounded-xl shadow-sm">
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-semibold text-slate-900">{activeItems.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-semibold text-slate-900">{Math.min(startIndex + pageSize, activeItems.length)}</span> of{' '}
          <span className="font-semibold text-slate-900">{activeItems.length}</span> {activeTab}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-700"
            >
              <option value={5}>5</option>
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              Previous
            </button>
            <span className="text-xs font-semibold text-slate-700 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Location Modal */}
      <AnimatePresence>
        {locModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100"
            >
              <button onClick={() => setLocModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-slate-900">
                {editingLocId ? 'Edit Office Location' : 'Add Office Location'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleLocSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Location Name</label>
                  <input
                    required
                    placeholder="e.g. Bangalore HQ"
                    value={locFormData.name}
                    onChange={(e) => setLocFormData({ ...locFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Address</label>
                  <input
                    required
                    placeholder="e.g. Outer Ring Road, Tech Park"
                    value={locFormData.address}
                    onChange={(e) => setLocFormData({ ...locFormData, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">City</label>
                    <input
                      required
                      placeholder="e.g. Bangalore"
                      value={locFormData.city}
                      onChange={(e) => setLocFormData({ ...locFormData, city: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">State</label>
                    <input
                      required
                      placeholder="e.g. Karnataka"
                      value={locFormData.state}
                      onChange={(e) => setLocFormData({ ...locFormData, state: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Postal Code</label>
                    <input
                      required
                      placeholder="e.g. 560103"
                      value={locFormData.postal_code}
                      onChange={(e) => setLocFormData({ ...locFormData, postal_code: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Country</label>
                    <input
                      required
                      value={locFormData.country}
                      onChange={(e) => setLocFormData({ ...locFormData, country: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Latitude (GPS)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 12.9352"
                      value={locFormData.latitude}
                      onChange={(e) => setLocFormData({ ...locFormData, latitude: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Longitude (GPS)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 77.6946"
                      value={locFormData.longitude}
                      onChange={(e) => setLocFormData({ ...locFormData, longitude: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setLocModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm"
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 border border-slate-100">
              <button onClick={() => setBrModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-slate-900">
                {editingBrId ? 'Edit Branch Workspace' : 'Add New Branch Workspace'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleBrSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Parent Location</label>
                  <select
                    required
                    value={brFormData.location_id}
                    onChange={(e) => setBrFormData({ ...brFormData, location_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  >
                    <option value="">Select Parent Location</option>
                    {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch Campus Name</label>
                  <input
                    required
                    placeholder="e.g. Whitefield Campus"
                    value={brFormData.name}
                    onChange={(e) => setBrFormData({ ...brFormData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch Physical Address</label>
                  <input
                    required
                    placeholder="e.g. ITPL Main Road"
                    value={brFormData.address}
                    onChange={(e) => setBrFormData({ ...brFormData, address: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Flagship tech campus hub with agile spaces..."
                    value={brFormData.description}
                    onChange={(e) => setBrFormData({ ...brFormData, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setBrModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm"
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
