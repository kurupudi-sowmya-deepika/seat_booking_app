import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet as WalletIcon, CreditCard, ArrowUpRight, ArrowDownRight, RotateCcw, Plus, Loader2 } from 'lucide-react';
import api from '../services/api';

const Wallet: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [currency, setCurrency] = useState('INR');
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topupLoading, setTopupLoading] = useState(false);
  const [searchParams] = useSearchParams();

  const fetchWallet = async () => {
    try {
      const res = await api.get('/wallet/');
      setBalance(res.data.balance);
      setCurrency(res.data.currency);
      
      const txRes = await api.get('/wallet/transactions');
      setTransactions(txRes.data);
    } catch (err) {
      console.error('Failed to fetch wallet', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWallet();
  }, []);

  const handleTopup = async (amount: number) => {
    setTopupLoading(true);
    try {
      const res = await api.post('/wallet/topup', { amount });
      if (res.data.checkout_url) {
        window.location.href = res.data.checkout_url;
      }
    } catch (err) {
      console.error(err);
      setTopupLoading(false);
    }
  };

  const getTxIcon = (type: string) => {
    switch(type) {
      case 'CREDIT': return <ArrowDownRight className="text-success-color" />;
      case 'DEBIT': return <ArrowUpRight className="text-danger-color" />;
      case 'REFUND': return <RotateCcw className="text-warning-color" />;
      default: return <CreditCard className="text-text-secondary" />;
    }
  };

  if (loading) {
    return <div className="flex-center min-h-[50vh]"><Loader2 className="animate-spin text-primary-color" size={32} /></div>;
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">My Wallet</h1>
        <p className="text-text-secondary">Manage your credits and view transaction history.</p>
      </div>

      {searchParams.get('success') && (
        <div className="badge badge-success p-4 block text-center">
          Payment successful! Your credits have been added.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balance Card */}
        <div className="glass-panel p-8 col-span-1 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <WalletIcon size={120} />
          </div>
          <div>
            <h3 className="text-text-secondary font-medium mb-2">Current Balance</h3>
            <div className="text-5xl font-bold text-white mb-1">₹{balance.toFixed(2)}</div>
            <p className="text-sm text-text-muted">{currency}</p>
          </div>
          
          <div className="mt-8 pt-6 border-t border-[rgba(255,255,255,0.1)]">
            <h4 className="text-sm font-medium text-white mb-4">Quick Add</h4>
            <div className="grid grid-cols-2 gap-3">
              {[100, 500, 1000, 2000].map(amount => (
                <button 
                  key={amount}
                  onClick={() => handleTopup(amount)}
                  disabled={topupLoading}
                  className="btn btn-secondary py-2 text-sm flex-center gap-1"
                >
                  <Plus size={14} /> ₹{amount}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="glass-panel p-6 col-span-1 lg:col-span-2">
          <h2 className="text-xl font-semibold mb-6 text-white flex justify-between items-center">
            <span>Transaction History</span>
          </h2>
          
          {transactions.length === 0 ? (
            <div className="flex-center flex-col py-12 text-text-muted">
              <CreditCard size={48} className="opacity-20 mb-4" />
              <p>No transactions yet.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map(tx => (
                <div key={tx.id} className="flex items-center justify-between p-4 rounded-xl bg-[rgba(0,0,0,0.2)] border border-[rgba(255,255,255,0.05)]">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[rgba(255,255,255,0.05)] flex-center">
                      {getTxIcon(tx.transaction_type)}
                    </div>
                    <div>
                      <p className="font-medium text-white">{tx.description || tx.transaction_type}</p>
                      <p className="text-xs text-text-muted">{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-semibold ${tx.transaction_type === 'CREDIT' || tx.transaction_type === 'REFUND' ? 'text-success-color' : 'text-white'}`}>
                      {tx.transaction_type === 'DEBIT' ? '-' : '+'}₹{tx.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-text-muted">Balance: ₹{tx.balance_after.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wallet;
