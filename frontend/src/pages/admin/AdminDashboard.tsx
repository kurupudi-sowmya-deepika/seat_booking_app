import React from 'react';
import { Users, Calendar, DollarSign, Activity } from 'lucide-react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Admin Dashboard</h1>
        <p className="text-[var(--text-secondary)]">System overview and key metrics.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-panel p-6 flex flex-col hover:border-[var(--primary-color)] transition-colors">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(59,130,246,0.1)] flex items-center justify-center text-[var(--primary-color)]">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">432</h3>
              <p className="text-sm text-[var(--text-secondary)]">Total Bookings</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col hover:border-[var(--primary-color)] transition-colors">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(16,185,129,0.1)] flex items-center justify-center text-[var(--success-color)]">
              <Users size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">1,250</h3>
              <p className="text-sm text-[var(--text-secondary)]">Active Users</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col hover:border-[var(--primary-color)] transition-colors">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(245,158,11,0.1)] flex items-center justify-center text-[var(--warning-color)]">
              <DollarSign size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">₹ 84K</h3>
              <p className="text-sm text-[var(--text-secondary)]">Revenue (MTD)</p>
            </div>
          </div>
        </div>

        <div className="glass-panel p-6 flex flex-col hover:border-[var(--primary-color)] transition-colors">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-full bg-[rgba(239,68,68,0.1)] flex items-center justify-center text-[var(--danger-color)]">
              <Activity size={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">94%</h3>
              <p className="text-sm text-[var(--text-secondary)]">System Uptime</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Recent Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface-color-light)] border-b border-[var(--border-color)] text-[var(--text-secondary)] text-sm">
                <th className="p-4 font-medium">User</th>
                <th className="p-4 font-medium">Location</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {/* Dummy data for UI structure */}
              {[1, 2, 3, 4, 5].map((item) => (
                <tr key={item} className="border-b border-[var(--border-color)] hover:bg-[var(--surface-color-light)] transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-[var(--text-primary)]">User {item}</div>
                    <div className="text-xs text-[var(--text-muted)]">user{item}@seatsync.com</div>
                  </td>
                  <td className="p-4 text-[var(--text-secondary)]">Bangalore - Building A, Room 101</td>
                  <td className="p-4 text-[var(--text-secondary)]">Oct {10 + item}, 2026</td>
                  <td className="p-4">
                    <span className="badge badge-success">Confirmed</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 text-center border-t border-[var(--border-color)]">
          <button className="text-[var(--primary-color)] text-sm font-medium hover:underline">View All Bookings</button>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
