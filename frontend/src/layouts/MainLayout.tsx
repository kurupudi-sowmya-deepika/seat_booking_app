import React from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import { LogOut } from 'lucide-react';
import ChatbotWidget from '../components/ChatbotWidget';

const MainLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const { instance } = useMsal();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    instance.logoutPopup().catch(e => console.error(e));
    navigate('/login');
  };

  const navLinks = [
    { path: '/', label: 'Home' },
    { path: '/booking', label: 'Book Meeting' },
    { path: '/my-bookings', label: 'My Bookings' },
    { path: '/wallet', label: 'Billing' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-color)]">
      <div className="bosch-supergraphic"></div>
      <header className="bosch-header sticky top-0 z-50 mb-6">
        <div className="container py-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-3">
              <img src="/bosch-logo.png" alt="Bosch Logo" className="h-8 object-contain" />
              <div className="h-8 w-px bg-gray-300"></div>
              <span className="font-semibold text-xl text-[#212224]">Seat Booking Management</span>
            </Link>

            <nav className="hidden md:flex gap-2 items-center">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`bosch-nav-link ${location.pathname === link.path ? 'active' : ''}`}
                >
                  {link.label}
                </Link>
              ))}
              {user?.role === 'ADMIN' && (
                <Link to="/admin" className="bosch-nav-link text-[var(--danger-color)]">Admin Panel</Link>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-[var(--text-secondary)] hidden md:inline">
              Welcome, {user?.name}
            </span>
            <button onClick={handleLogout} className="btn btn-secondary text-sm flex items-center gap-2 py-1.5 px-3">
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      </header>

      <main className="container flex-grow animate-fade-in pb-12">
        <Outlet />
      </main>
      <ChatbotWidget />
    </div>
  );
};

export default MainLayout;
