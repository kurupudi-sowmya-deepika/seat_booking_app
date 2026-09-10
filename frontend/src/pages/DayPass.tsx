import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Tag, MapPin, Building2, Calendar as CalIcon, Loader2, 
  CheckCircle2, ArrowRight, ShieldCheck, ChevronRight,
  AlertCircle, X, Wallet, Users, Search, 
  UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AutoLocationDetector from '../components/AutoLocationDetector';
import { useAuth } from '../context/AuthContext';
import { useLocation } from '../context/LocationContext';
import AmenityBadge from '../components/AmenityBadge';
import PriceSummary from '../components/PriceSummary';

interface AdditionalUser {
  name: string;
  email: string;
}

export const DayPass: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedLocation, selectedOffice, fetchLocations } = useLocation();
  const [locations, setLocations] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedLoc, setSelectedLoc] = useState(selectedLocation || '');
  const [selectedBranch, setSelectedBranch] = useState(selectedOffice || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [passes, setPasses] = useState<any[]>([]);
  const [selectedPass, setSelectedPass] = useState<any | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [error, setError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  
  // New state for quantity and additional users
  const [quantity, setQuantity] = useState(1);
  const [additionalUsers, setAdditionalUsers] = useState<AdditionalUser[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);

  useEffect(() => {
    fetchLocations();
    api.get('/locations/').then(res => setLocations(res.data)).catch(() => {});
    api.get('/wallet/').then(res => setWallet(res.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedLocation) setSelectedLoc(selectedLocation);
    if (selectedOffice) setSelectedBranch(selectedOffice);
  }, [selectedLocation, selectedOffice]);

  const handleLocationAutoDetected = (locId: string, branchId?: string) => {
    setSelectedLoc(locId);
    if (branchId) {
      setTimeout(() => setSelectedBranch(branchId), 200);
    }
  };

  useEffect(() => {
    if (selectedLoc) {
      api.get('/branches/', { params: { location_id: selectedLoc } }).then(res => {
        setBranches(res.data.filter((b: any) => b.location_id === selectedLoc));
      }).catch(() => {});
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

  // Search users for autocomplete
  useEffect(() => {
    const searchUsers = async () => {
      if (userSearchQuery.length >= 2) {
        setUserSearchLoading(true);
        try {
          const res = await api.get('/users/search', { params: { search: userSearchQuery } });
          setUserSearchResults(res.data);
        } catch (err) {
          console.error('Failed to search users', err);
        } finally {
          setUserSearchLoading(false);
        }
      } else {
        setUserSearchResults([]);
      }
    };
    
    const debounceTimer = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounceTimer);
  }, [userSearchQuery]);

  const handleAddUser = (user: any) => {
    if (additionalUsers.length >= quantity - 1) {
      setError(`Maximum ${quantity - 1} additional users allowed`);
      return;
    }
    
    if (additionalUsers.some(u => u.email === user.email)) {
      setError('User already added');
      return;
    }
    
    setAdditionalUsers([...additionalUsers, { name: user.name, email: user.email }]);
    setUserSearchQuery('');
    setUserSearchResults([]);
  };

  const handleRemoveUser = (email: string) => {
    setAdditionalUsers(additionalUsers.filter(u => u.email !== email));
  };

  const handleBookDayPass = async () => {
    if (!selectedPass || !selectedLoc || !selectedBranch) return;
    if (quantity > 1 && additionalUsers.length !== quantity - 1) {
      setError(`Add ${quantity - 1} additional user${quantity > 2 ? 's' : ''} before confirming.`);
      setShowConfirmModal(false);
      return;
    }
    setBookingLoading(true);
    setError('');

    try {
      const res = await api.post('/bookings/', {
        booking_type: 'DAY_PASS',
        location_id: selectedLoc,
        branch_id: selectedBranch,
        day_pass_id: selectedPass.day_pass_id,
        booking_date: date,
        number_of_people: quantity,
        additional_users: additionalUsers
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
  const totalPrice = passPrice * quantity;
  const remainingBalance = walletBalance - totalPrice;
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

          {/* Quantity Selection */}
          <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
            <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">2</span> 
              Number of People
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 flex items-center gap-1.5"><Users size={14}/> Select Quantity</label>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 3, 4].map((qty) => (
                    <button
                      key={qty}
                      onClick={() => {
                        setQuantity(qty);
                        setAdditionalUsers([]);
                      }}
                      className={`py-3 rounded-xl text-sm font-bold border transition ${
                        quantity === qty 
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' 
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      {qty}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">Price per person</span>
                  <span className="text-sm font-bold text-gray-800">₹{selectedPass ? selectedPass.price : '0'}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-gray-600">Number of people</span>
                  <span className="text-sm font-bold text-gray-800">{quantity}</span>
                </div>
                <div className="pt-2 border-t border-emerald-200 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-700">Total Price</span>
                  <span className="text-lg font-black text-emerald-700">₹{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Users Section */}
          {quantity > 1 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-base font-bold text-gray-800 mb-5 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs">3</span> 
                Add Additional Users
              </h2>

              <div className="space-y-4">
                {/* Search and Add Users */}
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search employees by name or email..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition"
                  />
                  
                  {/* Search Results Dropdown */}
                  {userSearchResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-10 max-h-48 overflow-y-auto">
                      {userSearchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleAddUser(user)}
                          className="w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3 border-b border-gray-100 last:border-0"
                        >
                          <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                            {user.name.charAt(0)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-gray-800">{user.name}</p>
                            <p className="text-[10px] text-gray-500">{user.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Users */}
                <div className="space-y-2">
                  {/* Primary Booker */}
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-blue-200 text-blue-700 flex items-center justify-center text-xs font-bold">
                      {user?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-bold text-gray-800">{user?.name || 'You'}</p>
                      <p className="text-[10px] text-gray-500">{user?.email || 'Primary booker'}</p>
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">Primary</span>
                  </div>

                  {/* Additional Users */}
                  {additionalUsers.map((user, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        {user.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-gray-800">{user.name}</p>
                        <p className="text-[10px] text-gray-500">{user.email}</p>
                      </div>
                      <button
                        onClick={() => handleRemoveUser(user.email)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Remove user"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Add More Button */}
                  {additionalUsers.length < quantity - 1 && (
                    <button
                      onClick={() => setUserSearchQuery('')}
                      className="w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-xs font-bold text-gray-500 hover:border-emerald-500 hover:text-emerald-600 transition flex items-center justify-center gap-2"
                    >
                      <UserPlus size={14} />
                      Add {quantity - 1 - additionalUsers.length} more user{quantity - 1 - additionalUsers.length > 1 ? 's' : ''}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Perks card */}
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-6 shadow-sm">
            <h3 className="text-sm font-bold text-emerald-900 mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-600" /> Day Pass Amenities
            </h3>
            <div className="flex flex-wrap gap-2">
              {(selectedPass?.amenities?.length ? selectedPass.amenities : ['Wi-Fi', 'Parking', 'Cafeteria', 'Power Outlet', 'Lounge Access', 'Printing', 'Coffee/Tea']).map((amenity: string) => (
                <AmenityBadge key={amenity} name={amenity} />
              ))}
            </div>
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
                  <p className="text-xs text-gray-500">Price: ₹{selectedPass.price}/person &bull; {quantity} people &bull; Date: {date} &bull; Remaining: {selectedPass.available_capacity} passes</p>
                </div>
                <button
                  onClick={() => {
                    if (quantity > 1 && additionalUsers.length !== quantity - 1) {
                      setError(`Add ${quantity - 1} additional user${quantity > 2 ? 's' : ''} before booking.`);
                      return;
                    }
                    setShowConfirmModal(true);
                  }}
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
              <p className="text-xs text-gray-500 mb-5">Deduct prepaid credits to secure your hot desk pass for {quantity} person{quantity > 1 ? 's' : ''}.</p>

              <PriceSummary pricePerPerson={selectedPass.price} numberOfPeople={quantity} total={totalPrice} />

              {(selectedPass.amenities || []).length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-bold text-gray-600 mb-2">Amenities included</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPass.amenities.map((amenity: string) => <AmenityBadge key={amenity} name={amenity} />)}
                  </div>
                </div>
              )}

              {/* Wallet deduction */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4 space-y-2 text-xs mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Current Wallet Balance:</span>
                  <span className="font-semibold text-gray-800">₹{walletBalance.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits Deducted:</span>
                  <span className="font-semibold text-red-600">-₹{totalPrice.toFixed(2)}</span>
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
