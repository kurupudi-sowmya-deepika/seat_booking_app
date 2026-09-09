import React from 'react';

const AdminDashboard: React.FC = () => {
  return (
    <div className="bg-white rounded-[20px] shadow-sm p-8 min-h-[500px]">
      <h1 className="text-3xl font-semibold mb-6 text-[#212224]">Admin Dashboard</h1>
      <p className="text-[#71767C]">Welcome to the admin panel. Use the navigation links above to manage the system.</p>
    </div>
  );
};

export default AdminDashboard;
