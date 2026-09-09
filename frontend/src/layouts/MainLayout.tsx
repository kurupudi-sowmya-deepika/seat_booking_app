import React, { useState } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import { LogOut, Home, Calendar, Wallet, Settings, ChevronRight } from 'lucide-react';
import ChatbotWidget from '../components/ChatbotWidget';

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { instance } = useMsal();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    instance.logoutPopup().catch(e => console.error(e));
    navigate('/login');
  };

  const navLinks = [
    { path: '/', label: 'Home', icon: <Home size={20} /> },
    { path: '/booking', label: 'Book Meeting', icon: <Calendar size={20} /> },
    { path: '/my-bookings', label: 'My Bookings', icon: <Calendar size={20} /> },
    { path: '/wallet', label: 'Billing', icon: <Wallet size={20} /> },
  ];

  if (user?.role === 'ADMIN') {
    navLinks.push({ path: '/admin', label: 'Admin Panel', icon: <Settings size={20} /> });
  }

  return (
    <div className="flex h-screen bg-white font-['Inter'] overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`bg-[#005691] text-white transition-all duration-300 flex flex-col ${
          sidebarOpen ? 'w-64' : 'w-16'
        }`}
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
      >
        <div className="h-16 flex items-center justify-center border-b border-white/10">
          {sidebarOpen ? (
            <span className="font-bold text-lg tracking-wider">MENU</span>
          ) : (
            <ChevronRight size={24} />
          )}
        </div>
        
        <nav className="flex-1 py-4 flex flex-col gap-2">
          {navLinks.map((link) => {
            const isActive = location.pathname === link.path || (link.path !== '/' && location.pathname.startsWith(link.path));
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center px-4 py-3 transition-colors ${
                  isActive ? 'bg-white/20 border-l-4 border-white' : 'hover:bg-white/10 border-l-4 border-transparent'
                }`}
                title={link.label}
              >
                <div className="min-w-[24px] flex justify-center">{link.icon}</div>
                <span className={`ml-4 whitespace-nowrap transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0 hidden'}`}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center">
            <h1 className="text-[#007bc0] text-xl font-medium tracking-wide">
              Seat Booking Management
            </h1>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Avatar Placeholder */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#007bc0] text-white flex items-center justify-center text-sm font-bold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <span className="text-sm font-medium text-gray-700 hidden md:block">
                {user?.name}
              </span>
            </div>
            
            <button onClick={handleLogout} className="text-gray-500 hover:text-[var(--danger-color)] transition-colors">
              <LogOut size={20} />
            </button>

            {/* Bosch Logo */}
            <div className="h-8 pl-6 border-l border-gray-300 flex items-center">
              <img src="/bosch-logo.png" alt="Bosch Logo" className="h-8 object-contain" />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto bg-white p-6 relative">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>

      <ChatbotWidget />
    </div>
  );
};

export default MainLayout;
