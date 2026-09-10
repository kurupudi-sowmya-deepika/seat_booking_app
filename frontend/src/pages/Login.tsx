import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import api from '../services/api';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { instance } = useMsal();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleEntraLogin = async () => {
    try {
      const loginResponse = await instance.loginPopup({ scopes: ["User.Read"] });
      const res = await api.post('/auth/login/entra', { token: loginResponse.idToken });

      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${res.data.access_token}` }
      });

      login(res.data.access_token, userRes.data);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || err.message || 'Azure AD login failed.');
    }
  };

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const formData = new URLSearchParams();
      formData.append('username', email);
      formData.append('password', password);

      const res = await api.post('/auth/login', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${res.data.access_token}` }
      });

      login(res.data.access_token, userRes.data);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || 'Invalid email or password');
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-color)' }}>
      <div className="bosch-supergraphic shrink-0" aria-hidden="true" />
      <div className="flex-center flex-1">
      <div className="login-container animate-fade-in">

        {/* Left Side (Branding) */}
        <div className="login-left">
          <div className="login-blob-top"></div>
          <div className="login-blob-bottom"></div>

          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <img src="/bosch-logo.png" alt="Bosch" style={{ height: '2.5rem', width: 'auto', objectFit: 'contain' }} />
            </div>

            <h1 style={{ fontSize: '2.25rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '1.5rem' }}>Seat Booking App</h1>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: '3rem' }}>
              © 2026 Bosch. All rights reserved.
            </p>
          </div>
        </div>

        {/* Right Side (Auth) */}
        <div className="login-right">
          <div className="pill-tag" style={{ fontSize: '0.65rem', padding: '0.25rem 1rem' }}>
            Secure Authentication
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
            Sign in to continue
          </p>

          {error && (
            <div style={{ color: 'var(--danger-color)', fontSize: '0.875rem', marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLocalLogin} style={{ width: '100%', maxWidth: '320px', marginBottom: '1.5rem' }}>
            <div className="input-group">
              <label className="input-label" style={{ textAlign: 'left' }}>Email Address</label>
              <input 
                type="email" 
                className="input-field" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required 
              />
            </div>
            
            <div className="input-group">
              <label className="input-label" style={{ textAlign: 'left' }}>Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
              Sign In
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '320px', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
            <span style={{ padding: '0 1rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>OR</span>
            <div style={{ flex: 1, height: '1px', backgroundColor: 'var(--border-color)' }}></div>
          </div>

          <button type="button" onClick={handleEntraLogin} className="btn btn-secondary" style={{ width: '100%', maxWidth: '320px', padding: '0.875rem 1.5rem', gap: '0.75rem' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 21 21">
              <path fill="#f35325" d="M1 1h9v9H1z" />
              <path fill="#81bc06" d="M11 1h9v9h-9z" />
              <path fill="#05a6f0" d="M1 11h9v9H1z" />
              <path fill="#ffba08" d="M11 11h9v9h-9z" />
            </svg>
            Sign in with Azure AD
          </button>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.65rem', marginTop: '2rem', maxWidth: '250px' }}>
            By signing in, you agree to Bosch's Terms of Service and Privacy Policy
          </p>
        </div>

      </div></div>
    </div>
  );
};

export default Login;
