import React from 'react';
import { Users, Wifi, Monitor, Video, Coffee, Utensils, Zap, Car, MapPin, Clock, DollarSign, Star } from 'lucide-react';

interface RoomCardProps {
  room: {
    room_id: string;
    name: string;
    room_type: string;
    capacity: number;
    price_per_hour: number;
    facilities: string[];
    status: string;
    floor?: number;
    available_capacity?: number;
    seats_count?: number;
  };
  selected: boolean;
  duration: number;
  onSelect: () => void;
}

const amenityIcons: { [key: string]: React.ReactNode } = {
  'Wi-Fi': <Wifi size={11} />,
  'Display': <Monitor size={11} />,
  'Video Conferencing': <Video size={11} />,
  'Whiteboard': <Star size={11} />,
  'Coffee/Tea': <Coffee size={11} />,
  'Power Outlet': <Zap size={11} />,
  'Parking': <Car size={11} />,
  'AC': <Zap size={11} />,
  'Cafeteria': <Utensils size={11} />,
};

const getAmenityIcon = (amenity: string) => {
  return amenityIcons[amenity] || <Star size={11} />;
};

const durationLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : `${minutes / 60} hr${minutes === 60 ? '' : 's'}`;

export const RoomCard: React.FC<RoomCardProps> = ({ room, selected, duration, onSelect }) => {
  const unavailable = room.status === 'UNAVAILABLE';
  const price = (room.price_per_hour * duration / 60).toFixed(2);
  
  return (
    <button
      type="button"
      disabled={unavailable}
      onClick={onSelect}
      className={`
        rounded-xl border-2 p-3.5 text-left transition-all relative overflow-hidden w-full
        ${unavailable 
          ? 'cursor-not-allowed border-gray-200 bg-gray-50 opacity-60' 
          : selected 
            ? 'border-[#007bc0] bg-[#EAF4FA] ring-2 ring-[#007bc0]/20 shadow-md' 
            : 'border-gray-200 bg-white hover:border-[#007bc0] hover:shadow-sm'
        }
      `}
    >
      {/* Status Badge */}
      <div className="absolute top-3 right-3">
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
          unavailable 
            ? 'bg-red-100 text-red-700' 
            : 'bg-emerald-100 text-emerald-700'
        }`}>
          {unavailable ? 'Booked' : 'Available'}
        </span>
      </div>

      {/* Room Name and Type */}
      <div className="mb-2 pr-16">
        <h3 className="text-sm font-black text-gray-900 leading-tight">{room.name}</h3>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          {room.room_type === 'MEETING_ROOM' ? 'Meeting Room' : 'Conference Room'}
        </p>
      </div>

      {/* Key Details */}
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users size={12} className="text-[#007bc0]" />
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold leading-tight">Capacity</p>
            <p className="text-xs font-bold text-gray-800">{room.capacity} seats</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 rounded-md bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <DollarSign size={12} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-[9px] text-gray-500 uppercase font-semibold leading-tight">Price</p>
            <p className="text-xs font-bold text-gray-800">₹{room.price_per_hour}/hr</p>
          </div>
        </div>
      </div>

      {/* Available Capacity */}
      {room.available_capacity !== undefined && (
        <div className="mb-2">
          <div className="flex justify-between items-center mb-0.5">
            <span className="text-[10px] text-gray-600 font-semibold">Available Seats</span>
            <span className={`text-[10px] font-bold ${room.available_capacity < 5 ? 'text-red-600' : 'text-emerald-600'}`}>
              {room.available_capacity} / {room.capacity}
            </span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all ${
                (room.capacity - room.available_capacity) / room.capacity > 0.8 
                  ? 'bg-red-500' 
                  : (room.capacity - room.available_capacity) / room.capacity > 0.5 
                    ? 'bg-amber-500' 
                    : 'bg-emerald-500'
              }`} 
              style={{ width: `${((room.capacity - room.available_capacity) / room.capacity) * 100}%` }}
            />
          </div>
        </div>
      )}
      
      {/* Floor Information */}
      {room.floor && (
        <div className="mb-2 flex items-center gap-1">
          <MapPin size={11} className="text-gray-400" />
          <span className="text-[10px] text-gray-600">Floor {room.floor}</span>
        </div>
      )}

      {/* Amenities */}
      <div className="mb-2">
        <p className="text-[9px] text-gray-500 uppercase font-semibold mb-1">Amenities</p>
        <div className="flex flex-wrap gap-1">
          {(room.facilities || []).slice(0, 6).map((facility, index) => (
            <div
              key={index}
              className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-50 rounded text-[9px] font-semibold text-gray-700"
            >
              {getAmenityIcon(facility)}
              <span>{facility}</span>
            </div>
          ))}
          {(room.facilities || []).length > 6 && (
            <span className="text-[9px] font-bold text-gray-500 px-1.5 py-0.5">
              +{(room.facilities || []).length - 6} more
            </span>
          )}
        </div>
      </div>

      {/* Price and Duration */}
      <div className="pt-2 border-t border-gray-100 flex justify-between items-center">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
          <Clock size={11} />
          <span>{durationLabel(duration)}</span>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-gray-500 uppercase font-semibold">Total</p>
          <p className="text-sm font-black text-gray-900">₹{price}</p>
        </div>
      </div>
    </button>
  );
};

export default RoomCard;