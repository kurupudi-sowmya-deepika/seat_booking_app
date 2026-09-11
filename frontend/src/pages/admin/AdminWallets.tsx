import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import { 
  Wallet, Search, PlusCircle, Loader2, ChevronRight, 
  AlertCircle, CheckCircle2, X, SlidersHorizontal, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const AdminWallets: React.FC = () => {
  const [wallets, setWallets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [selectedWalletForAdjust, setSelectedWalletForAdjust] = useState<any | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustType, setAdjustType] = useState<string>('ADJUSTMENT');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustLoading, setAdjustLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const res = await api.get('/wallet/admin/all');
      setWallets(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, []);

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWalletForAdjust || !adjustAmount || !adjustReason) return;

    setAdjustLoading(true);
    setStatusMsg(null);

    try {
      await api.post('/wallet/admin/adjust', {
        wallet_id: selectedWalletForAdjust.id,
        amount: Number(adjustAmount),
        transaction_type: adjustType,
        reason: adjustReason
      });

      setStatusMsg({
        type: 'success',
        text: `Successfully performed ${adjustType} of ₹${adjustAmount} on user wallet.`
      });
      setSelectedWalletForAdjust(null);
      setAdjustAmount('');
      setAdjustReason('');
      fetchWallets();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to adjust wallet.'
      });
    } finally {
      setAdjustLoading(false);
    }
  };

  const filteredWallets = wallets.filter((w) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (w.user_name || '').toLowerCase();
      const email = (w.user_email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Prepaid Wallet Governance & Adjustments</h1>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-xl text-xs flex items-center justify-between gap-3 shadow-sm ${statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
          <div className="flex items-center gap-2">
            {statusMsg.type === 'success' ? <CheckCircle2 size={16} className="text-emerald-600" /> : <AlertCircle size={16} className="text-red-600" />}
            <span>{statusMsg.text}</span>
          </div>
          <button onClick={() => setStatusMsg(null)} className="p-1 hover:opacity-75">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
        <div className="relative max-w-md w-full">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search employee by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] transition-all"
          />
        </div>
      </div>

      {/* Wallets Table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="h-64 flex items-center justify-center">
            <Loader2 className="animate-spin text-[#007bc0]" size={36} />
          </div>
        ) : filteredWallets.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Wallet size={40} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium">No user wallets found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Wallet ID</th>
                  <th className="py-3 px-4 text-right">Current Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs">
                {filteredWallets.map((w) => (
                  <tr key={w.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-800">{w.user_name || 'User'}</div>
                      <div className="text-[11px] text-gray-400">{w.user_email}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-gray-400 text-[11px]">
                      {w.id}
                    </td>
                    <td className="py-3.5 px-4 text-right font-extrabold text-gray-900 text-sm whitespace-nowrap">
                      ₹{w.balance.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                        {w.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedWalletForAdjust(w);
                          setAdjustAmount('');
                          setAdjustReason('');
                        }}
                        className="px-3 py-1.5 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                      >
                        <SlidersHorizontal size={14} /> Adjust Credit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Adjustment Modal */}
      <AnimatePresence>
        {selectedWalletForAdjust && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4"
            >
              <button 
                onClick={() => setSelectedWalletForAdjust(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>

              <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
                <SlidersHorizontal size={18} className="text-[#007bc0]" /> Manual Wallet Adjustment
              </h3>
              <p className="text-xs text-gray-500">
                Adjusting balance for <strong>{selectedWalletForAdjust.user_name}</strong> (Current: ₹{selectedWalletForAdjust.balance.toFixed(2)}). Every adjustment creates an immutable audited ledger entry.
              </p>

              <form onSubmit={handleAdjustSubmit} className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Adjustment Type</label>
                  <select
                    value={adjustType}
                    onChange={(e) => setAdjustType(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  >
                    <option value="ADJUSTMENT">ADJUSTMENT (Add Credit)</option>
                    <option value="CREDIT">CREDIT (Promotional / Corporate Allowance)</option>
                    <option value="DEBIT">DEBIT (Correction / Reversal)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="Enter amount (e.g. 500)"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Justification Reason (Mandatory for Audit)
                  </label>
                  <textarea
                    required
                    rows={3}
                    placeholder="e.g. Quarterly employee workspace allowance grant"
                    value={adjustReason}
                    onChange={(e) => setAdjustReason(e.target.value)}
                    className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedWalletForAdjust(null)}
                    className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={adjustLoading}
                    className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow transition-all flex items-center justify-center gap-2"
                  >
                    {adjustLoading ? <Loader2 size={14} className="animate-spin" /> : 'Execute Ledger Adjustment'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminWallets;
