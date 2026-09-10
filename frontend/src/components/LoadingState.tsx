import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 text-gray-500">
    <Loader2 className="animate-spin text-[#007bc0]" size={32} />
    <p className="text-[14px] font-semibold">{label}</p>
  </div>
);

export default LoadingState;
