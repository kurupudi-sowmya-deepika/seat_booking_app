import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Users, Building2, MapPin, Calendar, Clock, ChevronRight,
  Wallet as WalletIcon, ArrowUpRight, PlusCircle, CheckCircle2,
  XCircle, Sparkles, Compass, ShieldCheck, Tag, Video,
  Printer, Navigation, ArrowRight, Layers, Armchair,
  UserCheck, Download, Plus, Bot, Zap, Coffee, Wifi, Monitor
} from 'lucide-react';
import { motion } from 'framer-motion';


export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wallet, setWallet] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [visitors, setVisitors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wRes, bRes, brRes, locRes, vRes] = await Promise.all([
          api.get('/wallet/').catch(() => ({ data: { balance: 0.0 } })),
          api.get('/bookings/my').catch(() => ({ data: [] })),
          api.get('/branches/').catch(() => ({ data: [] })),
          api.get('/locations/').catch(() => ({ data: [] })),
          api.get('/visitors/').catch(() => ({ data: [] }))
        ]);
        setWallet(wRes.data);
        setBookings(bRes.data || []);
        setBranches(brRes.data || []);
        setLocations(locRes.data || []);
        setVisitors(vRes.data || []);
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalBookings = bookings.length;
  const upcomingBookings = bookings.filter(b => b.status === 'CONFIRMED' && new Date(b.booking_date) >= new Date(new Date().setHours(0, 0, 0, 0)));
  const completedBookings = bookings.filter(b => b.status === 'CONFIRMED' && new Date(b.booking_date) < new Date(new Date().setHours(0, 0, 0, 0)));
  const activeBooking = upcomingBookings[0] || null;

  const handleLocationDetected = (loc: any) => {
    setSelectedLocation(loc);
  };


  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } }
  };

  const item = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full flex flex-col font-['Inter'] space-y-6 animate-fade-in pb-12">


      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#003e66] via-[#005a8c] to-[#007bc0] p-6 sm:p-8 text-white shadow-lg">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 skew-x-12 pointer-events-none transform translate-x-8"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <Sparkles size={14} className="text-amber-300" />
              <span>Seat Booking App</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Hello, {user?.name || 'Workspace Member'} 👋
            </h1>
            <p className="text-blue-100 text-xs sm:text-sm max-w-xl">
              Book agile workstations, conference halls, and day passes with real-time wallet settlement across all corporate hubs.
            </p>
          </div>


        </div>
      </div>

      {/* 4 Interactive KPI Metric Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {/* 1. Wallet Balance */}
        <motion.div variants={item} className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Corporate Wallet</span>
              <h3 className="text-2xl font-black text-gray-900 mt-1">₹{(wallet?.balance ?? 0).toFixed(2)}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#007bc0] flex items-center justify-center group-hover:scale-105 transition-transform">
              <WalletIcon size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Ready
            </span>
            <Link to="/wallet" className="text-xs font-black text-[#007bc0] hover:underline flex items-center gap-0.5">
              + Add Credits
            </Link>
          </div>
        </motion.div>

        {/* 2. Upcoming Reservations */}
        <motion.div variants={item} className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Upcoming Bookings</span>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{upcomingBookings.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Calendar size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500">{completedBookings.length} past completed</span>
            <Link to="/my-bookings" className="text-xs font-black text-[#007bc0] hover:underline flex items-center gap-0.5">
              View All →
            </Link>
          </div>
        </motion.div>
        {/* 3. Campuses & Branches */}
        <motion.div variants={item} className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Regional Hubs</span>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{branches.length || 3}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Building2 size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full">
              {locations.length || 3} Cities
            </span>
            <Link to="/booking" className="text-xs font-black text-[#007bc0] hover:underline flex items-center gap-0.5">
              Explore →
            </Link>
          </div>
        </motion.div>
        {/* 4. Pre-registered Visitors */}
        <motion.div variants={item} className="bg-white p-5 rounded-3xl border border-gray-200/80 shadow-sm flex flex-col justify-between hover:shadow-md transition group">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Guest Passes</span>
              <h3 className="text-2xl font-black text-gray-900 mt-1">{visitors.length}</h3>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserCheck size={20} />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[11px] font-bold text-gray-500">Reception Check-in</span>
            <Link to="/visitors" className="text-xs font-black text-[#007bc0] hover:underline flex items-center gap-0.5">
              Manage →
            </Link>
          </div>
        </motion.div>

      </motion.div>

      {/* My Bookings Preview */}


      {/* Main 2-Column Content: Upcoming Session / Booking Options + Hubs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Active Session / Booking Showcase */}
        <div className="lg:col-span-2 space-y-6">
          {/* Active Booking Ticket Highlight */}
          {activeBooking ? (
            <div className="bg-gradient-to-br from-[#0f2744] to-[#005a8c] rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/15 pb-4 mb-4">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-full text-[10px] font-black uppercase tracking-wider">
                    Next Active Session
                  </span>
                  <span className="text-xs text-blue-200 font-mono">ID: #{activeBooking.id.slice(0, 8)}</span>
                </div>
                <Link
                  to="/my-bookings"
                  className="text-xs font-bold text-blue-200 hover:text-white flex items-center gap-1"
                >
                  Manage All Bookings <ArrowRight size={14} />
                </Link>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-200 block">Workspace</span>
                  <h4 className="text-lg font-black text-white mt-0.5">
                    {activeBooking.seat_number ? `Desk ${activeBooking.seat_number}` : activeBooking.room_name || activeBooking.booking_type}
                  </h4>
                  <p className="text-xs text-blue-100">{activeBooking.branch_name || 'Main Campus'}</p>
                </div>

                <div>
                  <span className="text-[10px] uppercase font-bold text-blue-200 block">Schedule</span>
                  <h4 className="text-xs font-bold text-white mt-0.5 flex items-center gap-1.5">
                    <Calendar size={14} className="text-blue-300" />
                    {activeBooking.booking_date}
                  </h4>
                  <p className="text-xs text-blue-100 mt-0.5">
                    {activeBooking.start_time ? `${activeBooking.start_time.slice(0, 5)} - ${activeBooking.end_time?.slice(0, 5)}` : 'Full Day Access'}
                  </p>
                </div>

                <div className="flex sm:flex-col justify-between sm:justify-end items-end">
                  <span className="text-[11px] text-blue-200">Amount Charged</span>
                  <span className="text-2xl font-black text-white">₹{activeBooking.amount}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-100 rounded-3xl p-6 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-[#007bc0] text-white flex items-center justify-center shrink-0 shadow">
                  <Calendar size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">No active reservations for today</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Ready to collaborate or need a focused quiet desk? Book instantly with 1-click.
                  </p>
                </div>
              </div>
              <Link
                to="/booking"
                className="px-5 py-2.5 bg-[#007bc0] hover:bg-[#005a8c] text-white text-xs font-black rounded-xl shadow transition whitespace-nowrap"
              >
                Book Workspace
              </Link>
            </div>
          )}

          {/* Workspace Options & Products (4 Cards) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#007bc0]"></span>
                Workspace Products & Services
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Individual Desks */}
              <Link
                to="/booking"
                className="group bg-white rounded-3xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md hover:border-[#007bc0]/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#007bc0] flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Armchair size={20} />
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-sm">Individual Desks</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Interactive seat map, ergonomic chairs, dual monitors, and quiet focus pods.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-[#007bc0]">
                  <span>From ₹150/slot</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Full Day Flex Pass */}
              <Link
                to="/day-pass"
                className="group bg-white rounded-3xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md hover:border-emerald-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Tag size={20} />
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-sm">Full Day Flex Pass</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    All-day campus access, pantry amenities, power backup, and lounge access.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-emerald-600">
                  <span>From ₹350/day</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Meeting Rooms */}
              <Link
                to="/meeting-rooms"
                className="group bg-white rounded-3xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md hover:border-purple-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Video size={20} />
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-sm">Smart Meeting Rooms</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Professional spaces with 4K smart screens, Teams/Zoom video, and whiteboards.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-purple-600">
                  <span>From ₹400/hr</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>

              {/* Conference Rooms */}
              <Link
                to="/conference-rooms"
                className="group bg-white rounded-3xl border border-gray-200/80 p-5 shadow-sm hover:shadow-md hover:border-orange-500/40 transition flex flex-col justify-between"
              >
                <div>
                  <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
                    <Users size={20} />
                  </div>
                  <h4 className="font-extrabold text-gray-900 text-sm">Conference Halls</h4>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                    Large-capacity spaces for client workshops, presentations, and townhalls.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs font-bold text-orange-600">
                  <span>From ₹1,000/hr</span>
                  <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            </div>
          </div>
        </div>
        {/* Right Col: Quick Wallet Top-Up */}
        <div className="space-y-6">
          {/* Quick Credit Top-up Card */}
          <div className="bg-white rounded-3xl border border-gray-200/80 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Instant Wallet Refill</span>
              <WalletIcon size={18} className="text-[#007bc0]" />
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              Top-up your prepaid balance via Stripe Checkout to enjoy 1-click workspace settlements.
            </p>

            <div className="grid grid-cols-3 gap-2">
              {[500, 1000, 2500].map((amt) => (
                <Link
                  key={amt}
                  to={`/wallet`}
                  className="py-2 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-[#007bc0] rounded-xl text-xs font-black text-center transition"
                >
                  +₹{amt}
                </Link>
              ))}
            </div>

            <Link
              to="/wallet"
              className="block w-full py-2.5 bg-[#007bc0] hover:bg-[#005a8c] text-white text-center text-xs font-bold rounded-xl shadow transition"
            >
              Open Digital Wallet
            </Link>
          </div>
        </div>
      </div>
    </div>

  );
};

export default Dashboard;
