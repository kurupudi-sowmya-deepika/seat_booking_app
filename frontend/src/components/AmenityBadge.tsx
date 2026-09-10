import React from 'react';
import { Car, Coffee, Monitor, Printer, Star, Utensils, Video, Wifi, Wind, Zap } from 'lucide-react';

const ICONS: Record<string, React.ReactNode> = {
  'Wi-Fi': <Wifi size={13} />,
  Wifi: <Wifi size={13} />,
  Display: <Monitor size={13} />,
  'Video Conferencing': <Video size={13} />,
  Whiteboard: <Star size={13} />,
  AC: <Wind size={13} />,
  Parking: <Car size={13} />,
  'Power Outlet': <Zap size={13} />,
  'Coffee/Tea': <Coffee size={13} />,
  Cafeteria: <Utensils size={13} />,
  Printing: <Printer size={13} />,
  'Lounge Access': <Star size={13} />,
};

export const AmenityBadge: React.FC<{ name: string }> = ({ name }) => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[12px] font-semibold text-gray-700">
    {ICONS[name] || <Star size={13} />}
    {name}
  </span>
);

export default AmenityBadge;
