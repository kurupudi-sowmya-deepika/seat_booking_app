import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { 
  User as UserIcon, Shield, Mail, Calendar, Key, 
  ChevronRight, CheckCircle2, Wallet, Building2, Lock,
  MapPin, Globe, CreditCard
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, profilePhoto } = useAuth();
  const [wallet, setWallet] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    api.get('/wallet/').then(res => setWallet(res.data)).catch(() => {});
    api.get('/locations/').then(res => setLocations(res.data || [])).catch(() => {});
    api.get('/bookings/my').then(res => setBookings(res.data || [])).catch(() => {});
  }, []);

  const displayPhoto = profilePhoto || user?.profile_photo;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">User Profile & Account Security</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-4 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm flex flex-col items-center text-center">
          {displayPhoto ? (
            <img 
              src={displayPhoto} 
              alt={user?.name || 'User'} 
              className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-[#007bc0]/30 mb-4"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#005a8c] to-[#007bc0] text-white flex items-center justify-center text-3xl font-extrabold shadow-lg mb-4">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <h2 className="text-lg font-bold text-gray-900">{user?.name}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{user?.email}</p>

          <div className="flex gap-2 mt-4">
            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${user?.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
              Role: {user?.role || 'USER'}
            </span>
            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">
              {user?.status || 'ACTIVE'}
            </span>
          </div>

          <div className="w-full mt-6 pt-6 border-t border-gray-100 space-y-3 text-xs text-left">
            <div className="flex justify-between">
              <span className="text-gray-500">Auth Provider:</span>
              <span className="font-bold text-gray-800">{user?.auth_provider || 'MICROSOFT ENTRA'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prepaid Wallet:</span>
              <span className="font-bold text-emerald-700">₹{(wallet?.balance ?? 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Total Bookings:</span>
              <span className="font-bold text-gray-800">{bookings.length} reservations</span>
            </div>
          </div>
        </div>

        {/* Account Details & Security */}
        <div className="lg:col-span-8 bg-white border border-gray-200 rounded-3xl p-6 shadow-sm space-y-6">
          <div>
            <h3 className="text-sm font-bold text-gray-800 mb-1 flex items-center gap-2">
              <Shield size={16} className="text-[#007bc0]" /> Enterprise Single Sign-On & Security
            </h3>
            <p className="text-xs text-gray-500">Your account is secured with Microsoft Entra ID SSO & JWT corporate credentials.</p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-200 space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail size={18} className="text-gray-400" />
                <div>
                  <h4 className="font-semibold text-gray-800">Verified Corporate Email</h4>
                  <p className="text-gray-500 text-[11px]">{user?.email}</p>
                </div>
              </div>
              <span className="text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 size={14} /> Verified
              </span>
            </div>

            <div className="pt-3 border-t border-gray-200/80 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock size={18} className="text-gray-400" />
                <div>
                  <h4 className="font-semibold text-gray-800">Microsoft Entra ID Link</h4>
                  <p className="text-gray-500 text-[11px]">Active enterprise identity synchronization</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-[#007bc0]">
                {user?.auth_provider === 'ENTRA' || user?.auth_provider === 'BOTH' ? 'Linked (Microsoft SSO)' : 'Linked'}
              </span>
            </div>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 rounded-2xl p-5 text-xs text-blue-900 space-y-3">
            <h4 className="font-bold flex items-center gap-1.5 text-sm">
              <Building2 size={16} className="text-[#007bc0]" /> Workspace Access Permissions
            </h4>
            <p className="text-blue-800 text-xs">
              You have booking access to all configured corporate hubs including focus desks, day passes, smart meeting rooms, and conference halls:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
              {locations.map((loc) => (
                <div key={loc.id} className="bg-white/80 border border-blue-200/60 rounded-xl p-2.5 flex items-center gap-2">
                  <MapPin size={14} className="text-[#007bc0] shrink-0" />
                  <div>
                    <p className="font-bold text-gray-800 text-[11px]">{loc.name || loc.city}</p>
                    <p className="text-[10px] text-gray-500">{loc.country || loc.state || 'Hub'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;

