import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Tag, MapPin, Building2, Calendar as CalIcon, Loader2, 
  CheckCircle2, ArrowRight, ShieldCheck, Coffee, Wifi, 
  ChevronRight, AlertCircle, X, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AutoLocationDetector from '../components/AutoLocationDetector';

export const DayPass: React.FC = () => {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [passes, setPasses] = useState<any[]>([]);
  const [selectedPass, setSelectedPass] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  useEffect(() => {
    api.get('/locations/').then(res => setLocations(res.data)).catch(() => {});
    api.get('/wallet/').then(res => setWallet(res.data)).catch(() => {});
  }, []);

  const handleLocationAutoDetected = (locId: string, branchId?: string) => {
    setSelectedLoc(locId);
    if (branchId) {
      setTimeout(() => setSelectedBranch(branchId), 200);
    }
  };

  useEffect(() => {
    if (selectedLoc) {
      api.get('/branches/').then(res => {
        setBranches(res.data.filter((b: any) => b.location_id === selectedLoc));
      }).catch(() => {});
      setSelectedBranch('');
      setPasses([]);
      setSelectedPass(null);
    }
  }, [selectedLoc]);

  const fetchPassAvailability = async () => {
    if (selectedBranch && date) {
      setLoading(true);
      setError('');
      try {
        const res = await api.get('/bookings/availability/day-pass', {
          params: { branch_id: selectedBranch, booking_date: date }
        });
        setPasses(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchPassAvailability();
  }, [selectedBranch, date]);

  const handleBookDayPass = async () => {
    if (!selectedPass) return;
    setBookingLoading(true);
    setError('');

    try {
      const res = await api.post('/bookings/', {
        booking_type: 'DAY_PASS',
        location_id: selectedLoc,
        branch_id: selectedBranch,
        day_pass_id: selectedPass.day_pass_id,
        booking_date: date
      });
      if (res.data.id) {
        setShowConfirmModal(false);
        navigate('/booking/success?session_id=' + res.data.id);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to book Day Pass");
      setBookingLoading(false);
      setShowConfirmModal(false);
      fetchPassAvailability();
    }
  };

  const selectedLocObj = locations.find(l => l.id === selectedLoc);
  const selectedBranchObj = branches.find(b => b.id === selectedBranch);

  const walletBalance = wallet?.balance ?? 0;
  const passPrice = selectedPass ? selectedPass.price : 0;
  const remainingBalance = walletBalance - passPrice;
  const hasSufficientCredits = remainingBalance >= 0;

  return (
    <div className="w-full font-['Inter'] space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Purchase Hot Desk Day Pass</h1>
      </div>

      {/* Auto Location Detector */}
      <AutoLocationDetector onLocationDetected={handleLocationAutoDetected} selectedLocationId={selectedLoc} />

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md shadow-sm">
              <div className="flex justify-between items-center">
                <p className="text-sm text-red-700 font-medium flex items-center gap-2">
                  <AlertCircle size={16} /> {error}
                </p>
                {error.includes("Insufficient") && (
                  <Link to="/wallet" className="text-sm font-bold text-red-700 hover:underline">Add Credits &rarr;</Link>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">1</span> 
              Select Location & Date
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><MapPin size={14}/> Office Location</label>
                <select className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-gray-50/50 text-sm" value={selectedLoc} onChange={e => setSelectedLoc(e.target.value)}>
                  <option value="">Select Location</option>
                  {locations.map(l => <option key={l.id} value={l.id}>{l.name} ({l.city})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><Building2 size={14}/> Branch</label>
                <select className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-gray-50/50 text-sm disabled:opacity-50" value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)} disabled={!selectedLoc}>
                  <option value="">Select Branch</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><CalIcon size={14}/> Pass Date</label>
                <input type="date" className="w-full border border-gray-300 rounded-xl px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all bg-gray-50/50 text-sm" value={date} onChange={e => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
            </div>
          </div>

          {/* Perks card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" /> Day Pass Privileges
            </h3>
            <ul className="space-y-2.5 text-xs text-emerald-800">
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Full 9 AM - 7 PM hot desk access</li>
              <li className="flex items-center gap-2"><Wifi size={14} className="text-emerald-600" /> High-speed enterprise Wi-Fi (1 Gbps)</li>
              <li className="flex items-center gap-2"><Coffee size={14} className="text-emerald-600" /> Unlimited premium coffee, tea, and pantry access</li>
              <li className="flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-600" /> Free phone booth & quiet zone access</li>
            </ul>
          </div>
        </div>

        {/* Available Passes */}
        <div className="lg:col-span-8">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm min-h-[420px] flex flex-col justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span> 
                Available Day Passes
              </h2>

              {!selectedBranch ? (
                <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 text-gray-400 p-8 text-center">
                  <Tag size={48} className="mb-3 opacity-20 text-emerald-600" />
                  <h4 className="font-semibold text-gray-700 text-sm">Select Branch & Date</h4>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">Choose an office location and branch on the left to see Day Pass passes and live capacity.</p>
                </div>
              ) : loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="animate-spin text-emerald-600" size={40} />
                </div>
              ) : passes.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                  <p className="text-sm font-medium">No Day Passes configured for this branch.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {passes.map((dp) => {
                    const isSoldOut = dp.available_capacity <= 0;
                    const isSelected = selectedPass?.day_pass_id === dp.day_pass_id;
                    const occupancyPct = Math.min(100, Math.round((dp.booked_count / dp.total_capacity) * 100));

                    return (
                      <div
                        key={dp.day_pass_id}
                        onClick={() => {
                          if (!isSoldOut) setSelectedPass(dp);
                        }}
                        className={`
                          border-2 rounded-2xl p-6 cursor-pointer transition-all flex flex-col justify-between relative
                          ${isSoldOut ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed' :
                            isSelected ? 'border-emerald-500 bg-emerald-50/40 shadow-lg ring-2 ring-emerald-500/30' :
                            'border-gray-200 hover:border-emerald-400 hover:shadow-md bg-white'}
                        `}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                              {dp.status}
                            </span>
                            <span className="text-2xl font-black text-gray-900">₹{dp.price}</span>
                          </div>

                          <h3 className="font-bold text-gray-800 text-lg mt-1">{dp.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">Single user flexible hot desk pass for {date}.</p>
                        </div>

                        {/* Capacity meter */}
                        <div className="mt-6 pt-4 border-t border-gray-100">
                          <div className="flex justify-between text-xs font-semibold mb-1.5">
                            <span className="text-gray-500">Remaining Desks</span>
                            <span className={dp.available_capacity < 5 ? "text-red-500 font-bold" : "text-emerald-700 font-bold"}>
                              {dp.available_capacity} / {dp.total_capacity} Available
                            </span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all ${occupancyPct > 80 ? 'bg-red-500' : occupancyPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`} 
                              style={{ width: `${occupancyPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Action Bar */}
            {selectedPass && (
              <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4 shadow-sm">
                <div>
                  <h4 className="font-bold text-gray-800 text-sm">Selected: {selectedPass.name}</h4>
                  <p className="text-xs text-gray-500">Price: ₹{selectedPass.price} &bull; Date: {date} &bull; Remaining: {selectedPass.available_capacity} passes</p>
                </div>
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <span>Review & Book Pass</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Credit Confirmation Modal */}
      <AnimatePresence>
        {showConfirmModal && selectedPass && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 relative"
            >
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1"
              >
                <X size={20} />
              </button>

              <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2">
                <Tag size={18} className="text-emerald-600" /> Confirm Day Pass Booking
              </h3>
              <p className="text-xs text-gray-500 mb-5">Deduct prepaid credits to secure your hot desk pass.</p>

              {/* Breakdown */}
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-2.5 text-xs mb-5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Location:</span>
                  <span className="font-bold text-gray-800">{selectedLocObj?.name} &bull; {selectedBranchObj?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pass Type:</span>
                  <span className="font-bold text-gray-800">{selectedPass.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <span className="font-bold text-gray-800">{date} (Full Day)</span>
                </div>
                <div className="pt-2 border-t border-gray-200 flex justify-between font-bold text-sm text-gray-800">
                  <span>Day Pass Price:</span>
                  <span className="text-emerald-700">₹{passPrice.toFixed(2)}</span>
                </div>
              </div>

              {/* Wallet deduction */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 space-y-2 text-xs mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Wallet Balance:</span>
                  <span className="font-semibold text-gray-800">₹{walletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits Deducted:</span>
                  <span className="font-semibold text-red-600">-₹{passPrice.toFixed(2)}</span>
                </div>
                <div className="pt-2 border-t border-emerald-200/80 flex justify-between font-extrabold text-xs">
                  <span className="text-gray-700">Balance After Booking:</span>
                  <span className={hasSufficientCredits ? "text-emerald-700 font-bold" : "text-red-600 font-bold"}>
                    ₹{remainingBalance.toFixed(2)}
                  </span>
                </div>
              </div>

              {!hasSufficientCredits ? (
                <div className="space-y-3">
                  <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    <span>Insufficient credits. Please add ₹{Math.abs(remainingBalance).toFixed(2)} or more.</span>
                  </div>
                  <Link
                    to="/wallet"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow"
                  >
                    <Wallet size={16} /> Add Credits via Stripe
                  </Link>
                </div>
              ) : (
                <button
                  onClick={handleBookDayPass}
                  disabled={bookingLoading}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {bookingLoading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Confirming & Deducting Credits...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      <span>Confirm Day Pass Using Credits</span>
                    </>
                  )}
                </button>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DayPass;
