import React from 'react';

const AdminBooking: React.FC = () => {
  return (
    <div className="bg-white rounded-[20px] shadow-sm p-8 min-h-[500px]">
      <h1 className="text-3xl font-semibold mb-6 text-[#212224]">Book Meeting Room (Admin)</h1>
      <p className="text-[#71767C]">Admin interface to book meeting rooms on behalf of users or manage room reservations.</p>
    </div>
  );
};

export default AdminBooking;
