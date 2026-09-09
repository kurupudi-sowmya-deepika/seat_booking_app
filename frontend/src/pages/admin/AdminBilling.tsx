import React from 'react';
import { CreditCard, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const AdminBilling: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-2">Billing & Wallets</h1>
          <p className="text-[var(--text-secondary)]">Manage user wallets, view transactions, and configure payment gateways.</p>
        </div>
        <button className="btn btn-primary">Generate Report</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-panel p-6 border-t-4 border-[var(--primary-color)]">
          <h3 className="text-[var(--text-secondary)] font-medium mb-2">Total System Revenue</h3>
          <p className="text-3xl font-bold text-[var(--text-primary)]">₹ 2,45,000</p>
          <div className="flex items-center gap-1 text-[var(--success-color)] text-sm mt-2">
            <ArrowUpRight size={16} /> +12% from last month
          </div>
        </div>

        <div className="glass-panel p-6 border-t-4 border-[var(--warning-color)]">
          <h3 className="text-[var(--text-secondary)] font-medium mb-2">Total Funds in Wallets</h3>
          <p className="text-3xl font-bold text-[var(--text-primary)]">₹ 85,200</p>
          <div className="flex items-center gap-1 text-[var(--text-secondary)] text-sm mt-2">
            Across 1,250 active user wallets
          </div>
        </div>

        <div className="glass-panel p-6 border-t-4 border-[var(--danger-color)]">
          <h3 className="text-[var(--text-secondary)] font-medium mb-2">Pending Refunds</h3>
          <p className="text-3xl font-bold text-[var(--text-primary)]">₹ 4,500</p>
          <div className="flex items-center gap-1 text-[var(--danger-color)] text-sm mt-2">
            <ArrowDownRight size={16} /> 12 Action items required
          </div>
        </div>
      </div>

      {/* Transaction Table */}
      <div className="glass-panel overflow-hidden mt-8">
        <div className="p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Recent Transactions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--surface-color-light)] border-b border-[var(--border-color)] text-[var(--text-secondary)] text-sm">
                <th className="p-4 font-medium">Transaction ID</th>
                <th className="p-4 font-medium">User</th>
                <th className="p-4 font-medium">Type</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Date</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4].map((item) => (
                <tr key={item} className="border-b border-[var(--border-color)] hover:bg-[var(--surface-color-light)] transition-colors">
                  <td className="p-4 text-sm font-medium text-[var(--text-primary)]">TXN-{9000 + item}</td>
                  <td className="p-4">
                    <div className="font-medium text-[var(--text-primary)] text-sm">John Smith</div>
                    <div className="text-xs text-[var(--text-muted)]">john.smith@seatsync.com</div>
                  </td>
                  <td className="p-4 text-sm text-[var(--text-secondary)] flex items-center gap-2">
                    <CreditCard size={14}/> {item % 2 === 0 ? 'Top-up' : 'Booking Deduction'}
                  </td>
                  <td className="p-4 font-medium text-[var(--text-primary)] text-sm">
                    {item % 2 === 0 ? <span className="text-[var(--success-color)]">+₹2000</span> : <span className="text-[var(--text-primary)]">-₹400</span>}
                  </td>
                  <td className="p-4 text-sm text-[var(--text-secondary)]">Oct {10 + item}, 2026</td>
                  <td className="p-4">
                    <span className="badge badge-success">Completed</span>
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

export default AdminBilling;
