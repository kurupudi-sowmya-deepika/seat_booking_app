import React from 'react';

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string }> = ({
  icon,
  title,
  description,
}) => (
  <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-6 py-10 text-center">
    {icon && <div className="mb-3 text-[#007bc0] opacity-40">{icon}</div>}
    <h4 className="text-[17px] font-bold text-gray-800">{title}</h4>
    {description && <p className="mt-1 max-w-md text-[14px] text-gray-500">{description}</p>}
  </div>
);

export default EmptyState;
