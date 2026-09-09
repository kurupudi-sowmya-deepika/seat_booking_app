import React from 'react';

const AdminSettings: React.FC = () => {
  return (
    <div className="bg-white rounded-[20px] shadow-sm p-8 min-h-[500px]">
      <h1 className="text-3xl font-semibold mb-6 text-[#212224]">System Settings</h1>
      <p className="text-[#71767C]">Configure locations, branches, rooms, seats, and other global application settings here.</p>
    </div>
  );
};

export default AdminSettings;
