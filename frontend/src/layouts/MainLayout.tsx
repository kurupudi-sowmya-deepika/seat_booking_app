import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation as useRouteLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { useMsal } from '@azure/msal-react';
import {
  LogOut, LayoutDashboard, Calendar, Wallet, Tag, Video,
  ShieldCheck, UserCheck, Armchair, Clock, User,
  ChevronRight, ArrowRight, Sparkles, Shield, Menu, X, PlusCircle,
  MapPin, ChevronDown, Building2
} from 'lucide-react';
import api from '../services/api';
import ChatbotWidget from '../components/ChatbotWidget';
import NotificationCenter from '../components/NotificationCenter';

export const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { 
    selectedLocation, 
    selectedOffice, 
    setSelectedLocation, 
    setSelectedOffice,
    locations,
    offices,
    fetchOffices,
    setShowSelectionModal
  } = useAppLocation();
  const { instance } = useMsal();
  const navigate = useNavigate();
  const location = useRouteLocation();
  const [wallet, setWallet] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);

  useEffect(() => {
    api.get('/wallet/').then(res => setWallet(res.data)).catch(() => { });
  }, [location.pathname]);

  const selectedLocationObj = locations.find((l: any) => l.id === selectedLocation);
  const selectedOfficeObj = offices.find((o: any) => o.id === selectedOffice);

  const handleLogout = () => {
    logout();
    instance.logoutPopup().catch(e => console.error(e));
    navigate('/login');
  };

  const navSections = [
    {
      group: 'Overview & Activity',
      items: [
        { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { path: '/my-bookings', label: 'My Bookings', icon: <Calendar size={18} /> },
        { path: '/visitors', label: 'Visitors & Passes', icon: <UserCheck size={18} /> },
      ]
    },
    {
      group: 'Reserve Workspaces',
      items: [
        { path: '/booking', label: 'Book Desk / Seat', icon: <Armchair size={18} /> },
        { path: '/day-pass', label: 'Day Pass', icon: <Tag size={18} /> },
        { path: '/meeting-rooms', label: 'Meeting Rooms', icon: <Video size={18} /> },
        { path: '/conference-rooms', label: 'Conference Rooms', icon: <ShieldCheck size={18} /> },
      ]
    },
    {
      group: 'Billing & Account',
      items: [
        { path: '/wallet', label: 'Wallet & Transactions', icon: <Wallet size={18} /> },
        { path: '/profile', label: 'My Profile', icon: <User size={18} /> },
      ]
    }
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-50 font-['Segoe_UI',Arial,sans-serif] overflow-hidden">
      <div className="bosch-supergraphic shrink-0" aria-hidden="true" />
      <div className="flex min-h-0 flex-1">
        {/* Mobile Drawer Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar Navigation */}
        <aside
          className={`bg-[#0f172a] text-slate-300 transition-all duration-300 flex flex-col shrink-0 z-50 fixed lg:static inset-y-0 left-0 ${mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'
            } ${sidebarOpen ? 'lg:w-64' : 'lg:w-20'}`}
        >
          {/* Brand Header */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden">
                <img src="/favicon.png" alt="Seat Booking App" className="h-7 w-7 object-contain" />
              </div>
              {(sidebarOpen || mobileMenuOpen) && (
                <span className="font-extrabold text-sm tracking-wide text-white">Seat Booking App</span>
              )}
            </Link>

            <div className="flex items-center">
              {/* Desktop collapse button */}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-slate-400 hover:text-white p-1 rounded-md hidden lg:block"
                title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              >
                {sidebarOpen ? <ChevronRight size={18} className="transform rotate-180" /> : <ChevronRight size={18} />}
              </button>
              {/* Mobile close button */}
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-md lg:hidden"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Navigation Sections */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
            {navSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                {(sidebarOpen || mobileMenuOpen) && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                    {sec.group}
                  </p>
                )}
                {sec.items.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={item.label}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                        ? 'bg-[#007bc0] text-white shadow-md'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                    >
                      <div className="shrink-0">{item.icon}</div>
                      {(sidebarOpen || mobileMenuOpen) && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-800 space-y-2 shrink-0">
            {user?.role === 'ADMIN' && (
              <Link
                to="/admin"
                className="flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-purple-400 hover:text-white bg-purple-950/40 hover:bg-purple-900/50 border border-purple-800/40 rounded-xl transition-all"
                title="Admin Portal"
              >
                <Shield size={16} className="shrink-0 text-purple-400" />
                {(sidebarOpen || mobileMenuOpen) && <span>Admin Portal</span>}
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all text-left"
              title="Sign Out"
            >
              <LogOut size={16} className="shrink-0" />
              {(sidebarOpen || mobileMenuOpen) && <span>Sign Out</span>}
            </button>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 shrink-0 shadow-sm z-20">
            <div className="flex items-center gap-3">
              {/* Mobile menu trigger */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-1.5 text-gray-600 hover:text-gray-900 rounded-lg lg:hidden"
              >
                <Menu size={20} />
              </button>
              
              {/* Location/Office Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowLocationDropdown(!showLocationDropdown)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-[#007bc0] border border-blue-200 rounded-xl transition-all"
                >
                  <MapPin size={16} />
                  <div className="hidden sm:block text-left leading-tight">
                    <span className="block text-[13px] font-bold">
                      {selectedLocationObj?.city || selectedLocationObj?.name || 'Select location'}
                    </span>
                    <span className="block text-[12px] text-[#005691]">
                      {selectedOfficeObj?.name || 'Select office'}
                    </span>
                  </div>
                  <ChevronDown size={14} className={`transition-transform ${showLocationDropdown ? 'rotate-180' : ''}`} />
                </button>

                {/* Location Dropdown */}
                {showLocationDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    <div className="p-3 border-b border-gray-100">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Location</label>
                      <select
                        value={selectedLocation || ''}
                        onChange={(e) => {
                          setSelectedLocation(e.target.value);
                          if (e.target.value) fetchOffices(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0]"
                      >
                        <option value="">Select Location</option>
                        {locations.map((loc: any) => (
                          <option key={loc.id} value={loc.id}>{loc.name} ({loc.city})</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">Office</label>
                      <select
                        value={selectedOffice || ''}
                        onChange={(e) => setSelectedOffice(e.target.value)}
                        disabled={!selectedLocation}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold outline-none focus:ring-2 focus:ring-[#007bc0]/30 focus:border-[#007bc0] disabled:opacity-50"
                      >
                        <option value="">Select Office</option>
                        {selectedLocation && offices.filter((o: any) => o.location_id === selectedLocation).map((office: any) => (
                          <option key={office.id} value={office.id}>{office.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="p-3 border-t border-gray-100 bg-gray-50">
                      <button
                        onClick={() => setShowSelectionModal(true)}
                        className="w-full py-2 text-xs font-bold text-[#007bc0] hover:bg-blue-100 rounded-lg transition"
                      >
                        Open Full Selection
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <span className="px-2.5 py-1 bg-blue-50 text-[#007bc0] border border-blue-200 font-extrabold text-[11px] rounded-full uppercase tracking-wider">
                Member Workspace
              </span>
              <span className="text-xs text-gray-500 hidden sm:inline"></span>
            </div>

            <div className="flex items-center gap-3 sm:gap-4">
              {/* Notification Center */}
              <NotificationCenter />



              {/* User Profile Tag */}
              <Link to="/profile" className="flex items-center gap-2 hover:opacity-80 transition-all">
                <div className="w-8 h-8 rounded-full bg-[#007bc0] text-white flex items-center justify-center text-xs font-bold shadow">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="hidden md:block text-left">
                  <span className="text-xs font-bold text-gray-800 block leading-tight">{user?.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">{user?.role || 'Member'}</span>
                </div>
              </Link>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
              <img src="/bosch-logo.png" alt="Bosch" className="hidden h-7 w-auto object-contain sm:block" />
            </div>
          </header>

          {/* Scrollable Main Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-gray-50/70">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Floating AI Booking & Intelligence Chatbot */}
        <ChatbotWidget variant="user" />
      </div>
    </div>
  );
};

export default MainLayout;
