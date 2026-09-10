import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  Armchair, Plus, Edit2, Trash2, Search, Filter, 
  Layers, MapPin, Building2, CheckCircle, AlertCircle, RefreshCw
} from 'lucide-react';

interface SeatItem {
  id: string;
  room_id: string;
  seat_number: string;
  seat_type: string; // STANDARD, ERGONOMIC, WINDOW, QUIET_ZONE
  description?: string;
  price: number;
  status: string; // ACTIVE, INACTIVE
}

interface RoomItem {
  id: string;
  name: string;
  branch_id: string;
  room_type: string;
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

export const AdminSeats: React.FC = () => {
  const [seats, setSeats] = useState<SeatItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<SeatItem | null>(null);
  const [formData, setFormData] = useState({
    room_id: '',
    seat_number: '',
    seat_type: 'STANDARD',
    description: '',
    price: 150,
    status: 'ACTIVE',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [seatsRes, roomsRes, branchesRes, locsRes] = await Promise.all([
        api.get('/seats/'),
        api.get('/rooms/'),
        api.get('/branches/'),
        api.get('/locations/'),
      ]);
      setSeats(seatsRes.data);
      setRooms(roomsRes.data);
      setBranches(branchesRes.data);
      setLocations(locsRes.data);
    } catch (err) {
      console.error('Failed to load seat data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (seat?: SeatItem) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (seat) {
      setEditingSeat(seat);
      setFormData({
        room_id: seat.room_id,
        seat_number: seat.seat_number,
        seat_type: seat.seat_type || 'STANDARD',
        description: seat.description || '',
        price: seat.price,
        status: seat.status || 'ACTIVE',
      });
    } else {
      setEditingSeat(null);
      setFormData({
        room_id: rooms.length > 0 ? rooms[0].id : '',
        seat_number: '',
        seat_type: 'STANDARD',
        description: '',
        price: 150,
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
      if (editingSeat) {
        await api.put(`/seats/${editingSeat.id}`, formData);
        setSuccessMsg('Seat updated successfully!');
      } else {
        await api.post('/seats/', formData);
        setSuccessMsg('Seat created successfully!');
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
    if (!window.confirm('Are you sure you want to delete this seat?')) return;
    try {
      await api.delete(`/seats/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete seat');
    }
  };

  const getRoomName = (roomId: string) => {
    const r = rooms.find(room => room.id === roomId);
    return r ? r.name : 'Unknown Room';
  };

  const getBranchForRoom = (roomId: string) => {
    const r = rooms.find(room => room.id === roomId);
    if (!r) return '';
    const b = branches.find(br => br.id === r.branch_id);
    return b ? b.name : '';
  };

  const filteredSeats = seats.filter(s => {
    const matchesSearch = s.seat_number.toLowerCase().includes(search.toLowerCase()) ||
      getRoomName(s.room_id).toLowerCase().includes(search.toLowerCase());
    const matchesRoom = selectedRoom === 'ALL' || s.room_id === selectedRoom;
    const matchesType = selectedType === 'ALL' || s.seat_type === selectedType;
    return matchesSearch && matchesRoom && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Armchair className="text-[#007bc0]" />
            Desks & Seat Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure workstations, seat zones, dynamic pricing, and floor allocations.
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
            Add New Desk
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Seats</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{seats.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Active</span>
          <p className="text-2xl font-black text-green-600 mt-1">{seats.filter(s => s.status === 'ACTIVE').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-purple-500 uppercase tracking-wider">Ergonomic</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{seats.filter(s => s.seat_type === 'ERGONOMIC').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">Avg Price</span>
          <p className="text-2xl font-black text-blue-600 mt-1">
            ₹{seats.length ? Math.round(seats.reduce((acc, s) => acc + s.price, 0) / seats.length) : 0}
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by seat number or room..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#007bc0]/20 focus:border-[#007bc0]"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <select
            value={selectedRoom}
            onChange={(e) => setSelectedRoom(e.target.value)}
            className="px-3.5 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Rooms ({rooms.length})</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="px-3.5 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Desk Types</option>
            <option value="STANDARD">Standard Desk</option>
            <option value="ERGONOMIC">Ergonomic Desk</option>
            <option value="WINDOW">Window View</option>
            <option value="QUIET_ZONE">Quiet Focus Zone</option>
          </select>
        </div>
      </div>

      {/* Seats Table */}
      <div className="bg-white rounded-2xl border border-gray-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Loading seat inventory...</div>
        ) : filteredSeats.length === 0 ? (
          <div className="p-12 text-center text-gray-400">No seats found matching your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">
                  <th className="py-3.5 px-6">Seat Number</th>
                  <th className="py-3.5 px-6">Zone / Room</th>
                  <th className="py-3.5 px-6">Branch</th>
                  <th className="py-3.5 px-6">Desk Tier</th>
                  <th className="py-3.5 px-6">Credits / Slot</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-sm">
                {filteredSeats.map((seat) => (
                  <tr key={seat.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-6 font-black text-gray-900 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#007bc0] flex items-center justify-center font-bold text-xs">
                        {seat.seat_number}
                      </div>
                    </td>
                    <td className="py-3.5 px-6 font-semibold text-gray-700">
                      {getRoomName(seat.room_id)}
                    </td>
                    <td className="py-3.5 px-6 text-gray-500 text-xs">
                      {getBranchForRoom(seat.room_id)}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        seat.seat_type === 'ERGONOMIC' ? 'bg-purple-100 text-purple-700' :
                        seat.seat_type === 'WINDOW' ? 'bg-amber-100 text-amber-700' :
                        seat.seat_type === 'QUIET_ZONE' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {seat.seat_type}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 font-black text-gray-900">
                      ₹{seat.price}
                    </td>
                    <td className="py-3.5 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
                        seat.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${seat.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} />
                        {seat.status === 'ACTIVE' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleOpenModal(seat)}
                          className="p-1.5 text-gray-400 hover:text-[#007bc0] hover:bg-blue-50 rounded-lg transition"
                          title="Edit Seat"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(seat.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Delete Seat"
                        >
                          <Trash2 size={16} />
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
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4">
              {editingSeat ? 'Edit Workstation' : 'Add Workstation'}
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
                  Room / Floor
                </label>
                <select
                  value={formData.room_id}
                  onChange={(e) => setFormData({ ...formData, room_id: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                >
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name} ({getBranchForRoom(r.id)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Seat Number / Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. D-01, W-12"
                  value={formData.seat_number}
                  onChange={(e) => setFormData({ ...formData, seat_number: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Desk Type
                  </label>
                  <select
                    value={formData.seat_type}
                    onChange={(e) => setFormData({ ...formData, seat_type: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="ERGONOMIC">Ergonomic</option>
                    <option value="WINDOW">Window View</option>
                    <option value="QUIET_ZONE">Quiet Zone</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Price (Credits/Slot)
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
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="status"
                  checked={formData.status === 'ACTIVE'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE' })}
                  className="w-4 h-4 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                />
                <label htmlFor="status" className="text-sm font-semibold text-gray-700">
                  Seat is Active and Available for Bookings
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
                  {isSubmitting ? 'Saving...' : editingSeat ? 'Save Changes' : 'Create Seat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminSeats;
