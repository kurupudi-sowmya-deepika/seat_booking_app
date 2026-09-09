import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { UserPlus } from 'lucide-react';

const Register: React.FC = () => {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/auth/register', {
        email, name, password
      });
      navigate('/login');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-color)]">
      <div className="glass-panel p-8 w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Create Account</h1>
          <p className="text-text-secondary">Join to start booking workspaces</p>
        </div>
        
        {error && <div className="badge badge-danger w-full text-center mb-6 py-2">{error}</div>}
        
        <form onSubmit={handleRegister}>
          <div className="input-group">
            <label className="input-label">Full Name</label>
            <input 
              type="text" 
              className="input-field" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label className="input-label">Email</label>
            <input 
              type="email" 
              className="input-field" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <label className="input-label">Password</label>
            <input 
              type="password" 
              className="input-field" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="btn btn-primary w-full mt-4 flex justify-center gap-2">
            <UserPlus size={20} /> Register
          </button>
        </form>
        
        <p className="text-center mt-6 text-sm text-text-secondary">
          Already have an account? <Link to="/login" className="text-primary-color hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
