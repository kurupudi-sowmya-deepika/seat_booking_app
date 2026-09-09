import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, MapPin, Calendar, Clock, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ upcoming: 0, locations: 0, rooms: 0, users: 0 });

  useEffect(() => {
    setStats({
      upcoming: 12,
      locations: 7,
      rooms: 17,
      users: 1250
    });
  }, []);

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="w-full flex flex-col font-['Inter']">
      
      <div className="flex items-center gap-2 mb-8">
        <div className="w-6 h-6 bg-[#005691] text-white flex items-center justify-center rounded-sm">
          <ChevronRight size={16} />
        </div>
        <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        <motion.div variants={item} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#007bc0]/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Upcoming Bookings</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats.upcoming}</h3>
            </div>
            <div className="p-3 bg-[#007bc0]/10 rounded-lg text-[#007bc0]">
              <Calendar size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm text-green-600 font-medium">
            <span>+7% from last week</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-green-500/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Active Locations</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats.locations}</h3>
            </div>
            <div className="p-3 bg-green-500/10 rounded-lg text-green-600">
              <MapPin size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500 font-medium">
            <span>Across 3 regions</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Meeting Rooms</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats.rooms}</h3>
            </div>
            <div className="p-3 bg-purple-500/10 rounded-lg text-purple-600">
              <Building2 size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm text-green-600 font-medium">
            <span>84% Utilization Rate</span>
          </div>
        </motion.div>

        <motion.div variants={item} className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#e20015]/5 rounded-full group-hover:scale-150 transition-transform duration-500"></div>
          <div className="flex justify-between items-start mb-4 relative z-10">
            <div>
              <p className="text-gray-500 text-sm font-medium mb-1">Total Users</p>
              <h3 className="text-3xl font-bold text-gray-800">{stats.users.toLocaleString()}</h3>
            </div>
            <div className="p-3 bg-[#e20015]/10 rounded-lg text-[#e20015]">
              <Users size={24} />
            </div>
          </div>
          <div className="flex items-center text-sm text-gray-500 font-medium">
            <span>+12 this month</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
      >
        <h2 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-4">
          <Link to="/booking" className="bg-[#007bc0] text-white px-6 py-2.5 rounded-md font-medium hover:bg-[#005691] transition-colors shadow-sm flex items-center gap-2">
            <Calendar size={18} /> Book a Meeting Room
          </Link>
          <Link to="/my-bookings" className="border border-gray-300 text-gray-700 px-6 py-2.5 rounded-md font-medium hover:bg-gray-50 transition-colors flex items-center gap-2">
            <Clock size={18} /> View My Schedule
          </Link>
        </div>
      </motion.div>

    </div>
  );
};

export default Dashboard;
