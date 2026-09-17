import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MsalProvider } from '@azure/msal-react';
import { msalInstance } from './auth/msalConfig';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LocationProvider } from './context/LocationContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import AdminLayout from './layouts/AdminLayout';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// User Pages
import Dashboard from './pages/Dashboard';
import Booking from './pages/Booking';
import DayPass from './pages/DayPass';
import MeetingRooms from './pages/MeetingRooms';
import ConferenceRooms from './pages/ConferenceRooms';
import Visitors from './pages/Visitors';
import BookingSuccess from './pages/BookingSuccess';
import MyBookings from './pages/MyBookings';
import Wallet from './pages/Wallet';
import Transactions from './pages/Transactions';
import Profile from './pages/Profile';

// Admin Pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminReports from './pages/admin/AdminReports';
import AdminUsers from './pages/admin/AdminUsers';
import AdminLocations from './pages/admin/AdminLocations';
import AdminBranches from './pages/admin/AdminBranches';
import AdminRooms from './pages/admin/AdminRooms';
import AdminFacilities from './pages/admin/AdminFacilities';
import AdminSeats from './pages/admin/AdminSeats';
import AdminFloorPlans from './pages/admin/AdminFloorPlans';
import FloorPlanEditor from './pages/admin/FloorPlanEditor';
import AdminDayPasses from './pages/admin/AdminDayPasses';
import AdminMeetingRooms from './pages/admin/AdminMeetingRooms';
import AdminConferenceRooms from './pages/admin/AdminConferenceRooms';
import AdminTimeSlots from './pages/admin/AdminTimeSlots';
import AdminSettings from './pages/admin/AdminSettings';

// Components
import LocationSelectionModal from './components/LocationSelectionModal';

const ProtectedRoute = ({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-[#007bc0] border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-bold text-gray-500">Authenticating Session...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'ADMIN') return <Navigate to="/" replace />;
  
  return <>{children}</>;
};

function App() {
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProvider>
        <LocationProvider>
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
                <Route path="day-pass" element={<DayPass />} />
                <Route path="meeting-rooms" element={<MeetingRooms />} />
                <Route path="conference-rooms" element={<ConferenceRooms />} />
                <Route path="visitors" element={<Visitors />} />
                <Route path="booking/success" element={<BookingSuccess />} />
                <Route path="my-bookings" element={<MyBookings />} />
                <Route path="wallet" element={<Wallet />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="profile" element={<Profile />} />
              </Route>

              {/* Admin Routes */}
              <Route path="/admin" element={
                <ProtectedRoute adminOnly={true}>
                  <AdminLayout />
                </ProtectedRoute>
              }>
                <Route index element={<AdminDashboard />} />
                <Route path="reports" element={<AdminReports />} />
                <Route path="users" element={<AdminUsers />} />
                <Route path="locations" element={<AdminLocations />} />
                <Route path="branches" element={<Navigate to="/admin/locations?tab=branches" replace />} />
                <Route path="rooms" element={<AdminRooms />} />
                <Route path="facilities" element={<AdminFacilities />} />
                <Route path="seats" element={<AdminSeats />} />
                <Route path="floor-plans" element={<AdminFloorPlans />} />
                <Route path="floor-plans/:floorId" element={<FloorPlanEditor />} />
                <Route path="day-passes" element={<AdminDayPasses />} />
                <Route path="meeting-rooms" element={<Navigate to="/admin/rooms?tab=MEETING_ROOM" replace />} />
                <Route path="conference-rooms" element={<Navigate to="/admin/rooms?tab=CONFERENCE_ROOM" replace />} />
                <Route path="time-slots" element={<AdminTimeSlots />} />
                <Route path="settings" element={<AdminSettings />} />
              </Route>
              
              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <LocationSelectionModal />
          </Router>
        </LocationProvider>
      </AuthProvider>
    </MsalProvider>
  );
}

export default App;
