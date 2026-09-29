import React, { useState, useEffect } from 'react';
import {
  Settings, ShieldCheck, CreditCard, Bell,
  Clock, Database, CheckCircle2, Save, Sparkles, AlertCircle, Loader2
} from 'lucide-react';
import api from '../../services/api';

// Maps this component's camelCase field names to the API's snake_case ones.
const toApiPayload = (s: typeof DEFAULT_SETTINGS) => ({
  company_name: s.companyName,
  support_email: s.supportEmail,
  currency: s.currency,
  max_advance_booking_days: s.maxAdvanceBookingDays,
  cancellation_window_hours: s.cancellationWindowHours,
  refund_percentage: s.refundPercentage,
  enable_entra_id_sso: s.enableEntraIdSSO,
  enable_local_auth: s.enableLocalAuth,
  openai_assistant_enabled: s.openAiAssistant,
  daily_reminder_email: s.dailyReminderEmail,
});

const fromApiResponse = (r: any) => ({
  companyName: r.company_name,
  supportEmail: r.support_email,
  currency: r.currency,
  maxAdvanceBookingDays: r.max_advance_booking_days,
  cancellationWindowHours: r.cancellation_window_hours,
  refundPercentage: r.refund_percentage,
  enableEntraIdSSO: r.enable_entra_id_sso,
  enableLocalAuth: r.enable_local_auth,
  stripeWebhookLive: true, // read-only/informational - not a persisted toggle
  openAiAssistant: r.openai_assistant_enabled,
  dailyReminderEmail: r.daily_reminder_email,
});

const DEFAULT_SETTINGS = {
  companyName: 'Acme Enterprise Workspaces',
  supportEmail: 'workspace-support@acme.com',
  currency: 'INR (₹)',
  maxAdvanceBookingDays: 30,
  cancellationWindowHours: 2,
  refundPercentage: 100,
  enableEntraIdSSO: true,
  enableLocalAuth: true,
  stripeWebhookLive: true,
  openAiAssistant: true,
  dailyReminderEmail: true,
};

export const AdminSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  useEffect(() => {
    api.get('/admin/settings')
      .then(res => setSettings(fromApiResponse(res.data)))
      .catch(() => setError('Failed to load saved settings - showing defaults.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const res = await api.put('/admin/settings', toApiPayload(settings));
      setSettings(fromApiResponse(res.data));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Settings className="text-[#007bc0]" />
            Enterprise System Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Global policies, booking windows, authentication providers, and AI concierge configurations.
          </p>
        </div>

        {saved && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-green-50 text-green-700 rounded-xl text-xs font-bold border border-green-200">
            <CheckCircle2 size={16} />
            Settings saved successfully!
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 px-3.5 py-1.5 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Navigation Sidebar */}
        <div className="space-y-1">
          {[
            { id: 'general', label: 'General & Branding', icon: <Settings size={18} /> },
            { id: 'policies', label: 'Booking & Cancellation', icon: <Clock size={18} /> },
            { id: 'auth', label: 'SSO & Authentication', icon: <ShieldCheck size={18} /> },
            { id: 'payments', label: 'Billing & Stripe', icon: <CreditCard size={18} /> },
            { id: 'ai', label: 'AI Concierge', icon: <Sparkles size={18} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all text-left ${
                activeTab === tab.id
                  ? 'bg-[#007bc0] text-white shadow-md'
                  : 'text-gray-600 hover:bg-white hover:text-gray-900'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Panel */}
        <div className="md:col-span-3 bg-white rounded-3xl border border-gray-200/80 p-6 sm:p-8 shadow-sm">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
              <Loader2 size={20} className="animate-spin" /> Loading settings...
            </div>
          ) : (
          <form onSubmit={handleSave} className="space-y-6">
            {activeTab === 'general' && (
              <div className="space-y-5">
                <h3 className="text-base font-black text-gray-900 border-b border-gray-100 pb-3">
                  Workspace Identity & Localization
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={settings.companyName}
                      onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Support Email
                    </label>
                    <input
                      type="email"
                      value={settings.supportEmail}
                      onChange={(e) => setSettings({ ...settings, supportEmail: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Currency & Accounting Unit
                  </label>
                  <select
                    value={settings.currency}
                    onChange={(e) => setSettings({ ...settings, currency: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  >
                    <option value="INR (₹)">Indian Rupee (₹ INR)</option>
                    <option value="USD ($)">US Dollar ($ USD)</option>
                    <option value="EUR (€)">Euro (€ EUR)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'policies' && (
              <div className="space-y-5">
                <h3 className="text-base font-black text-gray-900 border-b border-gray-100 pb-3">
                  Reservation Windows & Refund Rules
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Max Advance Booking Days
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={settings.maxAdvanceBookingDays}
                      onChange={(e) => setSettings({ ...settings, maxAdvanceBookingDays: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                      Refund Percentage on Cancellation (%)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.refundPercentage}
                      onChange={(e) => setSettings({ ...settings, refundPercentage: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                    />
                  </div>
                </div>

                <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100 text-xs text-[#007bc0] leading-relaxed">
                  <strong>Automatic Refund Engine:</strong> When an employee cancels a confirmed booking before the start time, 100% of credits are instantly refunded back into their prepaid wallet balance with an immutable transaction log.
                </div>
              </div>
            )}

            {activeTab === 'auth' && (
              <div className="space-y-5">
                <h3 className="text-base font-black text-gray-900 border-b border-gray-100 pb-3">
                  Single Sign-On (Microsoft Entra ID) & Local Auth
                </h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Microsoft Entra ID (Azure AD) SSO</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Allow employees to sign in with corporate Office 365 credentials</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableEntraIdSSO}
                      onChange={(e) => setSettings({ ...settings, enableEntraIdSSO: e.target.checked })}
                      className="w-5 h-5 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Local Email / Password Authentication</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Allow direct sign-in for contractors and local development accounts</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableLocalAuth}
                      onChange={(e) => setSettings({ ...settings, enableLocalAuth: e.target.checked })}
                      className="w-5 h-5 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-5">
                <h3 className="text-base font-black text-gray-900 border-b border-gray-100 pb-3">
                  Payment Gateway & Wallet Architecture
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Stripe Checkout & Webhooks</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Automated credit allocation on successful Stripe checkout sessions</p>
                    </div>
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                      Active (Idempotent)
                    </span>
                  </div>

                  <div className="p-4 bg-slate-900 text-slate-200 rounded-2xl text-xs space-y-2 font-mono">
                    <p className="text-slate-400 uppercase text-[10px] font-bold">Ledger Safety Constraints</p>
                    <p>• Concurrency Control: PostgreSQL <code className="text-amber-400">SELECT ... FOR UPDATE</code> on all wallet updates</p>
                    <p>• Balance Integrity: Wallet balances can NEVER be negative</p>
                    <p>• Audit Trail: Every transaction records <code className="text-emerald-400">reference_id</code> and timestamp</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="space-y-5">
                <h3 className="text-base font-black text-gray-900 border-b border-gray-100 pb-3">
                  Google Gemini Workspace Assistant
                </h3>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-200">
                    <div>
                      <h4 className="font-bold text-gray-900 text-sm">Autonomous Chatbot Concierge</h4>
                      <p className="text-xs text-gray-500 mt-0.5">Empower employees to search branches, book desks, and check balances using natural language</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.openAiAssistant}
                      onChange={(e) => setSettings({ ...settings, openAiAssistant: e.target.checked })}
                      className="w-5 h-5 text-[#007bc0] rounded border-gray-300 focus:ring-[#007bc0]"
                    />
                  </div>

                  <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 text-xs text-purple-900 space-y-1">
                    <span className="font-bold block">Available Backend Function Tools:</span>
                    <span className="block text-[11px] text-purple-700 font-mono">
                      search_locations, get_nearest_location, search_branches, search_rooms, get_time_slots, check_availability, get_day_pass_availability, get_wallet_balance, get_my_bookings, confirm_intent_to_book, confirm_intent_to_cancel
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-100 flex items-center justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#007bc0] hover:bg-[#005a8c] text-white rounded-xl font-bold text-sm shadow-md transition shadow-[#007bc0]/20 disabled:opacity-60"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Saving...' : 'Save System Configuration'}
              </button>
            </div>
          </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;
