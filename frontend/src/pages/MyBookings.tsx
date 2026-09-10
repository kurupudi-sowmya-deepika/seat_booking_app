import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { 
  Calendar, MapPin, CreditCard, Loader2, ChevronRight, 
  Clock, Trash2, Printer, Search, RefreshCw, CheckCircle2, 
  AlertCircle, X, ShieldCheck, Tag, Building2, Users,
  Download, Edit3, ArrowUpRight, Plus, Sparkles
} from 'lucide-react';
import { DataTable } from '../components/DataTable';

export const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | 'UPCOMING' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modals
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<any | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // Modify Modal
  const [modifyModalOpen, setModifyModalOpen] = useState(false);
  const [modifyingBooking, setModifyingBooking] = useState<any | null>(null);
  const [modifyDate, setModifyDate] = useState('');
  const [modifySlotId, setModifySlotId] = useState('');
  const [modifySubmitting, setModifySubmitting] = useState(false);

  // Extend Modal
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [extendingBooking, setExtendingBooking] = useState<any | null>(null);
  const [additionalHours, setAdditionalHours] = useState(1);
  const [extendSubmitting, setExtendSubmitting] = useState(false);

  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showNewBookingDropdown, setShowNewBookingDropdown] = useState(false);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const [bRes, tsRes] = await Promise.all([
        api.get('/bookings/my'),
        api.get('/time-slots/').catch(() => ({ data: [] }))
      ]);
      setBookings(bRes.data || []);
      setTimeSlots(tsRes.data || []);
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancelBooking = async (bookingId: string) => {
    setCancelLoading(true);
    setActionMessage(null);
    try {
      await api.post(`/bookings/${bookingId}/cancel`);
      setActionMessage({
        type: 'success',
        text: 'Booking successfully cancelled. 100% refund of credits credited back to your wallet.'
      });
      setCancellingBookingId(null);
      fetchBookings();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to cancel booking.'
      });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleDownloadIcs = async (bookingId: string) => {
    try {
      const res = await api.get(`/bookings/${bookingId}/ical`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/calendar' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `seat_booking_${bookingId}.ics`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert('Failed to generate Outlook calendar event');
    }
  };

  const openModifyModal = (booking: any) => {
    setModifyingBooking(booking);
    setModifyDate(booking.booking_date);
    setModifySlotId(booking.time_slot_id || '');
    setModifyModalOpen(true);
  };

  const handleModifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modifyingBooking) return;
    setModifySubmitting(true);
    setActionMessage(null);
    try {
      await api.put(`/bookings/${modifyingBooking.id}/modify`, {
        booking_date: modifyDate,
        time_slot_id: modifySlotId || undefined
      });
      setActionMessage({
        type: 'success',
        text: 'Reservation modified successfully!'
      });
      setModifyModalOpen(false);
      fetchBookings();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to modify booking'
      });
    } finally {
      setModifySubmitting(false);
    }
  };

  const openExtendModal = (booking: any) => {
    setExtendingBooking(booking);
    setAdditionalHours(1);
    setExtendModalOpen(true);
  };

  const handleExtendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingBooking) return;
    setExtendSubmitting(true);
    setActionMessage(null);
    try {
      await api.post(`/bookings/${extendingBooking.id}/extend`, {
        additional_hours: additionalHours
      });
      setActionMessage({
        type: 'success',
        text: `Room reservation extended by +${additionalHours} hour(s)!`
      });
      setExtendModalOpen(false);
      fetchBookings();
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to extend room reservation'
      });
    } finally {
      setExtendSubmitting(false);
    }
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const filteredBookings = bookings.filter((b) => {
    const bookingDate = new Date(b.booking_date);
    bookingDate.setHours(0, 0, 0, 0);

    if (activeTab === 'UPCOMING') {
      if (b.status !== 'CONFIRMED' || bookingDate < today) return false;
    } else if (activeTab === 'COMPLETED') {
      if (b.status !== 'CONFIRMED' || bookingDate >= today) return false;
    } else if (activeTab === 'CANCELLED') {
      if (b.status !== 'CANCELLED') return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const id = (b.id || '').toLowerCase();
      const date = (b.booking_date || '').toLowerCase();
      const loc = (b.location_name || '').toLowerCase();
      const br = (b.branch_name || '').toLowerCase();
      const type = (b.booking_type || '').toLowerCase();
      const room = (b.room_name || '').toLowerCase();
      
      // Search by booking ID or date primarily
      if (!id.includes(q) && !date.includes(q) && !loc.includes(q) && !br.includes(q) && !type.includes(q) && !room.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const getBadge = (b: any) => {
    if (b.status === 'CANCELLED') {
      return <span className="px-2.5 py-1 bg-red-100 text-red-700 font-extrabold text-[11px] rounded-full uppercase">Cancelled</span>;
    }
    const bDate = new Date(b.booking_date);
    bDate.setHours(0,0,0,0);
    if (bDate < today) {
      return <span className="px-2.5 py-1 bg-gray-100 text-gray-700 font-extrabold text-[11px] rounded-full uppercase">Completed</span>;
    }
    return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold text-[11px] rounded-full uppercase">Confirmed</span>;
  };

  return (
    <div className="space-y-6 font-['Inter'] animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight flex items-center gap-2.5">
            <Calendar className="text-[#007bc0]" />
            My Bookings & Reservations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage your workspace schedules, modify dates, extend room meetings, or sync to Microsoft Outlook.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={fetchBookings} 
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition shadow-sm bg-white"
            title="Refresh"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowNewBookingDropdown(!showNewBookingDropdown)}
              className="flex items-center gap-2 bg-[#007bc0] hover:bg-[#005a8c] text-white px-5 py-2.5 rounded-xl font-bold text-sm shadow-md transition shadow-[#007bc0]/20"
            >
              <Plus size={18} />
              New Booking
            </button>
            <AnimatePresence>
              {showNewBookingDropdown && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50 p-2"
                >
                  <Link to="/booking" className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-[#007bc0] rounded-xl transition" onClick={() => setShowNewBookingDropdown(false)}>
                    <MapPin size={16} /> Individual Desk
                  </Link>
                  <Link to="/meeting-rooms" className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-[#007bc0] rounded-xl transition" onClick={() => setShowNewBookingDropdown(false)}>
                    <Users size={16} /> Meeting Room
                  </Link>
                  <Link to="/conference-rooms" className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-[#007bc0] rounded-xl transition" onClick={() => setShowNewBookingDropdown(false)}>
                    <Building2 size={16} /> Conference Room
                  </Link>
                  <div className="h-px bg-gray-100 my-1 mx-2"></div>
                  <Link to="/day-pass" className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-[#007bc0] rounded-xl transition" onClick={() => setShowNewBookingDropdown(false)}>
                    <Tag size={16} /> Full Day Pass
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Action Banner Message */}
      {actionMessage && (
        <div className={`p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-sm ${
          actionMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {actionMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="p-1 hover:opacity-75">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Tabs & Search */}
      <div className="bg-white p-4 rounded-3xl border border-gray-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-80">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search booking ID or date..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {(['ALL', 'UPCOMING', 'COMPLETED', 'CANCELLED'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-[#007bc0] text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab === 'ALL' ? `All (${bookings.length})` : 
               tab === 'UPCOMING' ? `Upcoming (${bookings.filter(b => b.status === 'CONFIRMED' && new Date(b.booking_date) >= today).length})` :
               tab === 'COMPLETED' ? `Completed (${bookings.filter(b => b.status === 'CONFIRMED' && new Date(b.booking_date) < today).length})` :
               `Cancelled (${bookings.filter(b => b.status === 'CANCELLED').length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Bookings Cards Grid */}
      {loading ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border">Loading reservations...</div>
      ) : filteredBookings.length === 0 ? (
        <div className="p-12 text-center text-gray-400 bg-white rounded-3xl border">No bookings found in this category.</div>
      ) : (
        <>
        <div className="hidden lg:block">
          <DataTable
            columns={[
              { key: 'id', header: 'Booking ID', render: (b) => <span className="font-mono font-bold">#{b.id.slice(0, 8).toUpperCase()}</span> },
              { key: 'booking_type', header: 'Type', render: (b) => b.booking_type?.replace('_', ' ') },
              { key: 'resource', header: 'Room / Workspace', render: (b) => b.seat_number ? `Desk ${b.seat_number}` : b.room_name || b.day_pass_name || b.booking_type },
              { key: 'location', header: 'Location', render: (b) => `${b.location_name || ''} · ${b.branch_name || ''}` },
              { key: 'booking_date', header: 'Date' },
              { key: 'start', header: 'Start', render: (b) => b.start_time ? String(b.start_time).slice(0, 5) : (b.time_slot_label || 'Full day').split(' - ')[0] },
              { key: 'end', header: 'End', render: (b) => b.end_time ? String(b.end_time).slice(0, 5) : (b.time_slot_label || 'Full day').split(' - ')[1] || '—' },
              { key: 'number_of_people', header: 'Users', render: (b) => b.number_of_people || 1 },
              { key: 'amount', header: 'Total', render: (b) => `₹${b.amount}` },
              { key: 'status', header: 'Status', render: (b) => getBadge(b) },
              { key: 'actions', header: 'Actions', render: (b) => (
                <div className="flex gap-2">
                  <button onClick={() => setSelectedBookingForDetails(b)} className="px-2 py-1 bg-blue-50 text-[#007bc0] rounded-lg text-[12px] font-bold">View</button>
                  {b.status === 'CONFIRMED' && new Date(b.booking_date) >= today && (
                    <button onClick={() => setCancellingBookingId(b.id)} className="px-2 py-1 bg-red-50 text-red-600 rounded-lg text-[12px] font-bold">Cancel</button>
                  )}
                </div>
              ) },
            ]}
            rows={filteredBookings}
            rowKey={(b) => b.id}
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:hidden">
          {filteredBookings.map((b) => {
            const isConfirmedUpcoming = b.status === 'CONFIRMED' && new Date(b.booking_date) >= today;
            const isHourlyRoom = b.booking_type === 'MEETING_ROOM' || b.booking_type === 'CONFERENCE_ROOM';

            return (
              <div 
                key={b.id} 
                className="bg-white rounded-3xl border border-gray-200/80 p-6 shadow-sm hover:shadow-md transition flex flex-col justify-between"
              >
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    {getBadge(b)}
                    <span className="text-[10px] font-mono font-bold text-gray-400 uppercase">
                      ID #{b.id.slice(0, 8)}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-black text-gray-900">
                      {b.seat_number ? `Desk ${b.seat_number} (${b.seat_type || 'Standard'})` : 
                       b.room_name || (b.booking_type === 'DAY_PASS' ? b.day_pass_name || 'Day Pass' : b.booking_type)}
                    </h3>
                    <div className="flex items-center gap-2 text-xs text-gray-500 font-medium mt-1">
                      <Building2 size={14} className="text-[#007bc0]" />
                      <span>{b.branch_name || 'Main Campus'}</span>
                      <span>•</span>
                      <MapPin size={14} className="text-gray-400" />
                      <span>{b.location_name || 'Bangalore'}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100 text-xs space-y-1.5">
                    <div className="flex items-center justify-between text-gray-700">
                      <span className="flex items-center gap-1 font-semibold">
                        <Calendar size={14} className="text-[#007bc0]" />
                        {b.booking_date}
                      </span>
                      <span className="flex items-center gap-1 font-semibold">
                        <Clock size={14} className="text-gray-400" />
                        {b.time_slot_label || 'Full Day'}
                      </span>
                    </div>

                    {b.facilities && b.facilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {b.facilities.map((f: string, i: number) => (
                          <span key={i} className="px-1.5 py-0.5 bg-blue-50 text-[#007bc0] text-[9px] font-bold rounded">
                            {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-400 uppercase font-bold">Credits Paid</span>
                    <span className="text-lg font-black text-gray-900">₹{b.amount}</span>
                  </div>
                </div>

                {/* Actions Footer */}
                <div className="mt-6 pt-4 border-t border-gray-100 space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadIcs(b.id)}
                      className="flex-1 py-2 bg-blue-50 hover:bg-blue-100 text-[#007bc0] rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                      title="Sync to Microsoft Outlook / Calendar"
                    >
                      <Download size={14} /> Add to Outlook
                    </button>

                    <button
                      onClick={() => setSelectedBookingForDetails(b)}
                      className="p-2 border border-gray-200 hover:bg-gray-50 text-gray-600 rounded-xl text-xs font-bold transition"
                      title="Print Pass"
                    >
                      <Printer size={16} />
                    </button>
                  </div>

                  {isConfirmedUpcoming && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openModifyModal(b)}
                        className="flex-1 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                      >
                        <Edit3 size={12} /> Modify
                      </button>

                      {isHourlyRoom && (
                        <button
                          onClick={() => openExtendModal(b)}
                          className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1"
                        >
                          <Plus size={12} /> Extend
                        </button>
                      )}

                      <button
                        onClick={() => setCancellingBookingId(b.id)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-xl transition"
                        title="Cancel Booking & Refund"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        </>
      )}

      {/* Modify Modal */}
      {modifyModalOpen && modifyingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <Edit3 className="text-[#007bc0]" />
              Modify Reservation Schedule
            </h3>

            <form onSubmit={handleModifySubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  New Booking Date
                </label>
                <input
                  type="date"
                  value={modifyDate}
                  onChange={(e) => setModifyDate(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                />
              </div>

              {modifyingBooking.booking_type === 'SEAT' && (
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                    Time Slot (From — To)
                  </label>
                  <select
                    value={modifySlotId}
                    onChange={(e) => setModifySlotId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-sm font-semibold bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-[#007bc0]"
                  >
                    {timeSlots.map((ts) => (
                      <option key={ts.id} value={ts.id}>
                        From {ts.start_time.slice(0, 5)} To {ts.end_time.slice(0, 5)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-blue-50 text-[#007bc0] rounded-xl text-xs">
                Any price difference will be automatically settled against your prepaid wallet balance.
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setModifyModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modifySubmitting}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-[#007bc0] hover:bg-[#005a8c] text-white shadow-md transition disabled:opacity-50"
                >
                  {modifySubmitting ? 'Updating...' : 'Confirm Modification'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Extend Modal */}
      {extendModalOpen && extendingBooking && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100">
            <h3 className="text-xl font-extrabold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="text-purple-600" />
              Extend Meeting Duration
            </h3>

            <p className="text-xs text-gray-600 mb-4">
              Extend reservation for <strong>{extendingBooking.room_name}</strong> by selecting additional hours.
            </p>

            <form onSubmit={handleExtendSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                  Additional Duration
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((hrs) => (
                    <button
                      type="button"
                      key={hrs}
                      onClick={() => setAdditionalHours(hrs)}
                      className={`py-3 rounded-2xl text-xs font-bold border transition ${
                        additionalHours === hrs 
                          ? 'bg-purple-600 text-white border-purple-600 shadow-md' 
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      +{hrs} Hour{hrs > 1 ? 's' : ''}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setExtendModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={extendSubmitting}
                  className="px-5 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-md transition disabled:opacity-50"
                >
                  {extendSubmitting ? 'Extending...' : `Confirm Extension (+${additionalHours}h)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {cancellingBookingId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-3">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-lg font-black text-gray-900">Cancel Reservation?</h3>
            <p className="text-xs text-gray-500 mt-1 mb-6">
              100% of your prepaid credits will be instantly refunded to your wallet.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setCancellingBookingId(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50"
              >
                Keep Booking
              </button>
              <button
                onClick={() => handleCancelBooking(cancellingBookingId)}
                disabled={cancelLoading}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 shadow disabled:opacity-50"
              >
                {cancelLoading ? 'Cancelling...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Pass Ticket Modal */}
      {selectedBookingForDetails && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative">
            <button
              onClick={() => setSelectedBookingForDetails(null)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-full"
            >
              <X size={18} />
            </button>

            <div className="text-center pb-4 border-b border-gray-100">
              <span className="px-3 py-1 bg-blue-100 text-[#007bc0] text-[10px] font-black uppercase tracking-wider rounded-full">
                Seat Booking App Workspace Pass
              </span>
              <h3 className="text-xl font-black text-gray-900 mt-2">
                {selectedBookingForDetails.seat_number ? `Desk ${selectedBookingForDetails.seat_number}` : selectedBookingForDetails.room_name || selectedBookingForDetails.booking_type}
              </h3>
              <p className="text-xs text-gray-500">{selectedBookingForDetails.branch_name}</p>
            </div>

            <div className="py-4 space-y-2 text-xs text-gray-700">
              <div className="flex justify-between">
                <span className="text-gray-400">Date:</span>
                <span className="font-bold">{selectedBookingForDetails.booking_date}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Slot:</span>
                <span className="font-bold">{selectedBookingForDetails.time_slot_label || 'Full Day'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Status:</span>
                <span className="font-bold text-emerald-600">{selectedBookingForDetails.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Amount Paid:</span>
                <span className="font-bold">₹{selectedBookingForDetails.amount}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 flex gap-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2.5 bg-[#007bc0] hover:bg-[#005a8c] text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow"
              >
                <Printer size={16} /> Print Pass
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyBookings;
