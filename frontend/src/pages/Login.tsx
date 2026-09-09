import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import api from '../services/api';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { instance } = useMsal();

  const handleEntraLogin = async () => {
    try {
      const loginResponse = await instance.loginPopup({ scopes: ["User.Read"] });
      const res = await api.post('/auth/login/entra', { token: loginResponse.idToken });

      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${res.data.access_token}` }
      });

      login(res.data.access_token, userRes.data);
      navigate('/');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="flex-center min-h-screen" style={{ backgroundColor: 'var(--bg-color)' }}>
      <div className="login-container animate-fade-in">

        {/* Left Side (Branding) */}
        <div className="login-left">
          <div className="login-blob-top"></div>
          <div className="login-blob-bottom"></div>

          <div style={{ position: 'relative', zIndex: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <img src="/bosch-logo.png" alt="Bosch Logo" style={{ height: '2.5rem', objectFit: 'contain' }} />
              <span style={{ color: 'var(--secondary-color)', fontSize: '1.875rem', fontWeight: 'bold', letterSpacing: '-0.025em' }}>BOSCH</span>
            </div>

            <h1 style={{ fontSize: '2.25rem', color: 'var(--text-primary)', fontWeight: '600', marginBottom: '1.5rem' }}>Seat Booking Management</h1>

            <div className="pill-tag">
              Enterprise Quality Assurance
            </div>

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

          <h2 style={{ fontSize: '1.875rem', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem' }}>Welcome to</h2>
          <h2 style={{ fontSize: '1.875rem', color: 'var(--text-primary)', fontWeight: '500', marginBottom: '1.5rem' }}>Seat Booking Management</h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '2.5rem' }}>
            Sign in with your Bosch Azure AD account
          </p>

          <button onClick={handleEntraLogin} className="btn btn-primary" style={{ width: '100%', maxWidth: '320px', padding: '0.875rem 1.5rem', gap: '0.75rem' }}>
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

      </div>
    </div>
  );
};

export default Login;
