import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import {
  LogOut, LayoutDashboard, Users, MapPin,
  Building2, DoorOpen, Sparkles, Armchair, Tag, Video,
  ShieldCheck, Clock, Settings, ArrowLeft, ChevronRight, Menu, X, BarChart3,
  LayoutGrid
} from 'lucide-react';
import ChatbotWidget from '../components/ChatbotWidget';

export const AdminLayout: React.FC = () => {
  const { user, logout, profilePhoto } = useAuth();
  const { instance } = useMsal();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    instance.logoutPopup().catch(e => console.error(e));
    navigate('/login');
  };

  const navSections = [
    {
      group: 'Overview',
      items: [
        { path: '/admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { path: '/admin/reports', label: 'Reports & Revenue', icon: <BarChart3 size={18} /> },
        { path: '/admin/users', label: 'User Management', icon: <Users size={18} /> },
      ]
    },
    {
      group: 'Workspace Hierarchy',
      items: [
        { path: '/admin/locations', label: 'Locations & Branches', icon: <MapPin size={18} /> },
        { path: '/admin/rooms', label: 'Rooms & Zones', icon: <DoorOpen size={18} /> },
        { path: '/admin/day-passes', label: 'Day Passes', icon: <Tag size={18} /> },
        { path: '/admin/floor-plans', label: 'Floor Plan Management', icon: <LayoutGrid size={18} /> },
      ]
    },
    {
      group: 'Resources & Products',
      items: [
        { path: '/admin/facilities', label: 'Facilities & Amenities', icon: <Sparkles size={18} /> },
        { path: '/admin/time-slots', label: 'Time Slots', icon: <Clock size={18} /> },
        { path: '/admin/settings', label: 'System Settings', icon: <Settings size={18} /> },
      ]
    }
  ];

  return (
    <div className="flex h-screen flex-col bg-gray-50 overflow-hidden">
      <div className="flex min-h-0 flex-1">
        {/* Sidebar */}
        <aside
          className={`bg-[#0f172a] text-slate-300 transition-all duration-300 flex flex-col shrink-0 z-30 ${sidebarOpen ? 'w-64' : 'w-20'
            }`}
        >
          {/* Brand */}
          <div className="h-16 flex items-center justify-between px-5 border-b border-slate-800 shrink-0">
            {sidebarOpen ? (
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden">
                  <img src="/favicon.png" alt="SpaceHub App" className="h-7 w-7 object-contain" />
                </div>
                <span className="font-extrabold text-sm tracking-wide text-white">SpaceHub App</span>
              </Link>
            ) : (
              <Link to="/" className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm overflow-hidden mx-auto">
                <img src="/favicon.png" alt="SpaceHub App" className="h-7 w-7 object-contain" />
              </Link>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-slate-400 hover:text-white p-1 rounded-md hidden md:block"
            >
              {sidebarOpen ? <ChevronRight size={18} className="transform rotate-180" /> : <ChevronRight size={18} />}
            </button>
          </div>

          {/* Nav list */}
          <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
            {navSections.map((sec, idx) => (
              <div key={idx} className="space-y-1">
                {sidebarOpen && (
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
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${isActive
                        ? 'bg-[#007bc0] text-white shadow-md'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                        }`}
                    >
                      <div className="shrink-0">{item.icon}</div>
                      {sidebarOpen && <span className="truncate">{item.label}</span>}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-slate-800 space-y-2 shrink-0">
            <Link
              to="/"
              className="flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
              title="Exit to User Portal"
            >
              <ArrowLeft size={16} />
              {sidebarOpen && <span>Exit to User Portal</span>}
            </Link>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Top Header */}
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 bg-purple-100 text-purple-800 font-extrabold text-[11px] rounded-full uppercase tracking-wider">
                Admin Portal
              </span>
              <span className="text-xs text-gray-500 hidden sm:inline">Enterprise Workspace Governance</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                {profilePhoto ? (
                  <img
                    src={profilePhoto}
                    alt={user?.name || 'Admin'}
                    className="w-8 h-8 rounded-full object-cover border border-purple-300 shadow"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-xs font-bold shadow">
                    {user?.name?.charAt(0) || 'A'}
                  </div>
                )}
                <div className="hidden md:block text-left">
                  <span className="text-xs font-bold text-gray-800 block leading-tight">{user?.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase font-semibold">Administrator</span>
                </div>
              </div>

              <button
                onClick={handleLogout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          </header>

          {/* Admin Pages Scrollable View */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8 bg-gray-50/70">
            <div className="max-w-7xl mx-auto">
              <Outlet />
            </div>
          </main>
        </div>

        <ChatbotWidget variant="admin" />
      </div>
    </div>
  );
};

export default AdminLayout;
