import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Building2, MapPin, Calendar, Clock } from 'lucide-react';

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState({ upcoming: 0, locations: 0, rooms: 0, users: 0 });

  useEffect(() => {
    // In a real app we'd fetch actual stats here. Using mock data for visual representation
    setStats({
      upcoming: 12,
      locations: 7,
      rooms: 17,
      users: 1250
    });
  }, []);

  return (
    <div className="w-full bg-[#007bc0] text-white min-h-[calc(100vh-64px)] p-4 md:p-8 flex flex-col font-['Inter']">
      
      <div className="flex justify-between items-end mb-8">
        <h1 className="text-3xl font-bold">SeatSync Dashboard</h1>
        <div className="flex gap-4">
          <Link to="/booking" className="bg-white text-[#007bc0] px-6 py-2 rounded-sm font-bold hover:bg-gray-100 transition-colors shadow-md">
            Book a Meeting Room
          </Link>
          <Link to="/my-bookings" className="border border-white text-white px-6 py-2 rounded-sm font-bold hover:bg-white/10 transition-colors">
            My Bookings
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
        
        {/* Left Panel: Booking Overview */}
        <div className="bg-[#007bc0] border border-transparent shadow-[0_0_15px_rgba(0,0,0,0.1)] relative flex flex-col justify-between overflow-hidden group">
          <div className="p-8 pb-24 z-10">
            <h2 className="text-sm font-bold mb-1">Financial Year 2024-25</h2>
            <p className="text-xs text-white mb-16">Booking Performance Overview</p>

            <div className="flex items-center justify-between relative px-4">
              {/* Left stat */}
              <div className="flex flex-col text-left max-w-[120px]">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={24} />
                  <span className="font-bold">{stats.upcoming} Active</span>
                </div>
                <div className="w-full h-px bg-white/50 mb-2"></div>
                <p className="text-xs text-white">Upcoming Bookings<br/>+7%</p>
              </div>

              {/* Center Circle */}
              <div className="relative w-48 h-48 rounded-full border-[12px] border-white flex flex-col items-center justify-center text-center bg-[#007bc0] z-20">
                 {/* Cutout illusion */}
                 <div className="absolute -top-3 -right-3 w-8 h-8 bg-[#007bc0]"></div>
                 <h3 className="text-xl font-bold mb-1">1,250</h3>
                 <p className="text-[10px] px-6 leading-tight">Total Reservations for<br/>FY 2024-25</p>
              </div>

              {/* Lines pointing to circle */}
              <div className="absolute top-1/2 left-24 w-12 h-px bg-white/50 -translate-y-6"></div>
              <div className="absolute top-1/2 right-24 w-12 h-px bg-white/50 translate-y-6"></div>

              {/* Right stat */}
              <div className="flex flex-col text-right max-w-[120px]">
                <div className="flex items-center justify-end gap-2 mb-2">
                  <span className="font-bold">84%</span>
                  <Clock size={24} />
                </div>
                <div className="w-full h-px bg-white/50 mb-2"></div>
                <p className="text-xs text-white">Utilization Rate<br/>+6.3%</p>
              </div>
            </div>
          </div>
          
          {/* Logo bottom right */}
          <div className="absolute bottom-8 right-8 z-10">
            <div className="text-2xl font-black tracking-widest flex items-center gap-2">
              <div className="w-8 h-8 border-[3px] border-white rounded-full flex items-center justify-center">
                <div className="w-[10px] h-[10px] border-[3px] border-white rounded-full"></div>
              </div>
              BOSCH
            </div>
          </div>

          {/* Supergraphic bottom edge */}
          <div className="absolute bottom-0 left-0 w-full bosch-supergraphic h-[6px]"></div>
        </div>

        {/* Right Panel: Assets Overview */}
        <div className="bg-[#007bc0] border border-transparent shadow-[0_0_15px_rgba(0,0,0,0.1)] relative flex flex-col justify-between overflow-hidden">
          <div className="p-8 pb-24 z-10">
            <h2 className="text-sm font-bold mb-1">Financial Year 2024-25</h2>
            <p className="text-xs text-white mb-16">Our spaces, our greatest asset</p>

            <div className="flex items-center justify-between px-8">
              {/* Associates / Users */}
              <div className="flex flex-col items-center justify-center">
                <Users size={90} className="mb-6 stroke-1" />
                <h3 className="text-5xl font-bold tracking-tight mb-2">{stats.users.toLocaleString()}</h3>
                <p className="text-sm">Active Users</p>
              </div>

              {/* Right side lists */}
              <div className="flex flex-col justify-center flex-1 ml-16 relative">
                 {/* Decorative horizontal lines background */}
                 <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between py-2 border-r border-white/30 pr-4">
                    {[...Array(18)].map((_, i) => <div key={i} className="w-full h-[1px] bg-white/40"></div>)}
                 </div>

                 <div className="pl-8 w-full">
                   <div className="border-b border-white/50 pb-3 mb-4 flex items-end justify-between">
                     <div className="flex items-baseline gap-3">
                       <h4 className="text-3xl font-bold">{stats.rooms}</h4>
                       <p className="text-xs">Meeting Rooms</p>
                     </div>
                     <Building2 size={24} className="stroke-1" />
                   </div>

                   <div className="border-b border-white/50 pb-3 flex items-end justify-between">
                     <div className="flex items-baseline gap-3">
                       <h4 className="text-3xl font-bold">{stats.locations}</h4>
                       <p className="text-xs">Office Locations</p>
                     </div>
                     <MapPin size={24} className="stroke-1" />
                   </div>
                 </div>
              </div>
            </div>
          </div>

          {/* Logo bottom right */}
          <div className="absolute bottom-8 right-8 z-10">
            <div className="text-2xl font-black tracking-widest flex items-center gap-2">
              <div className="w-8 h-8 border-[3px] border-white rounded-full flex items-center justify-center">
                <div className="w-[10px] h-[10px] border-[3px] border-white rounded-full"></div>
              </div>
              BOSCH
            </div>
          </div>

          {/* Supergraphic bottom edge */}
          <div className="absolute bottom-0 left-0 w-full bosch-supergraphic h-[6px]"></div>
        </div>

      </div>
    </div>
  );
};

export default Dashboard;
