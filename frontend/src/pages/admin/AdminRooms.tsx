import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { 
  DoorOpen, Plus, Edit2, Trash2, Loader2, ChevronLeft, ChevronRight, X, AlertCircle, 
  Armchair, Video, Presentation, LayoutGrid, List, MapPin, Building2, Users, Search, Filter,
  Wifi, Monitor, Wind, Coffee, Tv, Sparkles, CheckCircle2, ChevronDown, MoreVertical,
  Activity, Wrench, BarChart3, Layers, Eye, Grid3X3, Sliders, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminRooms: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const rawTab = searchParams.get('tab')?.toUpperCase() || 'ALL';
  const validTabs = ['ALL', 'WORKSPACE', 'MEETING_ROOM', 'CONFERENCE_ROOM'];
  const [activeTab, setActiveTab] = useState<string>(validTabs.includes(rawTab) ? rawTab : 'ALL');
  
  // View mode state: grid vs table
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  // Search, Filter & Pagination states (showing 5 branches per page)
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(5); // Default to 5 branches per page

  // Room Details Modal State
  const [detailsRoom, setDetailsRoom] = useState<any | null>(null);

  // Seat / Desk Details & Editor Modal State
  const [seatModalOpen, setSeatModalOpen] = useState(false);
  const [editingSeat, setEditingSeat] = useState<any | null>(null);
  const [seatFormData, setSeatFormData] = useState({
    room_id: '',
    seat_number: '',
    seat_type: 'STANDARD',
    description: '',
    price: 150,
    status: 'ACTIVE',
  });
  const [savingSeat, setSavingSeat] = useState(false);
  const [seatError, setSeatError] = useState('');

  // Collapsible Accordion states for Campus Branches
  const [collapsedCampuses, setCollapsedCampuses] = useState<Record<string, boolean>>({});

  const toggleCampusCollapse = (branchId: string) => {
    setCollapsedCampuses(prev => ({
      ...prev,
      [branchId]: !prev[branchId]
    }));
  };

  useEffect(() => {
    const tabFromUrl = searchParams.get('tab')?.toUpperCase();
    if (tabFromUrl && validTabs.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setCurrentPage(1);
    if (tabId === 'ALL') {
      setSearchParams({});
    } else {
      setSearchParams({ tab: tabId });
    }
  };

  const [rooms, setRooms] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [seats, setSeats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    branch_id: '',
    name: '',
    description: '',
    room_type: 'WORKSPACE',
    capacity: 10,
    floor: null as number | null,
    price_per_hour: 0,
    facility_ids: [] as string[],
    status: 'ACTIVE'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rRes, bRes, lRes, fRes, sRes] = await Promise.all([
        api.get('/rooms/'),
        api.get('/branches/'),
        api.get('/locations/'),
        api.get('/facilities/'),
        api.get('/seats/').catch(() => ({ data: [] }))
      ]);
      setRooms(rRes.data || []);
      setBranches(bRes.data || []);
      setLocations(lRes.data || []);
      setFacilities(fRes.data || []);
      setSeats(sRes.data || []);
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
    const defaultType = activeTab !== 'ALL' ? activeTab : 'WORKSPACE';
    setEditingId(null);
    setFormData({
      branch_id: branches[0]?.id || '',
      name: '',
      description: '',
      room_type: defaultType,
      capacity: defaultType === 'MEETING_ROOM' ? 6 : defaultType === 'CONFERENCE_ROOM' ? 20 : 10,
      floor: null,
      price_per_hour: defaultType === 'MEETING_ROOM' ? 400 : defaultType === 'CONFERENCE_ROOM' ? 1200 : 0,
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
      room_type: rm.room_type || 'WORKSPACE',
      capacity: rm.capacity || 10,
      floor: rm.floor ?? null,
      price_per_hour: rm.price_per_hour || 0,
      facility_ids: (rm.facilities || []).map((f: any) => f.id),
      status: rm.status || 'ACTIVE'
    });
    setError('');
    setModalOpen(true);
  };

  // Seat / Desk handlers
  const openAddSeat = (roomId: string, defaultNumber?: string) => {
    const roomSeats = seats.filter(s => s.room_id === roomId);
    const nextNum = defaultNumber || `D-${roomSeats.length + 1}`;
    setEditingSeat(null);
    setSeatFormData({
      room_id: roomId,
      seat_number: nextNum,
      seat_type: 'STANDARD',
      description: '',
      price: 150,
      status: 'ACTIVE'
    });
    setSeatError('');
    setSeatModalOpen(true);
  };

  const openEditSeat = (st: any) => {
    setEditingSeat(st);
    setSeatFormData({
      room_id: st.room_id,
      seat_number: st.seat_number,
      seat_type: st.seat_type || 'STANDARD',
      description: st.description || '',
      price: st.price || 150,
      status: st.status || 'ACTIVE'
    });
    setSeatError('');
    setSeatModalOpen(true);
  };

  const handleSeatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSeat(true);
    setSeatError('');
    try {
      if (editingSeat) {
        await api.put(`/seats/${editingSeat.id}`, seatFormData);
      } else {
        await api.post('/seats/', seatFormData);
      }
      setSeatModalOpen(false);
      await fetchData();
    } catch (err: any) {
      setSeatError(err.response?.data?.detail || 'Failed to save desk details');
    } finally {
      setSavingSeat(false);
    }
  };

  const handleDeleteSeat = async (seatId: string) => {
    if (!window.confirm('Are you sure you want to remove this desk?')) return;
    try {
      await api.delete(`/seats/${seatId}`);
      setSeatModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete desk');
    }
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
      price_per_hour: formData.room_type !== 'WORKSPACE' ? Number(formData.price_per_hour) : null
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
      setError(err.response?.data?.detail || 'Failed to save room');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this room?')) return;
    try {
      await api.delete(`/rooms/${id}`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete room');
    }
  };

  // Calculated Metrics for Top Analytics Strip
  const totalCapacity = rooms.reduce((acc, r) => acc + (r.capacity || 0), 0);
  const activeZoneCount = rooms.length;
  const maintenanceCount = rooms.filter(r => r.status === 'INACTIVE' || r.status === 'MAINTENANCE').length;
  const liveUtilizationRate = 74; // Simulated live peak occupancy percentage

  // Filter logic for rooms
  const filteredRooms = rooms.filter((rm) => {
    if (activeTab !== 'ALL' && (rm.room_type || 'WORKSPACE') !== activeTab) return false;

    const br = branches.find(b => b.id === rm.branch_id);
    const loc = br ? locations.find(l => l.id === br.location_id) : null;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = rm.name.toLowerCase().includes(q);
      const matchBranch = br && br.name.toLowerCase().includes(q);
      const matchLoc = loc && (loc.name.toLowerCase().includes(q) || loc.city.toLowerCase().includes(q));
      if (!matchName && !matchBranch && !matchLoc) return false;
    }

    if (selectedLocationFilter !== 'ALL' && loc?.id !== selectedLocationFilter) return false;
    if (selectedBranchFilter !== 'ALL' && br?.id !== selectedBranchFilter) return false;

    return true;
  });

  // Group rooms by Active Branch
  const activeBranchGroups = branches.map(br => {
    const loc = locations.find(l => l.id === br.location_id);
    const brRooms = filteredRooms.filter(r => r.branch_id === br.id);
    const totalDesksInBranch = rooms
      .filter(r => r.branch_id === br.id)
      .reduce((acc, r) => acc + (r.capacity || 0), 0);
    return {
      branch: br,
      location: loc,
      rooms: brRooms,
      totalDesksInBranch
    };
  }).filter(group => group.rooms.length > 0);

  // Pagination by 5 Branches per page
  const totalPages = Math.ceil(activeBranchGroups.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedBranchGroups = activeBranchGroups.slice(startIndex, startIndex + pageSize);

  const unassignedRooms = filteredRooms.filter(rm => {
    const br = branches.find(b => b.id === rm.branch_id);
    return !br;
  });

  // Facility Icon Helper
  const renderAmenityIcon = (name: string) => {
    const n = name.toLowerCase();
    let icon = <Sparkles size={13} />;
    if (n.includes('wifi') || n.includes('internet')) icon = <Wifi size={13} />;
    else if (n.includes('monitor') || n.includes('display') || n.includes('screen')) icon = <Monitor size={13} />;
    else if (n.includes('ac') || n.includes('air') || n.includes('climate')) icon = <Wind size={13} />;
    else if (n.includes('coffee') || n.includes('pantry') || n.includes('tea')) icon = <Coffee size={13} />;
    else if (n.includes('tv') || n.includes('video') || n.includes('av')) icon = <Tv size={13} />;

    return (
      <span title={name} className="inline-flex items-center">
        {icon}
      </span>
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-900">
      {/* Global Breadcrumb */}
      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
        <span>Workspace Governance</span>
        <ChevronRight size={13} className="text-slate-400" />
        <span className="text-slate-900 font-semibold">Rooms & Zones Portfolio</span>
      </div>

      {/* Top Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 tracking-tight">Rooms & Zones Portfolio</h1>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise spatial governance across corporate campuses, boardrooms, and focus workspaces.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto flex-wrap">
          {/* Grid Navigation Arrows */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="p-1.5 text-slate-600 hover:text-[#2563EB] hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Previous Branches Page"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-bold text-slate-700 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="p-1.5 text-slate-600 hover:text-[#2563EB] hover:bg-slate-50 rounded-lg disabled:opacity-30 disabled:hover:bg-transparent transition"
              title="Next Branches Page"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* Layout Toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'grid' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Grid View"
            >
              <LayoutGrid size={15} /> Grid
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                viewMode === 'table' ? 'bg-white text-[#2563EB] shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Table View"
            >
              <List size={15} /> Table
            </button>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2.5 rounded-lg shadow-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Plus size={16} /> Add Room / Zone
          </button>
        </div>
      </div>

      {/* Top Analytics Strip (4 Mini KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Total Capacity</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{totalCapacity.toLocaleString()} <span className="text-xs font-semibold text-slate-400">Desks</span></p>
          </div>
          <div className="p-3 bg-blue-50 text-[#2563EB] rounded-xl">
            <Armchair size={20} />
          </div>
        </div>

        {/* KPI 2 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Active Zones</span>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{activeZoneCount} <span className="text-xs font-semibold text-slate-400">Rooms</span></p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <DoorOpen size={20} />
          </div>
        </div>

        {/* KPI 3 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Live Utilization</span>
            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{liveUtilizationRate}% <span className="text-xs font-semibold text-slate-400">Booked Today</span></p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Activity size={20} />
          </div>
        </div>

        {/* KPI 4 */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Maintenance / Offline</span>
            <p className="text-2xl font-extrabold text-amber-600 mt-1">{maintenanceCount} <span className="text-xs font-semibold text-slate-400">Offline</span></p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Wrench size={20} />
          </div>
        </div>
      </div>

      {/* Integrated Search & Filter Controls */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-center">
        {/* Search with ⌘K Hint */}
        <div className="relative w-full md:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search rooms or zones..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            className="w-full pl-9 pr-14 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition-all"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400">
            ⌘K
          </kbd>
        </div>

        {/* Location & Branch Dropdowns */}
        <div className="flex items-center gap-3 w-full md:w-auto overflow-x-auto">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Filter size={14} />
            <span>Scope:</span>
          </div>

          <select
            value={selectedLocationFilter}
            onChange={(e) => { setSelectedLocationFilter(e.target.value); setSelectedBranchFilter('ALL'); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Locations</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name} ({l.city})</option>
            ))}
          </select>

          <select
            value={selectedBranchFilter}
            onChange={(e) => { setSelectedBranchFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-[#2563EB]"
          >
            <option value="ALL">All Branches</option>
            {branches
              .filter(b => selectedLocationFilter === 'ALL' || b.location_id === selectedLocationFilter)
              .map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))
            }
          </select>
        </div>
      </div>

      {/* Segmented Filter Tabs with Active Counts */}
      <div className="flex border-b border-slate-200 bg-white px-3 pt-2 gap-1 rounded-xl shadow-sm overflow-x-auto">
        {[
          { id: 'ALL', label: 'All Zones', icon: <DoorOpen size={15} />, count: rooms.length },
          { id: 'WORKSPACE', label: 'Workspaces', icon: <Armchair size={15} />, count: rooms.filter(r => (r.room_type || 'WORKSPACE') === 'WORKSPACE').length },
          { id: 'MEETING_ROOM', label: 'Meeting Rooms', icon: <Video size={15} />, count: rooms.filter(r => r.room_type === 'MEETING_ROOM').length },
          { id: 'CONFERENCE_ROOM', label: 'Conference Halls', icon: <Presentation size={15} />, count: rooms.filter(r => r.room_type === 'CONFERENCE_ROOM').length },
        ].map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-[#2563EB] text-[#2563EB] bg-blue-50/50 rounded-t-lg'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50 rounded-t-lg'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                isActive ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="h-64 flex items-center justify-center bg-white border border-slate-200 rounded-xl">
          <Loader2 className="animate-spin text-[#2563EB]" size={36} />
        </div>
      ) : activeBranchGroups.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
          <DoorOpen size={40} className="text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-medium">No matching rooms found for the selected criteria.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {paginatedBranchGroups.map(brGroup => {
            const isCollapsed = !!collapsedCampuses[brGroup.branch.id];
            return (
              <div key={brGroup.branch.id} className="bg-white border border-slate-200/80 rounded-xl overflow-hidden shadow-sm transition-all">
                {/* Accordion Header */}
                <button
                  onClick={() => toggleCampusCollapse(brGroup.branch.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 bg-slate-50/75 hover:bg-slate-100/60 transition text-left border-b border-slate-200/80"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <Building2 size={16} className="text-[#2563EB]" />
                    <span className="text-xs font-bold text-slate-900">
                      {brGroup.location ? brGroup.location.name : 'Corporate Headquarters'} • {brGroup.branch.name} Campus
                    </span>
                    <span className="text-[11px] font-medium text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      {brGroup.rooms.length} Rooms • {brGroup.totalDesksInBranch} Total Seats
                    </span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`} />
                </button>

                {/* Accordion Body */}
                {!isCollapsed && (
                  <div className="p-5">
                    {viewMode === 'grid' ? (
                      /* Grid View with Arrows Navigation Support */
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {brGroup.rooms.map(rm => {
                          const isInactive = rm.status === 'INACTIVE' || rm.status === 'MAINTENANCE';
                          return (
                            <div
                              key={rm.id}
                              className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all duration-200 flex flex-col justify-between group"
                            >
                              {/* Card Header */}
                              <div>
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <h4 className="font-bold text-slate-900 text-sm leading-snug group-hover:text-[#2563EB] transition-colors">{rm.name}</h4>
                                    {rm.floor != null && (
                                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                                        Fl {rm.floor}
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-1">
                                    {isInactive ? (
                                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                        Offline
                                      </span>
                                    ) : (
                                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        Available
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Room Type Pill */}
                                <div className="mb-3">
                                  <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase ${
                                    rm.room_type === 'WORKSPACE' ? 'bg-blue-50 text-[#2563EB]' :
                                    rm.room_type === 'MEETING_ROOM' ? 'bg-indigo-50 text-indigo-700' :
                                    'bg-purple-50 text-purple-700'
                                  }`}>
                                    {rm.room_type || 'WORKSPACE'}
                                  </span>
                                </div>

                                {/* Capacity Progress Pill */}
                                <div className="space-y-1 mb-3">
                                  <div className="flex justify-between text-[11px] font-medium text-slate-600">
                                    <span>Capacity</span>
                                    <span className="font-semibold text-slate-900">{rm.capacity} Desks</span>
                                  </div>
                                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                    <div 
                                      className="bg-[#2563EB] h-full rounded-full transition-all"
                                      style={{ width: `${Math.min(100, (rm.capacity / 30) * 100)}%` }}
                                    />
                                  </div>
                                </div>

                                {/* Rate Chip */}
                                <div className="text-xs font-semibold text-slate-900 mb-3">
                                  Rate: {rm.price_per_hour ? (
                                    <span className="text-[#2563EB]">₹{rm.price_per_hour}/hr <span className="text-[10px] font-normal text-slate-400">(Full Room)</span></span>
                                  ) : (
                                    <span className="text-slate-600">Per Seat / Hour</span>
                                  )}
                                </div>

                                {/* Amenities Row */}
                                {rm.facilities && rm.facilities.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-100">
                                    {rm.facilities.slice(0, 3).map((f: any) => (
                                      <span 
                                        key={f.id}
                                        className="inline-flex items-center px-2 py-0.5 bg-slate-50 border border-slate-200/80 rounded-md text-[10px] font-semibold text-slate-700"
                                      >
                                        {f.name}
                                      </span>
                                    ))}
                                    {rm.facilities.length > 3 && (
                                      <button
                                        onClick={() => setDetailsRoom(rm)}
                                        className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-[#2563EB] hover:bg-blue-100 border border-blue-200 rounded-md text-[10px] font-bold transition cursor-pointer"
                                        title="Click to view all amenities in Structure"
                                      >
                                        +{rm.facilities.length - 3} more
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Card Footer Actions */}
                              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100">
                                <button
                                  onClick={() => setDetailsRoom(rm)}
                                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                                >
                                  <Eye size={13} /> View Details & Structure
                                </button>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => openEdit(rm)}
                                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                                    title="Edit Room"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(rm.id)}
                                    className="p-1 text-slate-400 hover:text-red-600 rounded transition"
                                    title="Delete Room"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* Table View */
                      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4">Room Name</th>
                                <th className="py-3 px-4">Room Type</th>
                                <th className="py-3 px-4">Floor</th>
                                <th className="py-3 px-4">Capacity</th>
                                <th className="py-3 px-4">Hourly Price</th>
                                <th className="py-3 px-4">Amenities</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                              {brGroup.rooms.map(rm => (
                                <tr key={rm.id} className="hover:bg-slate-50/75 transition-colors">
                                  <td className="py-3.5 px-4 font-semibold text-slate-900">{rm.name}</td>
                                  <td className="py-3.5 px-4">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                      rm.room_type === 'WORKSPACE' ? 'bg-blue-50 text-[#2563EB]' :
                                      rm.room_type === 'MEETING_ROOM' ? 'bg-indigo-50 text-indigo-700' :
                                      'bg-purple-50 text-purple-700'
                                    }`}>
                                      {rm.room_type || 'WORKSPACE'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-700">
                                    {rm.floor != null ? (
                                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">Fl {rm.floor}</span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                  <td className="py-3.5 px-4 font-medium text-slate-800">{rm.capacity} Persons</td>
                                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                                    {rm.price_per_hour ? `₹${rm.price_per_hour}/hr` : 'Per Seat'}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <div className="flex flex-wrap items-center gap-1.5 max-w-xs">
                                      {(rm.facilities || []).slice(0, 3).map((f: any) => (
                                        <span
                                          key={f.id}
                                          className="inline-flex items-center px-2 py-0.5 bg-slate-100/90 border border-slate-200 rounded-md text-[11px] font-medium text-slate-700 whitespace-nowrap"
                                        >
                                          {f.name}
                                        </span>
                                      ))}
                                      {(rm.facilities || []).length > 3 && (
                                        <button
                                          onClick={() => setDetailsRoom(rm)}
                                          className="inline-flex items-center px-1.5 py-0.5 bg-blue-50 text-[#2563EB] hover:bg-blue-100 border border-blue-200 rounded-md text-[10px] font-bold transition cursor-pointer"
                                          title="Click to view all amenities in Structure"
                                        >
                                          +{(rm.facilities || []).length - 3} more
                                        </button>
                                      )}
                                      {(!rm.facilities || rm.facilities.length === 0) && (
                                        <span className="text-slate-400 text-xs">—</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                    <div className="flex items-center justify-end gap-2">
                                      <button
                                        onClick={() => setDetailsRoom(rm)}
                                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#2563EB] hover:underline"
                                      >
                                        <Eye size={13} /> Structure
                                      </button>
                                      <button
                                        onClick={() => openEdit(rm)}
                                        className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                                      >
                                        <Edit2 size={14} />
                                      </button>
                                      <button
                                        onClick={() => handleDelete(rm.id)}
                                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition"
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
                )}
              </div>
            );
          })}

          {unassignedRooms.length > 0 && (
            <div className="space-y-4 pt-4">
              <h3 className="text-sm font-bold text-slate-700">Unassigned Rooms</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {unassignedRooms.map(rm => (
                  <div key={rm.id} className="bg-white border p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{rm.name}</h4>
                      <p className="text-xs text-slate-500">Capacity: {rm.capacity} Desks</p>
                    </div>
                    <button
                      onClick={() => setDetailsRoom(rm)}
                      className="text-xs font-semibold text-[#2563EB] hover:underline inline-flex items-center gap-1"
                    >
                      <Eye size={13} /> View
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pagination Controls showing 5 Branches per page */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white px-5 py-3.5 border border-slate-200 rounded-xl shadow-sm">
        <div className="text-xs font-medium text-slate-500">
          Showing <span className="font-semibold text-slate-900">{activeBranchGroups.length > 0 ? startIndex + 1 : 0}</span> to{' '}
          <span className="font-semibold text-slate-900">{Math.min(startIndex + pageSize, activeBranchGroups.length)}</span> of{' '}
          <span className="font-semibold text-slate-900">{activeBranchGroups.length}</span> branches / campuses
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Branches per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-700"
            >
              <option value={5}>5 Branches</option>
              <option value={10}>10 Branches</option>
              <option value={15}>15 Branches</option>
              <option value={25}>25 Branches</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              <ChevronLeft size={14} /> Previous
            </button>
            <span className="text-xs font-semibold text-slate-700 px-2">
              {currentPage} / {totalPages}
            </span>
            <button
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-white transition"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Room Details & Spatial Structure Modal */}
      <AnimatePresence>
        {detailsRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative space-y-5 max-h-[90vh] overflow-y-auto border border-slate-100">
              <button 
                onClick={() => setDetailsRoom(null)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>

              {/* Header */}
              <div className="flex items-start gap-3 border-b border-slate-200 pb-4">
                <div className="p-3 bg-blue-50 text-[#2563EB] rounded-xl">
                  <DoorOpen size={24} />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-bold text-slate-950">{detailsRoom.name}</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      detailsRoom.room_type === 'WORKSPACE' ? 'bg-blue-50 text-[#2563EB]' :
                      detailsRoom.room_type === 'MEETING_ROOM' ? 'bg-indigo-50 text-indigo-700' :
                      'bg-purple-50 text-purple-700'
                    }`}>
                      {detailsRoom.room_type || 'WORKSPACE'}
                    </span>
                    {detailsRoom.floor != null && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded">
                        Floor {detailsRoom.floor}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                    <Building2 size={13} className="text-slate-400" />
                    <span>
                      {branches.find(b => b.id === detailsRoom.branch_id)?.name || 'Main Campus'} •{' '}
                      {locations.find(l => l.id === branches.find(b => b.id === detailsRoom.branch_id)?.location_id)?.name || 'Corporate Building'}
                    </span>
                  </p>
                </div>
              </div>

              {/* Quick Metrics */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Max Capacity</span>
                  <p className="text-base font-extrabold text-slate-900 mt-0.5">{detailsRoom.capacity} Seats</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pricing Model</span>
                  <p className="text-base font-extrabold text-[#2563EB] mt-0.5">
                    {detailsRoom.price_per_hour ? `₹${detailsRoom.price_per_hour}/hr` : 'Per Seat / Hour'}
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Operational State</span>
                  <p className="text-base font-extrabold text-emerald-600 mt-0.5 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Active
                  </p>
                </div>
              </div>

              {/* Spatial Layout & Desk Structure */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Grid3X3 size={15} className="text-[#2563EB]" /> Spatial Desk Matrix Structure
                  </h4>
                  <button
                    onClick={() => openAddSeat(detailsRoom.id)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
                  >
                    <Plus size={13} /> Add Desk to Room
                  </button>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  {seats.filter(s => s.room_id === detailsRoom.id).length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-500 font-medium">
                        Click on any desk card to view or update its status, price, and type:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {seats.filter(s => s.room_id === detailsRoom.id).map((st: any) => {
                          const isAvailable = (st.status || 'ACTIVE') === 'ACTIVE' || (st.status || '') === 'AVAILABLE';
                          return (
                            <button
                              key={st.id}
                              onClick={() => openEditSeat(st)}
                              className={`p-2.5 rounded-xl border text-left transition-all hover:scale-[1.02] flex flex-col justify-between group ${
                                isAvailable 
                                  ? 'bg-white border-emerald-300 hover:border-emerald-500 shadow-sm' 
                                  : 'bg-amber-50 border-amber-300 hover:border-amber-500'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors">
                                  Desk {st.seat_number}
                                </span>
                                <Edit2 size={12} className="text-slate-400 group-hover:text-[#2563EB]" />
                              </div>
                              
                              <div className="flex items-center justify-between gap-1 mt-1">
                                <span className="text-[10px] font-semibold text-slate-600 uppercase bg-slate-100 px-1.5 py-0.5 rounded">
                                  {st.seat_type || 'STANDARD'}
                                </span>
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  {st.status || 'ACTIVE'}
                                </span>
                              </div>
                              
                              <div className="mt-2 pt-1 border-t border-slate-100 text-[10px] font-medium text-slate-500 flex justify-between">
                                <span>Rate: ₹{st.price || 150}/hr</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    /* Simulated Desk Matrix Structure with Click to Add */
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-500 font-medium">
                        No desks registered yet for this room. Click any slot below to add a desk:
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                        {Array.from({ length: Math.min(detailsRoom.capacity || 10, 10) }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => openAddSeat(detailsRoom.id, `D-${idx + 1}`)}
                            className="p-2.5 bg-white hover:bg-blue-50/50 rounded-xl border border-dashed border-slate-300 hover:border-[#2563EB] text-center shadow-sm transition group"
                          >
                            <Armchair size={16} className="mx-auto mb-1 text-slate-400 group-hover:text-[#2563EB]" />
                            <span className="text-[10px] font-bold text-slate-800 block">
                              + Desk D-{idx + 1}
                            </span>
                            <span className="text-[9px] text-[#2563EB] font-medium block">Click to Add</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Amenities & Equipment */}
              {detailsRoom.facilities && detailsRoom.facilities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Attached Amenities & Equipment
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {detailsRoom.facilities.map((fac: any) => (
                      <span
                        key={fac.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
                      >
                        {renderAmenityIcon(fac.name)}
                        <span>{fac.name}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Footer Actions */}
              <div className="flex justify-between items-center pt-3 border-t border-slate-200">
                <button
                  onClick={() => {
                    const rm = detailsRoom;
                    setDetailsRoom(null);
                    openEdit(rm);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl transition"
                >
                  <Edit2 size={14} /> Edit Room Config
                </button>

                <button
                  onClick={() => setDetailsRoom(null)}
                  className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Desk Details & Editor Modal */}
      <AnimatePresence>
        {seatModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 border border-slate-100">
              <button 
                onClick={() => setSeatModalOpen(false)} 
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-2">
                <div className="p-2 bg-blue-50 text-[#2563EB] rounded-lg">
                  <Armchair size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {editingSeat ? 'Desk Details & Configuration' : 'Add New Desk / Seat'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Manage desk properties within {rooms.find(r => r.id === seatFormData.room_id)?.name || 'Room'}
                  </p>
                </div>
              </div>

              {seatError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {seatError}
                </div>
              )}

              <form onSubmit={handleSeatSubmit} className="space-y-3 pt-1 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Desk Number / Code</label>
                  <input
                    required
                    placeholder="e.g. D-101"
                    value={seatFormData.seat_number}
                    onChange={(e) => setSeatFormData({ ...seatFormData, seat_number: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30 font-semibold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Desk Type</label>
                    <select
                      value={seatFormData.seat_type}
                      onChange={(e) => setSeatFormData({ ...seatFormData, seat_type: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30 font-medium text-slate-800"
                    >
                      <option value="STANDARD">STANDARD</option>
                      <option value="WINDOW">WINDOW</option>
                      <option value="CABIN">CABIN</option>
                      <option value="CORNER">CORNER</option>
                      <option value="STANDING">STANDING</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Operational Status</label>
                    <select
                      value={seatFormData.status}
                      onChange={(e) => setSeatFormData({ ...seatFormData, status: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30 font-medium text-slate-800"
                    >
                      <option value="ACTIVE">ACTIVE / AVAILABLE</option>
                      <option value="INACTIVE">INACTIVE</option>
                      <option value="MAINTENANCE">MAINTENANCE</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Price Per Hour (₹)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={seatFormData.price}
                    onChange={(e) => setSeatFormData({ ...seatFormData, price: Number(e.target.value) })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30 font-medium text-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Description / Notes</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Ergonomic chair with Dual Monitor Setup"
                    value={seatFormData.description}
                    onChange={(e) => setSeatFormData({ ...seatFormData, description: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30 text-xs"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-200">
                  {editingSeat ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteSeat(editingSeat.id)}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-xl transition"
                    >
                      Delete Desk
                    </button>
                  ) : <div />}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setSeatModalOpen(false)}
                      className="px-4 py-2 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingSeat}
                      className="px-5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm"
                    >
                      {savingSeat ? 'Saving...' : 'Save Desk'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit / Create Room Modal */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto border border-slate-100">
              <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
              <h3 className="text-base font-bold text-slate-900">
                {editingId ? 'Edit Room' : 'Add Room / Zone'}
              </h3>

              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-3 pt-2 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Branch</label>
                  <select
                    required
                    value={formData.branch_id}
                    onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  >
                    <option value="">Select Branch</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Room Name</label>
                  <input
                    required
                    placeholder="e.g. Brainstorm Bay 1"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Room Type</label>
                    <select
                      value={formData.room_type}
                      onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    >
                      <option value="WORKSPACE">WORKSPACE</option>
                      <option value="MEETING_ROOM">MEETING_ROOM</option>
                      <option value="CONFERENCE_ROOM">CONFERENCE_ROOM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Capacity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.capacity}
                      onChange={(e) => setFormData({ ...formData, capacity: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Floor No.</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 1"
                      value={formData.floor ?? ''}
                      onChange={(e) => setFormData({ ...formData, floor: e.target.value === '' ? null : Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                </div>

                {formData.room_type !== 'WORKSPACE' && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Price Per Hour (₹)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="e.g. 500"
                      value={formData.price_per_hour}
                      onChange={(e) => setFormData({ ...formData, price_per_hour: Number(e.target.value) })}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-slate-700 mb-1.5">Attached Facilities</label>
                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 max-h-36 overflow-y-auto">
                    {facilities.map(fac => (
                      <label key={fac.id} className="flex items-center gap-2 text-[11px] text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.facility_ids.includes(fac.id)}
                          onChange={() => toggleFacility(fac.id)}
                          className="rounded text-[#2563EB]"
                        />
                        <span>{fac.name}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-700 font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-[#2563EB] hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm"
                  >
                    {saving ? 'Saving...' : 'Save Room'}
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

export default AdminRooms;
