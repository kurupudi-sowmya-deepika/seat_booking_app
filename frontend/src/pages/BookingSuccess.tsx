import React, { useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';

const BookingSuccess: React.FC = () => {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const navigate = useNavigate();

  useEffect(() => {
    if (!sessionId) {
      navigate('/');
    }
  }, [sessionId, navigate]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center animate-fade-in">
      <div className="w-24 h-24 bg-[rgba(16,185,129,0.1)] text-success-color rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
        <CheckCircle size={48} />
      </div>
      <h1 className="text-4xl font-bold text-white mb-4">Payment Successful!</h1>
      <p className="text-text-secondary text-lg mb-8 max-w-md">
        Your seat has been successfully booked and confirmed. You can view the details in your bookings dashboard.
      </p>
      <div className="flex gap-4">
        <Link to="/my-bookings" className="btn btn-primary">View My Bookings</Link>
        <Link to="/" className="btn btn-secondary">Return Home</Link>
      </div>
    </div>
  );
};

export default BookingSuccess;
