import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import { 
  Users, Calendar, DollarSign, Activity, MapPin, 
  Building2, DoorOpen, Armchair, Tag, ShieldCheck, 
  TrendingUp, Loader2, ArrowUpRight, CheckCircle2
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/admin/stats')
      .then(res => setStats(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="animate-spin text-[#007bc0]" size={36} />
      </div>
    );
  }

  const metrics = [
    { label: 'Total Users', value: stats?.total_users ?? 0, icon: <Users size={20} />, color: 'bg-blue-50 text-[#007bc0]', link: '/admin/users' },
    { label: 'Total Locations', value: stats?.total_locations ?? 0, icon: <MapPin size={20} />, color: 'bg-emerald-50 text-emerald-600', link: '/admin/locations' },
    { label: 'Active Branches', value: stats?.total_branches ?? 0, icon: <Building2 size={20} />, color: 'bg-indigo-50 text-indigo-600', link: '/admin/branches' },
    { label: 'Rooms & Zones', value: stats?.total_rooms ?? 0, icon: <DoorOpen size={20} />, color: 'bg-purple-50 text-purple-600', link: '/admin/rooms' },
    { label: 'Total Desks', value: stats?.total_seats ?? 0, icon: <Armchair size={20} />, color: 'bg-amber-50 text-amber-600', link: '/admin/seats' },
    { label: 'Day Pass Types', value: stats?.total_day_passes ?? 0, icon: <Tag size={20} />, color: 'bg-teal-50 text-teal-600', link: '/admin/day-passes' },
    { label: 'Total Bookings', value: stats?.total_bookings ?? 0, icon: <Calendar size={20} />, color: 'bg-sky-50 text-sky-600', link: '/admin/bookings' },
    { label: 'Seat Occupancy', value: `${stats?.occupancy_rate ?? 0}%`, icon: <Activity size={20} />, color: 'bg-rose-50 text-rose-600', link: '/admin/bookings' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Administrator Command Center</h1>
        <p className="text-xs text-gray-500 mt-0.5">Real-time enterprise workspace metrics, occupancy rates, and financial reports.</p>
      </div>

      {/* Financial & Revenue Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-[#005691] to-[#007bc0] rounded-2xl p-6 text-white shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-blue-100 text-xs font-semibold uppercase tracking-wider">Confirmed Revenue</p>
              <h3 className="text-3xl font-extrabold mt-1">₹{(stats?.total_revenue ?? 0).toFixed(2)}</h3>
              <p className="text-xs text-blue-200 mt-1">Lifetime booking receipts</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <DollarSign size={24} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-xs font-semibold uppercase tracking-wider">Total Prepaid Credits</p>
              <h3 className="text-3xl font-extrabold mt-1">₹{(stats?.total_wallet_credits ?? 0).toFixed(2)}</h3>
              <p className="text-xs text-emerald-200 mt-1">Active user balance across all wallets</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <ShieldCheck size={24} />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-700 to-indigo-800 rounded-2xl p-6 text-white shadow-md">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-purple-100 text-xs font-semibold uppercase tracking-wider">Today's Bookings</p>
              <h3 className="text-3xl font-extrabold mt-1">{stats?.today_bookings ?? 0}</h3>
              <p className="text-xs text-purple-200 mt-1">{stats?.upcoming_bookings ?? 0} upcoming confirmed reservations</p>
            </div>
            <div className="p-3 bg-white/10 rounded-xl">
              <Calendar size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Key Resources */}
      <div>
        <h2 className="text-base font-bold text-gray-800 mb-4">Workspace Resource Inventory</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m, idx) => (
            <Link
              key={idx}
              to={m.link}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-blue-300 transition-all flex items-center justify-between group"
            >
              <div>
                <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{m.label}</p>
                <h4 className="text-xl font-bold text-gray-800 mt-1">{m.value}</h4>
              </div>
              <div className={`p-2.5 rounded-xl ${m.color} group-hover:scale-110 transition-transform`}>
                {m.icon}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Booking Trends & Branch Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Trend chart */}
        <div className="lg:col-span-7 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#007bc0]" /> 7-Day Reservation Trajectory
          </h3>
          <p className="text-xs text-gray-500 mb-6">Daily booking volume over the last 7 days.</p>

          <div className="flex items-end gap-3 h-48 pt-6 border-b border-gray-100">
            {(stats?.booking_trends || []).map((t: any, i: number) => {
              const heightPct = Math.max(15, Math.min(100, (t.bookings / Math.max(1, ...(stats?.booking_trends || []).map((x: any) => x.bookings))) * 100));
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                  <span className="text-[10px] font-bold text-[#007bc0] opacity-0 group-hover:opacity-100 transition-opacity">
                    {t.bookings}
                  </span>
                  <div 
                    className="w-full max-w-[36px] bg-gradient-to-t from-[#005691] to-[#007bc0] rounded-t-lg transition-all group-hover:brightness-110 shadow-sm"
                    style={{ height: `${heightPct}%` }}
                  ></div>
                  <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap mt-1">{t.date}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Popular Branches */}
        <div className="lg:col-span-5 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
              <Building2 size={16} className="text-[#007bc0]" /> Popular Branches by Volume
            </h3>
            <p className="text-xs text-gray-500 mb-5">Top active campus locations.</p>

            <div className="space-y-3">
              {(stats?.popular_branches || []).map((b: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-[#007bc0]/10 text-[#007bc0] flex items-center justify-center font-bold text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-gray-800">{b.name}</span>
                  </div>
                  <span className="font-semibold text-gray-600 bg-white px-2.5 py-1 rounded-md border border-gray-200">
                    {b.bookings} Bookings
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 flex justify-between items-center text-xs">
            <span className="text-gray-400">Audited metrics</span>
            <Link to="/admin/bookings" className="text-[#007bc0] font-bold hover:underline flex items-center gap-1">
              View All Bookings <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
