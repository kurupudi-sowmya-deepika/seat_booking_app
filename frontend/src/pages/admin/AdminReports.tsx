import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import { 
  BarChart3, Download, Calendar, DollarSign, 
  Building2, Users, PieChart, TrendingUp, RefreshCw, Filter, Layers
} from 'lucide-react';

export const AdminReports: React.FC = () => {
  const [revenueData, setRevenueData] = useState<any>(null);
  const [occupancyData, setOccupancyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // '7', '30', '90'
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const days = parseInt(dateRange, 10);
      const end = new Date();
      const start = new Date();
      start.setDate(end.getDate() - days);

      const startStr = start.toISOString().split('T')[0];
      const endStr = end.toISOString().split('T')[0];

      const [revRes, occRes] = await Promise.all([
        api.get(`/reports/revenue?start_date=${startStr}&end_date=${endStr}`),
        api.get('/reports/occupancy')
      ]);

      setRevenueData(revRes.data);
      setOccupancyData(occRes.data);
    } catch (err) {
      console.error('Failed to load reports', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await api.get('/reports/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `seat_booking_revenue_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <BarChart3 className="text-[#007bc0]" />
            Revenue & Booking Analytics
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enterprise financial reports, branch utilization rates, and booking performance logs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3.5 py-2.5 bg-white border border-gray-200 text-xs font-bold rounded-xl text-gray-700 shadow-sm focus:outline-none focus:border-[#007bc0]"
          >
            <option value="7">Last 7 Days</option>
            <option value="30">Last 30 Days</option>
            <option value="90">Last 90 Days</option>
          </select>

          <button
            onClick={fetchReports}
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-sm bg-white"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition shadow-[#007bc0]/20 disabled:opacity-50"
          >
            <Download size={16} />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">Total Revenue</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#007bc0] flex items-center justify-center">
              <DollarSign size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-black text-gray-900 mt-2">
            ₹{revenueData?.total_revenue?.toLocaleString() || '0'}
          </h3>
          <p className="text-xs text-gray-500 mt-1">Confirmed wallet settlements</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">Total Bookings</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Calendar size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-black text-emerald-600 mt-2">
            {revenueData?.total_confirmed_bookings || 0}
          </h3>
          <p className="text-xs text-gray-500 mt-1">Avg: ₹{revenueData?.average_booking_value || 0} / booking</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">Desk Occupancy</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Users size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-black text-purple-600 mt-2">
            {occupancyData?.overall_seat_occupancy || 0}%
          </h3>
          <p className="text-xs text-gray-500 mt-1">{occupancyData?.today_seats_booked || 0} of {occupancyData?.total_seats || 0} desks active today</p>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-gray-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">Room Utilization</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <h3 className="text-3xl font-black text-amber-600 mt-2">
            {occupancyData?.overall_room_utilization || 0}%
          </h3>
          <p className="text-xs text-gray-500 mt-1">{occupancyData?.today_rooms_booked || 0} of {occupancyData?.total_rooms || 0} suites booked</p>
        </div>
      </div>

      {/* Revenue Breakdown by Product & Daily Trend */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Breakdown by Product Category */}
        <div className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2 border-b border-gray-100 pb-3">
            <PieChart size={18} className="text-[#007bc0]" />
            Revenue by Resource Category
          </h3>

          <div className="space-y-4 pt-2">
            {revenueData?.breakdown_by_type && Object.entries(revenueData.breakdown_by_type).map(([key, val]: any) => {
              const total = revenueData.total_revenue || 1;
              const pct = Math.round((val.revenue / total) * 100);
              return (
                <div key={key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold">
                    <span className="text-gray-700">{key.replace('_', ' ')}</span>
                    <span className="text-gray-900">₹{val.revenue.toLocaleString()} ({val.count} bookings)</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        key === 'SEAT' ? 'bg-[#007bc0]' :
                        key === 'DAY_PASS' ? 'bg-emerald-500' :
                        key === 'MEETING_ROOM' ? 'bg-purple-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily Trend List */}
        <div className="lg:col-span-2 bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2 border-b border-gray-100 pb-3">
            <TrendingUp size={18} className="text-emerald-600" />
            Daily Revenue & Booking Volume
          </h3>

          <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
            {revenueData?.daily_trend && revenueData.daily_trend.map((day: any) => (
              <div key={day.date} className="py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">{day.date}</span>
                <div className="flex items-center gap-6">
                  <span className="text-gray-500">{day.bookings} bookings</span>
                  <span className="font-black text-gray-900 w-24 text-right">₹{day.revenue.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Branch Utilization Table */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-sm overflow-hidden p-6 space-y-4">
        <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2 border-b border-gray-100 pb-3">
          <Building2 size={18} className="text-purple-600" />
          Branch Utilization & Capacity Metrics
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-200 text-[11px] font-extrabold uppercase text-gray-400 tracking-wider">
                <th className="py-3 px-4">Campus / Branch</th>
                <th className="py-3 px-4">Total Desks</th>
                <th className="py-3 px-4">Active Bookings Today</th>
                <th className="py-3 px-4">Utilization Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {occupancyData?.branch_breakdown && occupancyData.branch_breakdown.map((b: any) => (
                <tr key={b.branch_id} className="hover:bg-gray-50/60">
                  <td className="py-3.5 px-4 font-bold text-gray-900">{b.branch_name}</td>
                  <td className="py-3.5 px-4 text-gray-600">{b.total_desks}</td>
                  <td className="py-3.5 px-4 font-semibold text-gray-900">{b.booked_today}</td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            b.utilization_rate > 75 ? 'bg-red-500' :
                            b.utilization_rate > 40 ? 'bg-[#007bc0]' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${b.utilization_rate}%` }}
                        />
                      </div>
                      <span className="font-bold text-xs text-gray-800">{b.utilization_rate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;
