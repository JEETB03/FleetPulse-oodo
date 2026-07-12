import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { KeyRound, Mail, ShieldAlert, Sparkles, UserCheck } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

const PERSONAS = [
  { role: 'Admin', email: 'admin@fleetpulse.com', desc: 'Full control over settings and configurations' },
  { role: 'Fleet Manager', email: 'manager@fleetpulse.com', desc: 'Manages registry, maintenance & assignments' },
  { role: 'Dispatcher', email: 'dispatcher@fleetpulse.com', desc: 'Accesses dispatch dispatcher & auto-assigner' },
  { role: 'Safety Officer', email: 'safety@fleetpulse.com', desc: 'Inspects safety scores, safety profiles & rest metrics' },
  { role: 'Finance Analyst', email: 'finance@fleetpulse.com', desc: 'Tracks costs, logs expenses & audits anomalies' },
  { role: 'Driver', email: 'driver@fleetpulse.com', desc: 'Submits driver trip reports & personal metrics' },
];

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('password123');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Admin');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const data = await api.post<any>('/auth/login', { email, password });
        localStorage.setItem('fleetpulse_token', data.access_token);
        localStorage.setItem('fleetpulse_user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
        navigate('/');
      } else {
        const data = await api.post<any>('/auth/signup', { name, email, password, role });
        localStorage.setItem('fleetpulse_token', data.access_token);
        localStorage.setItem('fleetpulse_user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePersonaLogin = async (personaEmail: string) => {
    setError('');
    setLoading(true);
    try {
      const data = await api.post<any>('/auth/login', { email: personaEmail, password: 'password123' });
      localStorage.setItem('fleetpulse_token', data.access_token);
      localStorage.setItem('fleetpulse_user', JSON.stringify(data.user));
      onLoginSuccess(data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Persona login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 lg:p-8">
      {/* Brand Logo header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center shadow-lg shadow-brand-500/25">
          <span className="text-2xl">⚡</span>
        </div>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-neutral-50 via-neutral-100 to-brand-400 bg-clip-text text-transparent">
            FleetPulse
          </h1>
          <p className="text-xs text-neutral-400 font-medium tracking-widest uppercase">Ops Management Platform</p>
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left pane: Persona quick login */}
        <div className="lg:col-span-7 glass rounded-2xl p-6 lg:p-8 border border-neutral-800">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="text-brand-500 w-5 h-5" />
            <h2 className="text-xl font-bold text-neutral-100">Quick Access Personas</h2>
          </div>
          <p className="text-sm text-neutral-400 mb-6">
            For evaluation and hackathon review, select any preconfigured role profile to log in immediately with pre-loaded demo data.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {PERSONAS.map((p) => (
              <button
                key={p.role}
                onClick={() => handlePersonaLogin(p.email)}
                disabled={loading}
                className="flex flex-col items-start p-4 bg-neutral-900/60 border border-neutral-800 hover:border-brand-500/40 rounded-xl text-left hover:bg-neutral-800/40 transition card-transition group"
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="font-semibold text-white group-hover:text-white transition text-sm flex items-center gap-1.5">
                    <UserCheck className="w-4 h-4" /> {p.role}
                  </span>
                  <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400 transition bg-neutral-800 px-2 py-0.5 rounded-full border border-neutral-800">
                    Active
                  </span>
                </div>
                <span className="text-xs text-neutral-300 font-mono mb-2">{p.email}</span>
                <span className="text-xs text-neutral-400 leading-relaxed">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right pane: Standard form */}
        <div className="lg:col-span-5 glass rounded-2xl p-6 lg:p-8 border border-neutral-800">
          <h2 className="text-2xl font-bold text-neutral-100 mb-2">
            {isLogin ? 'Sign In' : 'Create Account'}
          </h2>
          <p className="text-sm text-neutral-400 mb-6">
            {isLogin ? 'Enter your fleet credentials' : 'Register a new profile in the registry'}
          </p>

          {error && (
            <div className="flex items-center gap-3 bg-red-950/60 border border-red-800 text-red-200 text-sm p-4 rounded-xl mb-6">
              <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <UserCheck className="absolute left-3 top-3.5 text-neutral-500 w-4 h-4" />
                  <input
                    type="text"
                    required
                    placeholder="Enter name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 text-neutral-500 w-4 h-4" />
                <input
                  type="email"
                  required
                  placeholder="e.g. user@fleetpulse.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-3.5 text-neutral-500 w-4 h-4" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm text-neutral-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                />
              </div>
            </div>

            {!isLogin && (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">Role Authority</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition"
                >
                  <option value="Admin">Admin</option>
                  <option value="Fleet Manager">Fleet Manager</option>
                  <option value="Dispatcher">Dispatcher</option>
                  <option value="Safety Officer">Safety Officer</option>
                  <option value="Finance Analyst">Finance Analyst</option>
                  <option value="Driver">Driver</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-xl py-3 text-sm shadow-lg shadow-brand-500/15 transition focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-neutral-900 disabled:opacity-50"
            >
              {loading ? 'Processing...' : isLogin ? 'Access Platform' : 'Sign Up Profile'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-xs text-neutral-400 hover:text-neutral-200 underline decoration-brand-500 underline-offset-4"
            >
              {isLogin ? "Need a new account? Register here" : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
