import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  Tag, Plus, Edit2, Trash2, Search, Filter, 
  Building2, MapPin, CheckCircle, AlertCircle, RefreshCw, Users
} from 'lucide-react';

interface DayPassItem {
  id: string;
  branch_id: string;
  name: string;
  description?: string;
  price: number;
  daily_capacity: number;
  status: string;
}

interface BranchItem {
  id: string;
  name: string;
  location_id: string;
}

interface LocationItem {
  id: string;
  name: string;
  city: string;
}

export const AdminDayPasses: React.FC = () => {
  const [dayPasses, setDayPasses] = useState<DayPassItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DayPassItem | null>(null);
  const [formData, setFormData] = useState({
    branch_id: '',
    name: 'Full Day Flex Pass',
    description: 'Includes high-speed WiFi, ergonomic hot desk, and unlimited pantry access.',
    price: 350,
    daily_capacity: 40,
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dpRes, brRes, locRes] = await Promise.all([
        api.get('/day-passes/'),
        api.get('/branches/'),
        api.get('/locations/'),
      ]);
      setDayPasses(dpRes.data);
      setBranches(brRes.data);
      setLocations(locRes.data);
    } catch (err) {
      console.error('Failed to load Day Passes', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (item?: DayPassItem) => {
    setErrorMsg('');
    if (item) {
      setEditingItem(item);
      setFormData({
        branch_id: item.branch_id,
        name: item.name,
        description: item.description || '',
        price: item.price,
        daily_capacity: item.daily_capacity,
        status: item.status || 'ACTIVE',
      });
    } else {
      setEditingItem(null);
      setFormData({
        branch_id: branches.length > 0 ? branches[0].id : '',
        name: 'Full Day Flex Pass',
        description: 'Includes high-speed WiFi, hot desk access, and pantry amenities.',
        price: 350,
        daily_capacity: 40,
        status: 'ACTIVE',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      if (editingItem) {
        await api.put(`/day-passes/${editingItem.id}`, formData);
      } else {
        await api.post('/day-passes/', formData);
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this Day Pass tier?')) return;
    try {
      await api.delete(`/day-passes/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete day pass');
    }
  };

  const getBranchName = (branchId: string) => {
    const b = branches.find(br => br.id === branchId);
    return b ? b.name : 'Unknown Branch';
  };

  const getLocationForBranch = (branchId: string) => {
    const b = branches.find(br => br.id === branchId);
    if (!b) return '';
    const l = locations.find(loc => loc.id === b.location_id);
    return l ? `${l.city}` : '';
  };

  const filteredPasses = dayPasses.filter(dp => {
    const matchesSearch = dp.name.toLowerCase().includes(search.toLowerCase()) ||
      getBranchName(dp.branch_id).toLowerCase().includes(search.toLowerCase());
    const matchesBranch = selectedBranch === 'ALL' || dp.branch_id === selectedBranch;
    return matchesSearch && matchesBranch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Tag className="text-[#007bc0]" />
            Day Passes Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure daily flex passes, branch capacities, and single-day access tariffs.
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
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition shadow-[#007bc0]/20"
          >
            <Plus size={18} />
            Add Day Pass Tier
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Tiers</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{dayPasses.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Active</span>
          <p className="text-2xl font-black text-green-600 mt-1">{dayPasses.filter(d => d.status === 'ACTIVE').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-purple-500 uppercase tracking-wider">Total Daily Capacity</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{dayPasses.reduce((acc, d) => acc + d.daily_capacity, 0)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Avg Daily Price</span>
          <p className="text-2xl font-black text-blue-600 mt-1">
            ₹{dayPasses.length ? Math.round(dayPasses.reduce((acc, d) => acc + d.price, 0) / dayPasses.length) : 0}
          </p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by pass name or branch..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007bc0]/20 focus:border-[#007bc0]"
          />
        </div>

        <select
          value={selectedBranch}
          onChange={(e) => setSelectedBranch(e.target.value)}
          className="px-3.5 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0] w-full md:w-auto"
        >
          <option value="ALL">All Branches ({branches.length})</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name} ({getLocationForBranch(b.id)})</option>
          ))}
        </select>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">Loading Day Passes...</div>
      ) : filteredPasses.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">No Day Passes configured.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPasses.map((dp) => (
            <div 
              key={dp.id} 
              className="bg-white rounded-2xl border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    dp.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {dp.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenModal(dp)}
                      className="p-1.5 text-gray-400 hover:text-[#007bc0] hover:bg-blue-50 rounded-lg transition"
                      title="Edit"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(dp.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900">{dp.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                    <Building2 size={14} className="text-[#007bc0]" />
                    <span>{getBranchName(dp.branch_id)}</span>
                    <span>•</span>
                    <MapPin size={14} className="text-gray-400" />
                    <span>{getLocationForBranch(dp.branch_id)}</span>
                  </div>
                </div>

                <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                  {dp.description || 'Full day access with all standard branch amenities.'}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Daily Limit</span>
                  <span className="text-sm font-black text-gray-900 flex items-center gap-1">
                    <Users size={14} className="text-gray-400" />
                    {dp.daily_capacity} passes/day
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-gray-400 block">Day Pass Rate</span>
                  <span className="text-xl font-black text-[#007bc0]">
                    ₹{dp.price}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4">
              {editingItem ? 'Edit Day Pass Tier' : 'Create Day Pass Tier'}
            </h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Target Branch
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name} ({getLocationForBranch(b.id)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Pass Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard Full Day Pass"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Details on what is included..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Price (₹ / Pass)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Daily Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.daily_capacity}
                    onChange={(e) => setFormData({ ...formData, daily_capacity: Number(e.target.value) })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="dp_status"
                  checked={formData.status === 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                  className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                />
                <label htmlFor="dp_status" className="text-sm font-semibold text-gray-700">
                  Day Pass is Active and Available for Users
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#007bc0] hover:bg-[#005a8c] text-white shadow-md transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : editingItem ? 'Save Changes' : 'Create Day Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDayPasses;
