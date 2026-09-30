import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useMsal } from '@azure/msal-react';
import api from '../services/api';
import { ShieldCheck, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { instance } = useMsal();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleEntraLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Authenticate with Microsoft & request Microsoft Graph User.Read scope
      const loginResponse = await instance.loginPopup({
        scopes: ["User.Read", "openid", "profile", "email"],
        prompt: "select_account"
      });

      // Query Microsoft Graph API for authoritative user profile and photo
      let graphEmail = '';
      let graphName = '';
      let graphOid = '';
      let graphPhoto: string | null = null;

      try {
        if (loginResponse.accessToken) {
          const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
            headers: { Authorization: `Bearer ${loginResponse.accessToken}` }
          });
          if (graphRes.ok) {
            const graphData = await graphRes.json();
            graphEmail = graphData.mail || graphData.userPrincipalName || '';
            graphName = graphData.displayName || `${graphData.givenName || ''} ${graphData.surname || ''}`.trim() || '';
            graphOid = graphData.id || '';
          }

          // Fetch user photo from Microsoft Graph API
          try {
            const photoRes = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
              headers: { Authorization: `Bearer ${loginResponse.accessToken}` }
            });
            if (photoRes.ok) {
              const blob = await photoRes.blob();
              graphPhoto = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
            }
          } catch (photoErr) {
            console.info('No Microsoft Graph photo found:', photoErr);
          }
        }
      } catch (graphError) {
        console.warn('Microsoft Graph API user fetch warning, falling back to token:', graphError);
      }

      // Backend checks user table existence, auto-provisions if new, and returns JWT session
      const res = await api.post('/auth/login/entra', {
        token: loginResponse.idToken || loginResponse.accessToken,
        email: graphEmail || undefined,
        name: graphName || undefined,
        oid: graphOid || undefined
      });

      const userRes = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${res.data.access_token}` }
      });

      login(res.data.access_token, userRes.data, graphPhoto);
      navigate('/');
    } catch (err: any) {
      console.error('Microsoft login error:', err);
      setError(err.response?.data?.detail || err.message || 'Microsoft authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50/50 p-4 sm:p-6 lg:p-8 font-['Segoe_UI',system-ui,-apple-system,sans-serif]">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-slate-200/80 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[560px] animate-fade-in">

        {/* Left Side (Enterprise Branding & Hub Highlights) */}
        <div className="lg:col-span-6 bg-gradient-to-br from-[#0a192f] via-[#0d2342] to-[#071324] text-white p-8 sm:p-10 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle background glow effects */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#007bc0]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 space-y-6">
            {/* Header Brand */}
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center p-2 shadow-inner">
                <img src="/favicon.png" alt="SpaceHub App" className="w-full h-full object-contain" />
              </div>
              <div>
                <h2 className="text-lg font-bold tracking-tight text-white leading-tight">SpaceHub App</h2>
                <p className="text-[11px] font-medium text-slate-400">Enterprise Workspace Management</p>
              </div>
            </div>

            {/* Headline */}
            <div className="space-y-2 pt-2">

              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                Connect and collaborate across global enterprise hubs with seamless single sign-on.
              </p>
            </div>

            {/* Feature Highlights */}
            <div className="space-y-3 pt-2">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">5 Global Corporate Locations</h4>
                  <p className="text-[11px] text-slate-400">Jacksonville, London, Bangalore & Hyderabad</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">Real-Time Interactive Availability</h4>
                  <p className="text-[11px] text-slate-400">Desks, focus zones, day passes & executive boardrooms</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer badge */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <ShieldCheck size={15} />
              <span>Microsoft Entra ID Protected</span>
            </div>
            <span>© 2026 intuceo</span>
          </div>
        </div>

        {/* Right Side (Microsoft SSO Action) */}
        <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-white">
          <div className="flex justify-end">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-[#007bc0] border border-blue-200/80 font-bold text-[11px] rounded-full uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#007bc0] animate-pulse" />
              Corporate SSO
            </span>
          </div>

          <div className="my-auto py-6 space-y-6 max-w-sm mx-auto w-full text-center sm:text-left">
            <div className="space-y-2">
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                Welcome back
              </h3>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                Sign in with your Microsoft organizational credentials to manage and book your workspaces.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-semibold text-left">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleEntraLogin}
                disabled={loading}
                className="w-full py-3.5 px-5 bg-[#2f2f2f] hover:bg-[#1a1a1a] active:scale-[0.99] text-white font-semibold rounded-xl transition-all duration-200 shadow-md hover:shadow-xl flex items-center justify-center gap-3 disabled:opacity-60 cursor-pointer text-sm group"
              >
                {loading ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-white" />
                    <span>Connecting to Microsoft...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 shrink-0 transition-transform group-hover:scale-105" viewBox="0 0 21 21">
                      <path fill="#f35325" d="M1 1h9v9H1z" />
                      <path fill="#81bc06" d="M11 1h9v9h-9z" />
                      <path fill="#05a6f0" d="M1 11h9v9H1z" />
                      <path fill="#ffba08" d="M11 11h9v9h-9z" />
                    </svg>
                    <span>Sign in with Microsoft</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 pt-4 border-t border-slate-100">
            Protected by enterprise-grade token encryption & access policies.
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
