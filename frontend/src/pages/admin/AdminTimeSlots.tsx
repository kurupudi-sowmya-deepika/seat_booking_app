import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { Clock, Plus, Edit2, Trash2, AlertCircle, RefreshCw, Search, Filter } from 'lucide-react';

interface TimeSlotItem {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
}

export const AdminTimeSlots: React.FC = () => {
  const [slots, setSlots] = useState<TimeSlotItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimeSlotItem | null>(null);

  // Search, Filter & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(8);

  const [formData, setFormData] = useState({
    start_time: '09:00:00',
    end_time: '10:00:00',
    status: 'ACTIVE',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/time-slots/');
      setSlots(res.data || []);
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
    setEditingSlot(null);
    setFormData({
      start_time: '09:00:00',
      end_time: '10:00:00',
      status: 'ACTIVE',
    });
    setError('');
    setModalOpen(true);
  };

  const openEdit = (slot: TimeSlotItem) => {
    setEditingSlot(slot);
    setFormData({
      start_time: slot.start_time,
      end_time: slot.end_time,
      status: slot.status || 'ACTIVE',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    const formattedData = {
      start_time: formData.start_time.length === 5 ? `${formData.start_time}:00` : formData.start_time,
      end_time: formData.end_time.length === 5 ? `${formData.end_time}:00` : formData.end_time,
      status: formData.status,
    };

    try {
      if (editingSlot) {
        await api.put(`/time-slots/${editingSlot.id}`, formattedData);
      } else {
        await api.post('/time-slots/', formattedData);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save time slot');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this time slot?')) return;
    try {
      await api.delete(`/time-slots/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete slot');
    }
  };

  const formatDisplayTime = (timeStr: string) => {
    if (!timeStr) return '';
    const parts = timeStr.split(':');
    let h = parseInt(parts[0], 10);
    const m = parts[1] || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
  };

  // Filter logic
  const sortedSlots = [...slots].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const filteredSlots = sortedSlots.filter(slot => {
    const formatted = `${formatDisplayTime(slot.start_time)} ${formatDisplayTime(slot.end_time)}`.toLowerCase();
    if (searchQuery && !formatted.includes(searchQuery.toLowerCase())) return false;
    if (statusFilter !== 'ALL' && slot.status !== statusFilter) return false;
    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredSlots.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSlots = filteredSlots.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-6">
      {/* Context Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#007bc0] font-bold uppercase tracking-wider mb-1">
            <span>Resources & Products</span>
            <span>•</span>
            <span>Time Slots Schedule</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Clock className="text-[#007bc0]" size={26} />
            Booking Time Slots Directory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure hourly intervals and operating schedule blocks for workstation and room bookings.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button 
            onClick={fetchData} 
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition shadow-[#007bc0]/20"
          >
            <Plus size={16} />
            Add Time Slot
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by time (e.g. 9:00 AM)..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-10 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <Filter size={14} />
            <span>Status:</span>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Grid of Slots */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">Loading time slots...</div>
      ) : paginatedSlots.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">No matching time slots found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {paginatedSlots.map((slot) => (
            <div 
              key={slot.id} 
              className="bg-white rounded-2xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md transition flex items-center justify-between"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#007bc0] flex items-center justify-center font-bold">
                  <Clock size={18} />
                </div>
                <div>
                  <h4 className="font-extrabold text-gray-900 text-xs flex items-center gap-1 flex-wrap">
                    <span className="text-gray-400 font-semibold">From</span>
                    <span className="text-gray-900 font-bold">{formatDisplayTime(slot.start_time)}</span>
                    <span className="text-gray-400 font-semibold">To</span>
                    <span className="text-gray-900 font-bold">{formatDisplayTime(slot.end_time)}</span>
                  </h4>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                    slot.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {slot.status}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(slot)}
                  className="p-1.5 text-gray-400 hover:text-[#007bc0] hover:bg-blue-50 rounded-lg transition"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDelete(slot.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-5 py-3.5 border border-gray-200 rounded-2xl shadow-sm">
        <div className="text-xs font-semibold text-gray-500">
          Showing <span className="font-bold text-gray-800">{filteredSlots.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-bold text-gray-800">{Math.min(startIndex + pageSize, filteredSlots.length)}</span> of{' '}
          <span className="font-bold text-gray-800">{filteredSlots.length}</span> time slots
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Slots per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700"
            >
              <option value={8}>8</option>
              <option value={16}>16</option>
              <option value={32}>32</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              Previous
            </button>
            <span className="text-xs font-bold text-gray-700 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4">
              {editingSlot ? 'Edit Time Slot' : 'Create Time Slot'}
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
                  Start Time
                </label>
                <input
                  type="time"
                  step="900"
                  value={formData.start_time.slice(0, 5)}
                  onChange={(e) => setFormData({ ...formData, start_time: `${e.target.value}:00` })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  End Time
                </label>
                <input
                  type="time"
                  step="900"
                  value={formData.end_time.slice(0, 5)}
                  onChange={(e) => setFormData({ ...formData, end_time: `${e.target.value}:00` })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="slot_status"
                  checked={formData.status === 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                  className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                />
                <label htmlFor="slot_status" className="text-sm font-semibold text-gray-700">
                  Slot is Active and Selectable
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
                  {saving ? 'Saving...' : editingSlot ? 'Save Changes' : 'Create Slot'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTimeSlots;
