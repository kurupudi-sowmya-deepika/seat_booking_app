import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  Armchair, Plus, Edit2, Trash2, Search, Filter, 
  LayoutGrid, List, MapPin, Building2, CheckCircle, AlertCircle, RefreshCw, Layers
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

  // Filters & View Mode
  const [search, setSearch] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedRoom, setSelectedRoom] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

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
      setSeats(seatsRes.data || []);
      setRooms(roomsRes.data || []);
      setBranches(branchesRes.data || []);
      setLocations(locsRes.data || []);
    } catch (err) {
      console.error('Failed to load seat data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (seat?: SeatItem, defaultRoomId?: string) => {
    setErrorMsg('');
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
        room_id: defaultRoomId || (rooms.length > 0 ? rooms[0].id : ''),
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
      } else {
        await api.post('/seats/', formData);
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
    const rm = rooms.find(r => r.id === s.room_id);
    const br = rm ? branches.find(b => b.id === rm.branch_id) : null;
    const loc = br ? locations.find(l => l.id === br.location_id) : null;

    if (search) {
      const q = search.toLowerCase();
      const matchNum = s.seat_number.toLowerCase().includes(q);
      const matchRoom = rm && rm.name.toLowerCase().includes(q);
      const matchBranch = br && br.name.toLowerCase().includes(q);
      if (!matchNum && !matchRoom && !matchBranch) return false;
    }

    if (selectedLocation !== 'ALL' && loc?.id !== selectedLocation) return false;
    if (selectedBranch !== 'ALL' && br?.id !== selectedBranch) return false;
    if (selectedRoom !== 'ALL' && s.room_id !== selectedRoom) return false;
    if (selectedType !== 'ALL' && s.seat_type !== selectedType) return false;
    if (selectedStatus !== 'ALL' && s.status !== selectedStatus) return false;

    return true;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredSeats.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedSeats = filteredSeats.slice(startIndex, startIndex + pageSize);

  // Group paginated seats hierarchically by Location -> Branch -> Room
  const groupedHierarchy = locations.map(loc => {
    const locBranches = branches.filter(b => b.location_id === loc.id);
    const branchesWithRooms = locBranches.map(br => {
      const brRooms = rooms.filter(r => r.branch_id === br.id);
      const roomsWithSeats = brRooms.map(rm => {
        const rmSeats = paginatedSeats.filter(s => s.room_id === rm.id);
        return { room: rm, seats: rmSeats };
      }).filter(item => item.seats.length > 0);

      const totalSeatsInBranch = roomsWithSeats.reduce((acc, r) => acc + r.seats.length, 0);
      return { branch: br, roomsWithSeats, totalSeatsInBranch };
    }).filter(bGroup => bGroup.totalSeatsInBranch > 0);

    const totalSeatsInLoc = branchesWithRooms.reduce((acc, b) => acc + b.totalSeatsInBranch, 0);
    return { location: loc, branchesWithRooms, totalSeatsInLoc };
  }).filter(group => group.totalSeatsInLoc > 0);

  return (
    <div className="space-y-6">
      {/* Contextual Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200/80 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#007bc0] font-bold uppercase tracking-wider mb-1">
            <span>Workspace Governance</span>
            <span>•</span>
            <span>Inventory Management</span>
          </div>
          <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight flex items-center gap-2.5">
            <Armchair className="text-[#007bc0]" size={26} />
            Desks & Seat Inventory
          </h1>
          <p className="text-xs text-gray-500 mt-1">
            Configure workstations, seat zones, dynamic pricing, and floor allocations across campus floors.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {/* View Switcher: Grid vs Table */}
          <div className="flex bg-gray-100 p-1 rounded-xl border border-gray-200">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-[#007bc0] shadow-sm' : 'text-gray-500 hover:text-gray-800'
              }`}
              title="Table View"
            >
              <List size={15} /> Table
            </button>
          </div>

          <button 
            onClick={fetchData} 
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-sm"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition shadow-[#007bc0]/20"
          >
            <Plus size={16} />
            Add New Desk
          </button>
        </div>
      </div>

      {/* Stats Summary row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Seats</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{seats.length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Active Bookable</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{seats.filter(s => s.status === 'ACTIVE').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Ergonomic Workstations</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{seats.filter(s => s.seat_type === 'ERGONOMIC').length}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm">
          <span className="text-[11px] font-bold text-[#007bc0] uppercase tracking-wider">Avg Tariff / Slot</span>
          <p className="text-2xl font-black text-[#007bc0] mt-1">
            ₹{seats.length ? Math.round(seats.reduce((acc, s) => acc + s.price, 0) / seats.length) : 0}
          </p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search seat number or zone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
          />
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto overflow-x-auto">
          <select
            value={selectedLocation}
            onChange={(e) => { setSelectedLocation(e.target.value); setSelectedBranch('ALL'); setCurrentPage(1); }}
            className="px-3 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Locations</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <select
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Branches</option>
            {branches
              .filter(b => selectedLocation === 'ALL' || b.location_id === selectedLocation)
              .map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))
            }
          </select>

          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Desk Tiers</option>
            <option value="STANDARD">Standard</option>
            <option value="ERGONOMIC">Ergonomic</option>
            <option value="WINDOW">Window View</option>
            <option value="QUIET_ZONE">Quiet Zone</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 text-xs font-bold bg-gray-50 border border-gray-200 rounded-xl text-gray-700 focus:outline-none focus:border-[#007bc0]"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {/* Content: Location -> Branch -> Room hierarchy */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">Loading seat inventory...</div>
      ) : filteredSeats.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-2xl border">No seats found matching your criteria.</div>
      ) : (
        <div className="space-y-8">
          {groupedHierarchy.map(locGroup => (
            <div key={locGroup.location.id} className="space-y-4">
              {/* Location Header */}
              <div className="flex items-center gap-2 pb-2 border-b-2 border-[#007bc0]/30">
                <MapPin className="text-[#007bc0]" size={20} />
                <h2 className="text-lg font-black text-gray-800">
                  {locGroup.location.name} <span className="text-sm font-semibold text-gray-500">({locGroup.location.city})</span>
                </h2>
                <span className="ml-auto text-xs font-extrabold px-2.5 py-1 bg-blue-100 text-[#007bc0] rounded-full">
                  {locGroup.totalSeatsInLoc} Seats
                </span>
              </div>

              {/* Branches under Location */}
              <div className="pl-2 sm:pl-4 space-y-6">
                {locGroup.branchesWithRooms.map(brGroup => (
                  <div key={brGroup.branch.id} className="space-y-4">
                    {/* Branch Title */}
                    <div className="flex items-center justify-between bg-gradient-to-r from-slate-100 to-white px-4 py-2.5 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2">
                        <Building2 className="text-[#005691]" size={16} />
                        <h3 className="text-sm font-bold text-gray-800">{brGroup.branch.name} Campus</h3>
                        <span className="text-xs text-gray-500">— {brGroup.totalSeatsInBranch} Seats</span>
                      </div>
                    </div>

                    {/* Rooms under Branch */}
                    <div className="pl-2 sm:pl-4 space-y-4">
                      {brGroup.roomsWithSeats.map(rmGroup => (
                        <div key={rmGroup.room.id} className="space-y-3 bg-gray-50/50 p-4 rounded-2xl border border-gray-100">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers size={15} className="text-[#007bc0]" />
                              <h4 className="text-xs font-black text-gray-800 uppercase tracking-wider">{rmGroup.room.name}</h4>
                              <span className="text-[11px] text-gray-500">({rmGroup.seats.length} seats displayed)</span>
                            </div>
                          </div>

                          {/* View Mode: GRID vs TABLE */}
                          {viewMode === 'grid' ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                              {rmGroup.seats.map(seat => (
                                <div
                                  key={seat.id}
                                  className="bg-white border border-gray-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                  <div>
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#007bc0] flex items-center justify-center font-black text-xs">
                                        {seat.seat_number}
                                      </div>
                                      <span className={`w-2 h-2 rounded-full ${seat.status === 'ACTIVE' ? 'bg-green-500' : 'bg-red-500'}`} title={seat.status} />
                                    </div>

                                    <div className="space-y-1 mb-2">
                                      <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                                        seat.seat_type === 'ERGONOMIC' ? 'bg-purple-100 text-purple-700' :
                                        seat.seat_type === 'WINDOW' ? 'bg-amber-100 text-amber-700' :
                                        seat.seat_type === 'QUIET_ZONE' ? 'bg-emerald-100 text-emerald-700' :
                                        'bg-gray-100 text-gray-700'
                                      }`}>
                                        {seat.seat_type}
                                      </span>
                                      <p className="text-xs font-extrabold text-gray-900">₹{seat.price} <span className="text-[9px] text-gray-400 font-medium">/slot</span></p>
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-end gap-1 pt-2 border-t border-gray-100">
                                    <button
                                      onClick={() => handleOpenModal(seat)}
                                      className="p-1 text-gray-400 hover:text-[#007bc0] rounded transition"
                                      title="Edit Desk"
                                    >
                                      <Edit2 size={13} />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(seat.id)}
                                      className="p-1 text-gray-400 hover:text-red-600 rounded transition"
                                      title="Delete Desk"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                              <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                                      <th className="py-2.5 px-4">Seat Number</th>
                                      <th className="py-2.5 px-4">Desk Tier</th>
                                      <th className="py-2.5 px-4">Credits / Slot</th>
                                      <th className="py-2.5 px-4">Status</th>
                                      <th className="py-2.5 px-4 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-100">
                                    {rmGroup.seats.map(seat => (
                                      <tr key={seat.id} className="hover:bg-gray-50/60">
                                        <td className="py-2.5 px-4 font-black text-gray-900">{seat.seat_number}</td>
                                        <td className="py-2.5 px-4">
                                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                            seat.seat_type === 'ERGONOMIC' ? 'bg-purple-100 text-purple-700' :
                                            seat.seat_type === 'WINDOW' ? 'bg-amber-100 text-amber-700' :
                                            seat.seat_type === 'QUIET_ZONE' ? 'bg-emerald-100 text-emerald-700' :
                                            'bg-gray-100 text-gray-700'
                                          }`}>
                                            {seat.seat_type}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-4 font-bold text-gray-800">₹{seat.price}</td>
                                        <td className="py-2.5 px-4">
                                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            seat.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                          }`}>
                                            {seat.status}
                                          </span>
                                        </td>
                                        <td className="py-2.5 px-4 text-right">
                                          <div className="flex items-center justify-end gap-1">
                                            <button
                                              onClick={() => handleOpenModal(seat)}
                                              className="p-1 text-gray-400 hover:text-[#007bc0] rounded transition"
                                            >
                                              <Edit2 size={14} />
                                            </button>
                                            <button
                                              onClick={() => handleDelete(seat.id)}
                                              className="p-1 text-gray-400 hover:text-red-600 rounded transition"
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
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-5 py-3.5 border border-gray-200 rounded-2xl shadow-sm">
        <div className="text-xs font-semibold text-gray-500">
          Showing <span className="font-bold text-gray-800">{filteredSeats.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-bold text-gray-800">{Math.min(startIndex + pageSize, filteredSeats.length)}</span> of{' '}
          <span className="font-bold text-gray-800">{filteredSeats.length}</span> workstations
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <span>Desks per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold text-gray-700"
            >
              <option value={6}>6</option>
              <option value={12}>12</option>
              <option value={24}>24</option>
              <option value={48}>48</option>
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
