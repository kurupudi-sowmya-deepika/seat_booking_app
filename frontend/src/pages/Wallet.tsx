import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Wallet as WalletIcon, CreditCard, ArrowUpRight, ArrowDownRight,
  RotateCcw, Plus, Loader2, ChevronRight, CheckCircle2,
  AlertCircle, ShieldCheck, Sparkles, ExternalLink, SlidersHorizontal,
  Search, RefreshCw, ArrowRight, Download, Receipt, Info, TrendingUp, TrendingDown
} from 'lucide-react';
import api from '../services/api';

export const Wallet: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState('INR');
  const [walletId, setWalletId] = useState<string>('');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchParams] = useSearchParams();

  const fetchWalletAndTransactions = async () => {
    setLoading(true);
    try {
      const [wRes, txRes] = await Promise.all([
        api.get('/wallet/'),
        api.get('/wallet/transactions')
      ]);
      setBalance(wRes.data.balance);
      setCurrency(wRes.data.currency || 'INR');
      setWalletId(wRes.data.id || '');
      setTransactions(txRes.data || []);
    } catch (err) {
      console.error('Failed to fetch wallet and transactions', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletAndTransactions();
  }, []);

  const handleTopup = async (amount: number) => {
    if (amount <= 0) return;
    setTopupLoading(true);
    try {
      const res = await api.post('/wallet/topup', { amount });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      console.error('Failed to initiate topup', err);
      setTopupLoading(false);
    }
  };

  const getTxIcon = (type: string) => {
    switch (type) {
      case 'CREDIT': return <ArrowDownRight className="text-emerald-600" size={16} />;
      case 'DEBIT': return <ArrowUpRight className="text-red-500" size={16} />;
      case 'REFUND': return <RotateCcw className="text-blue-500" size={16} />;
      case 'ADJUSTMENT': return <SlidersHorizontal className="text-purple-600" size={16} />;
      default: return <CreditCard className="text-gray-400" size={16} />;
    }
  };

  // Stats calculation
  const totalCredits = transactions
    .filter(t => t.transaction_type === 'CREDIT')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalDebits = transactions
    .filter(t => t.transaction_type === 'DEBIT')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  const totalRefunds = transactions
    .filter(t => t.transaction_type === 'REFUND')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0);

  // Filter transactions
  const filteredTransactions = transactions.filter((tx) => {
    if (selectedType !== 'ALL' && tx.transaction_type !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const desc = (tx.description || '').toLowerCase();
      const id = (tx.id || '').toLowerCase();
      const ref = (tx.reference_type || '').toLowerCase();
      if (!desc.includes(q) && !id.includes(q) && !ref.includes(q)) {
        return false;
      }
    }
    return true;
  });

  return (
    <div className="w-full font-['Inter'] space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 bg-blue-100 text-[#007bc0] text-[10px] font-black uppercase rounded-full tracking-wider">
              Financial Hub
            </span>
            <span className="text-xs text-gray-400">•</span>
            <span className="text-xs font-semibold text-gray-500">Live Balance & Ledger</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Digital Wallet & Transaction History
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Preload booking credits via Stripe Checkout and track your real-time immutable credit statement.
          </p>
        </div>

        <button
          onClick={fetchWalletAndTransactions}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl shadow-sm transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? "animate-spin text-[#007bc0]" : "text-gray-500"} />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {/* Payment Feedback Banner */}
      {searchParams.get('success') && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl text-xs flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
            <span className="font-semibold">Payment successful! Your credits have been loaded into your digital wallet.</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-1 rounded-full uppercase">
            Settled
          </span>
        </div>
      )}

      {searchParams.get('canceled') && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl text-xs flex items-center gap-2.5 shadow-sm">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <span className="font-semibold">Top-up session was cancelled. No charges were made to your card.</span>
        </div>
      )}

      {/* Top Financial Dashboard Section: 3-Col Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* 1. Digital Wallet Card (5 cols) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-[#004f80] via-[#007bc0] to-[#0099e6] rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between relative overflow-hidden min-h-[260px]">
          <div className="absolute right-0 top-0 bottom-0 w-48 bg-white/5 transform skew-x-12 pointer-events-none"></div>

          <div>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-blue-100 text-[11px] font-bold uppercase tracking-wider block">
                  Corporate Credit Account
                </span>
                <span className="text-[10px] text-blue-200 font-mono mt-0.5 block">
                  ID: {walletId ? `${walletId.slice(0, 16)}...` : 'SEATSYNC-PREPAID'}
                </span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center text-white border border-white/25 shadow">
                <WalletIcon size={20} />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-baseline gap-2">
                <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
                  ₹{balance.toFixed(2)}
                </h3>
              </div>
              <p className="text-xs text-blue-100 font-medium mt-1 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Active Available Balance ({currency})
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-white/20 flex items-center justify-between text-xs text-blue-100">
            <span className="flex items-center gap-1 font-semibold">
              <ShieldCheck size={14} className="text-emerald-300" /> Instant Settlement
            </span>
            <span className="text-[11px] font-mono text-blue-200">100% Refundable</span>
          </div>
        </div>

        {/* 2. Quick Top-up Card (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-gray-200/80 rounded-3xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <Plus size={16} className="text-[#007bc0]" /> Add Prepaid Balance
              </h3>
              <span className="text-[10px] font-bold text-gray-400 uppercase">Stripe Checkout</span>
            </div>
            <p className="text-xs text-gray-500 mb-4">
              Instant credit top-up with Visa, Mastercard, AMEX, UPI, or NetBanking.
            </p>

            {/* Quick Preset Buttons */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[200, 500, 1000, 2000].map(amt => (
                <button
                  key={amt}
                  onClick={() => handleTopup(amt)}
                  disabled={topupLoading}
                  className="py-2.5 px-2 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-[#007bc0]/50 rounded-xl text-xs font-black text-gray-800 transition flex items-center justify-center gap-1 disabled:opacity-50 group shadow-sm"
                >
                  <span className="text-[#007bc0] group-hover:scale-110 transition-transform">+</span> ₹{amt}
                </button>
              ))}
            </div>

            {/* Custom Amount Field */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-bold">₹</span>
                <input
                  type="number"
                  placeholder="Custom amount (e.g. 1500)"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] transition"
                  min="50"
                />
              </div>
              <button
                onClick={() => handleTopup(Number(customAmount))}
                disabled={topupLoading || !customAmount || Number(customAmount) <= 0}
                className="px-5 py-2.5 bg-[#007bc0] hover:bg-[#005691] text-white text-xs font-bold rounded-xl shadow-md transition disabled:opacity-50 flex items-center gap-1.5 shrink-0"
              >
                {topupLoading ? <Loader2 size={14} className="animate-spin" /> : <><span>Top Up</span> <ArrowRight size={14} /></>}
              </button>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1">
            <Info size={12} className="text-gray-400 shrink-0" />
            Zero transaction fees on corporate prepaid reloads.
          </p>
        </div>
      </div>

      {/* Full Transaction History & Ledger Table Section */}
      <div className="bg-white border border-gray-200/80 rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Receipt size={20} className="text-[#007bc0]" />
              Complete Transaction Ledger
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Chronological log of deposits, workspace reservations, cancellations, and refunds.
            </p>
          </div>

          {/* Type Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['ALL', 'CREDIT', 'DEBIT', 'REFUND', 'ADJUSTMENT'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${selectedType === type
                    ? 'bg-[#007bc0] text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {type === 'ALL' ? 'All Records' : type}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by transaction description, reference ID, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] transition"
          />
        </div>

        {/* Table / Ledger View */}
        <div className="overflow-hidden border border-gray-100 rounded-2xl">
          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <Loader2 className="animate-spin text-[#007bc0]" size={32} />
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <CreditCard size={36} className="text-gray-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-gray-600">No transaction records found</p>
              <p className="text-[11px] text-gray-400 mt-1">Try changing your search keywords or filter pills above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-200/80 text-[11px] font-black text-gray-500 uppercase tracking-wider">
                    <th className="py-3 px-4">Date & Time</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Balance After</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-xs">
                  {filteredTransactions.map((tx) => {
                    const isCredit = tx.transaction_type === 'CREDIT' || tx.transaction_type === 'REFUND';
                    const isDebit = tx.transaction_type === 'DEBIT';

                    return (
                      <tr key={tx.id} className="hover:bg-blue-50/30 transition">
                        <td className="py-3.5 px-4 font-medium text-gray-600 whitespace-nowrap">
                          {new Date(tx.created_at).toLocaleString([], {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </td>
                        <td className="py-3.5 px-4 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${tx.transaction_type === 'CREDIT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              tx.transaction_type === 'DEBIT' ? 'bg-red-50 text-red-700 border border-red-200' :
                                tx.transaction_type === 'REFUND' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                                  'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}>
                            {getTxIcon(tx.transaction_type)}
                            {tx.transaction_type}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          {tx.description}
                          {tx.reference_type && (
                            <span className="text-[10px] text-gray-400 block font-normal font-mono">
                              Ref: {tx.reference_type} {tx.reference_id ? `(#${tx.reference_id.slice(0, 8)})` : ''}
                            </span>
                          )}
                        </td>
                        <td className={`py-3.5 px-4 text-right font-black whitespace-nowrap ${isCredit ? 'text-emerald-600' : isDebit ? 'text-red-600' : 'text-purple-600'
                          }`}>
                          {isCredit ? '+' : isDebit ? '-' : ''}₹{Number(tx.amount).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-black text-gray-800 whitespace-nowrap">
                          ₹{Number(tx.balance_after).toFixed(2)}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100/80 text-emerald-800 text-[10px] font-bold rounded-md">
                            <CheckCircle2 size={10} className="text-emerald-600" /> Settled
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wallet;
