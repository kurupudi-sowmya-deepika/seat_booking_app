import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  UserCheck, Plus, Search, Calendar, Clock, MapPin, 
  Building2, Phone, Mail, CheckCircle2, QrCode, Printer, 
  AlertCircle, RefreshCw, X, ShieldCheck, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VisitorItem {
  id: string;
  host_user_id: string;
  host_name?: string;
  branch_id: string;
  branch_name?: string;
  visitor_name: string;
  visitor_email: string;
  visitor_phone?: string;
  purpose: string;
  visit_date: string;
  expected_arrival_time?: string;
  check_in_time?: string;
  check_out_time?: string;
  status: 'PENDING' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED';
  notes?: string;
  created_at: string;
}

interface BranchItem {
  id: string;
  name: string;
  address: string;
}

export const Visitors: React.FC = () => {
  const { user } = useAuth();
  const [visitors, setVisitors] = useState<VisitorItem[]>([]);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Register Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    branch_id: '',
    visitor_name: '',
    visitor_email: '',
    visitor_phone: '',
    purpose: 'Client Meeting & Presentation',
    visit_date: new Date().toISOString().split('T')[0],
    expected_arrival_time: '10:00:00',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Pass Modal
  const [selectedPass, setSelectedPass] = useState<VisitorItem | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [vRes, bRes] = await Promise.all([
        api.get('/visitors/'),
        api.get('/branches/')
      ]);
      setVisitors(vRes.data || []);
      setBranches(bRes.data || []);
      if (bRes.data && bRes.data.length > 0 && !formData.branch_id) {
        setFormData(prev => ({ ...prev, branch_id: bRes.data[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const payload = {
        ...formData,
        expected_arrival_time: formData.expected_arrival_time.length === 5 ? `${formData.expected_arrival_time}:00` : formData.expected_arrival_time
      };
      await api.post('/visitors/', payload);
      setIsModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.detail || 'Failed to register visitor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCheckIn = async (id: string) => {
    try {
      await api.post(`/visitors/${id}/check-in`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Check-in failed');
    }
  };

  const handleCheckOut = async (id: string) => {
    try {
      await api.post(`/visitors/${id}/check-out`);
      fetchData();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Check-out failed');
    }
  };

  const filteredVisitors = visitors.filter(v => {
    const matchesSearch = v.visitor_name.toLowerCase().includes(search.toLowerCase()) ||
      v.visitor_email.toLowerCase().includes(search.toLowerCase()) ||
      (v.branch_name && v.branch_name.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || v.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <UserCheck className="text-[#007bc0]" />
            Visitor & Guest Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Pre-register external visitors, issue digital gate passes, and track front desk check-in statuses.
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
            onClick={() => {
              setErrorMsg('');
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition shadow-[#007bc0]/20"
          >
            <UserPlus size={18} />
            Pre-register Guest
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Passes</span>
          <p className="text-2xl font-black text-gray-900 mt-1">{visitors.length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Expected (Pending)</span>
          <p className="text-2xl font-black text-amber-600 mt-1">{visitors.filter(v => v.status === 'PENDING').length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Checked In On-Site</span>
          <p className="text-2xl font-black text-emerald-600 mt-1">{visitors.filter(v => v.status === 'CHECKED_IN').length}</p>
        </div>
        <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
          <span className="text-xs font-bold text-purple-500 uppercase tracking-wider">Completed Visits</span>
          <p className="text-2xl font-black text-purple-600 mt-1">{visitors.filter(v => v.status === 'CHECKED_OUT').length}</p>
        </div>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search visitor name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {['ALL', 'PENDING', 'CHECKED_IN', 'CHECKED_OUT'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === st 
                  ? 'bg-[#007bc0] text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {st === 'ALL' ? 'All Visitors' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Visitors List Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border">Loading guest passes...</div>
      ) : filteredVisitors.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border">No visitors registered.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVisitors.map((v) => (
            <div key={v.id} className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <span className={`px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider ${
                    v.status === 'CHECKED_IN' ? 'bg-emerald-100 text-emerald-800' :
                    v.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    v.status === 'CHECKED_OUT' ? 'bg-purple-100 text-purple-800' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {v.status.replace('_', ' ')}
                  </span>

                  <button
                    onClick={() => setSelectedPass(v)}
                    className="p-2 text-[#007bc0] hover:bg-blue-50 rounded-xl transition flex items-center gap-1 text-xs font-bold"
                    title="View Digital Pass"
                  >
                    <QrCode size={16} /> Pass
                  </button>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-900">{v.visitor_name}</h3>
                  <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                    <Mail size={14} className="text-gray-400" />
                    <span>{v.visitor_email}</span>
                  </div>
                  {v.visitor_phone && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-0.5">
                      <Phone size={14} className="text-gray-400" />
                      <span>{v.visitor_phone}</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-1">
                  <p className="text-gray-500"><strong className="text-gray-700">Purpose:</strong> {v.purpose}</p>
                  <p className="text-gray-500"><strong className="text-gray-700">Host:</strong> {v.host_name || user?.name}</p>
                  <p className="text-gray-500"><strong className="text-gray-700">Branch:</strong> {v.branch_name || 'Main Campus'}</p>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-gray-700 pt-1">
                  <span className="flex items-center gap-1">
                    <Calendar size={14} className="text-[#007bc0]" />
                    {v.visit_date}
                  </span>
                  {v.expected_arrival_time && (
                    <span className="flex items-center gap-1 text-gray-500">
                      <Clock size={14} />
                      {v.expected_arrival_time.slice(0, 5)}
                    </span>
                  )}
                </div>
              </div>

              {/* Status Action Buttons */}
              <div className="mt-6 pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                {v.status === 'PENDING' && (
                  <button
                    onClick={() => handleCheckIn(v.id)}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <CheckCircle2 size={14} /> Mark Checked In
                  </button>
                )}
                {v.status === 'CHECKED_IN' && (
                  <button
                    onClick={() => handleCheckOut(v.id)}
                    className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <UserCheck size={14} /> Mark Checked Out
                  </button>
                )}
                {v.status === 'CHECKED_OUT' && (
                  <span className="text-xs font-bold text-gray-400 py-1.5 block text-center w-full">
                    Visit Completed ({v.check_out_time ? new Date(v.check_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''})
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pre-register Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <UserPlus className="text-[#007bc0]" />
              Pre-register Workspace Guest
            </h3>

            {errorMsg && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                <AlertCircle size={16} />
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Host Campus / Branch
                </label>
                <select
                  value={formData.branch_id}
                  onChange={(e) => setFormData({ ...formData, branch_id: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Guest Full Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={formData.visitor_name}
                  onChange={(e) => setFormData({ ...formData, visitor_name: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="guest@acme.com"
                    value={formData.visitor_email}
                    onChange={(e) => setFormData({ ...formData, visitor_email: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Phone (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={formData.visitor_phone}
                    onChange={(e) => setFormData({ ...formData, visitor_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Visit Purpose
                </label>
                <input
                  type="text"
                  placeholder="e.g. Q3 Architecture Review"
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Visit Date
                  </label>
                  <input
                    type="date"
                    value={formData.visit_date}
                    onChange={(e) => setFormData({ ...formData, visit_date: e.target.value })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Expected Time
                  </label>
                  <input
                    type="time"
                    value={formData.expected_arrival_time.slice(0, 5)}
                    onChange={(e) => setFormData({ ...formData, expected_arrival_time: `${e.target.value}:00` })}
                    required
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  />
                </div>
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
                  {isSubmitting ? 'Registering...' : 'Create Visitor Pass'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Digital Badge Modal */}
      {selectedPass && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center relative">
            <button
              onClick={() => setSelectedPass(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full"
            >
              <X size={18} />
            </button>

            <div className="w-12 h-12 bg-blue-50 text-[#007bc0] rounded-2xl flex items-center justify-center mx-auto mb-3 font-black">
              SS
            </div>

            <span className="px-3 py-1 bg-blue-100 text-[#007bc0] text-[10px] font-black uppercase tracking-wider rounded-full">
              Official Visitor Pass
            </span>

            <h3 className="text-xl font-black text-gray-900 mt-3">{selectedPass.visitor_name}</h3>
            <p className="text-xs text-gray-500">{selectedPass.visitor_email}</p>

            <div className="my-5 p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col items-center justify-center">
              <QrCode size={120} className="text-gray-800" />
              <span className="text-[10px] font-mono text-gray-400 mt-2 font-bold tracking-widest uppercase">
                PASS #{selectedPass.id.slice(0, 8)}
              </span>
            </div>

            <div className="text-left text-xs space-y-1.5 border-t border-gray-100 pt-3 text-gray-600">
              <p><strong>Host:</strong> {selectedPass.host_name || user?.name}</p>
              <p><strong>Branch:</strong> {selectedPass.branch_name || 'Main Campus'}</p>
              <p><strong>Date:</strong> {selectedPass.visit_date} ({selectedPass.expected_arrival_time?.slice(0, 5) || '10:00'})</p>
              <p><strong>Purpose:</strong> {selectedPass.purpose}</p>
            </div>

            <div className="mt-6 pt-3 border-t border-gray-100 flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005a8c] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Printer size={16} /> Print Badge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Visitors;
