import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/msalConfig';
import { AuthProvider, useAuth } from './context/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// User Pages
import Dashboard from './pages/Dashboard';
import Booking from './pages/Booking';
import BookingSuccess from './pages/BookingSuccess';
import MyBookings from './pages/MyBookings';
import Wallet from './pages/Wallet';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminBooking from './pages/admin/AdminBooking';
import AdminBilling from './pages/admin/AdminBilling';
import AdminSettings from './pages/admin/AdminSettings';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="flex-center min-h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" />;
  
  return children;
};

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* User Routes */}
            <Route path="/" element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="booking" element={<Booking />} />
              <Route path="booking/success" element={<BookingSuccess />} />
              <Route path="my-bookings" element={<MyBookings />} />
              <Route path="wallet" element={<Wallet />} />
            </Route>

            {/* Admin Routes */}
            <Route path="/admin" element={
              <ProtectedRoute adminOnly={true}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<AdminDashboard />} />
              <Route path="booking" element={<AdminBooking />} />
              <Route path="billing" element={<AdminBilling />} />
              <Route path="settings" element={<AdminSettings />} />
            </Route>
            
          </Routes>
        </Router>
      </AuthProvider>
    </MsalProvider>
  );
}

export default App;
