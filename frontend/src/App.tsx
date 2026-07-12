import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { api } from './api';

const Login = React.lazy(() => import('./pages/Login').then(m => ({ default: m.Login })));
const Dashboard = React.lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Vehicles = React.lazy(() => import('./pages/Vehicles').then(m => ({ default: m.Vehicles })));
const Drivers = React.lazy(() => import('./pages/Drivers').then(m => ({ default: m.Drivers })));
const Trips = React.lazy(() => import('./pages/Trips').then(m => ({ default: m.Trips })));
const Maintenance = React.lazy(() => import('./pages/Maintenance').then(m => ({ default: m.Maintenance })));
const FuelExpense = React.lazy(() => import('./pages/Fuel').then(m => ({ default: m.FuelExpense })));
const Reports = React.lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Settings = React.lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const Notifications = React.lazy(() => import('./pages/Notifications').then(m => ({ default: m.Notifications })));

import { 
  Gauge, Car, Users, Route as DispatchIcon, Wrench, Fuel, PieChart,
  Settings as SettingsIcon, LogOut, Bell, Search, UserCheck, Menu, X
} from 'lucide-react';
import { useToast } from './hooks/useToast';

const SIDEBAR_ITEMS = [
  { name: 'Dashboard', path: '/', icon: Gauge },
  { name: 'Vehicles', path: '/vehicles', icon: Car },
  { name: 'Drivers', path: '/drivers', icon: Users },
  { name: 'Trips', path: '/trips', icon: DispatchIcon },
  { name: 'Maintenance', path: '/maintenance', icon: Wrench },
  { name: 'Fuel & Expenses', path: '/fuel', icon: Fuel },
  { name: 'Analytics', path: '/reports', icon: PieChart },
  { name: 'Settings & RBAC', path: '/settings', icon: SettingsIcon },
];

const PageLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-3 border-t-brand-500 border-neutral-800 rounded-full animate-spin" />
  </div>
);

export const AppContent: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTag, setNotificationTag] = useState<'Red' | 'Yellow'>('Red');
  const [notificationDescription, setNotificationDescription] = useState('');
  const [notificationLocation, setNotificationLocation] = useState('');
  const [submittingNotification, setSubmittingNotification] = useState(false);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpulse_user');
    const token = localStorage.getItem('fleetpulse_token');
    if (userStr && token) setUser(JSON.parse(userStr));
    setLoading(false);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('fleetpulse_token');
    localStorage.removeItem('fleetpulse_user');
    setUser(null);
    navigate('/login');
  };

  const handleNotificationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== 'Driver') return;

    setSubmittingNotification(true);
    try {
      await api.post('/notifications', {
        tag: notificationTag,
        description: notificationDescription,
        location: notificationLocation,
      });
      setNotificationTag('Red');
      setNotificationDescription('');
      setNotificationLocation('');
      setShowNotificationModal(false);
      toast('Notification sent successfully.', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to send notification.', 'error');
    } finally {
      setSubmittingNotification(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-2">
        <div className="w-10 h-10 border-4 border-t-brand-500 border-neutral-800 rounded-full animate-spin" />
        <p className="text-xs text-neutral-400">Loading FleetPulse...</p>
      </div>
    );
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (location.pathname === '/login') {
    return (
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<Login onLoginSuccess={(u) => setUser(u)} />} />
        </Routes>
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-background text-neutral-100 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-neutral-800/80 flex flex-col justify-between flex-shrink-0 transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div>
          <div className="p-6 border-b border-neutral-800/80 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-brand-400 flex items-center justify-center">
              <span className="text-base">⚡</span>
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-neutral-100 block">FleetPulse</span>
              <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">Live Ops Center</span>
            </div>
            <button className="lg:hidden ml-auto text-neutral-400 hover:text-neutral-200" onClick={() => setSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-1">
            {SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-semibold tracking-wide transition group ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/10'
                      : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 transition ${isActive ? 'text-white' : 'text-neutral-400 group-hover:text-brand-400'}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-neutral-800/80 space-y-3">
          <div className="flex items-center gap-2 px-2 py-1.5 bg-neutral-950/40 rounded-lg border border-neutral-900">
            <div className="w-7 h-7 rounded-full bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400">
              {user.name.charAt(0)}
            </div>
            <div className="overflow-hidden">
              <span className="text-[11px] font-bold text-neutral-200 block truncate">{user.name}</span>
              <span className="text-[9px] text-neutral-500 font-mono block truncate">{user.role}</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 text-neutral-400 hover:text-red-400 hover:bg-red-950/20 border border-transparent hover:border-red-900/30 rounded-lg text-xs font-semibold transition"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-neutral-800/80 px-4 lg:px-6 flex items-center justify-between bg-card-light/40 backdrop-blur-md sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 text-neutral-400 hover:text-neutral-200" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative w-48 md:w-72 hidden sm:block">
              <Search className="absolute left-3 top-2.5 text-neutral-500 w-4 h-4" />
              <input
                type="text"
                placeholder="Global fleet search..."
                className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-4 py-2 text-xs text-neutral-300 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            {user.role === 'Driver' && (
              <button
                type="button"
                onClick={() => setShowNotificationModal(true)}
                className="hidden sm:flex items-center gap-2 bg-red-950/60 hover:bg-red-950 border border-red-800/60 px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition"
              >
                Want to Notify
              </button>
            )}

            <button
              type="button"
              onClick={() => navigate('/notifications')}
              className="relative bg-neutral-900/60 hover:bg-neutral-800 border border-neutral-800 p-2 rounded-lg text-neutral-400 hover:text-neutral-200 transition hidden sm:block"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-brand-500" />
            </button>

            <span className="bg-neutral-900 text-white border border-neutral-850 px-2 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase hidden md:flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-brand-500" /> {user.role}
            </span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-y-auto">
          <Suspense fallback={<PageLoader />}>
            <Routes key={`${user.id}-${user.role}`}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/vehicles" element={<Vehicles />} />
              <Route path="/drivers" element={<Drivers />} />
              <Route path="/trips" element={<Trips />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/fuel" element={<FuelExpense />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </main>

        {showNotificationModal && user.role === 'Driver' && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass w-full max-w-lg rounded-2xl border border-neutral-800 p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
                <h2 className="text-lg font-bold text-neutral-100">Driver Notification</h2>
                <button
                  type="button"
                  onClick={() => setShowNotificationModal(false)}
                  className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4 text-xs">
                <button
                  type="button"
                  onClick={() => setNotificationTag('Red')}
                  className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${notificationTag === 'Red' ? 'bg-red-950/80 border-red-700 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-300'}`}
                >
                  <span className="block text-[10px] uppercase tracking-wider text-red-300 mb-1">Red Tag</span>
                  Severe issue or urgent help needed
                </button>
                <button
                  type="button"
                  onClick={() => setNotificationTag('Yellow')}
                  className={`rounded-xl border px-4 py-3 text-left font-semibold transition ${notificationTag === 'Yellow' ? 'bg-amber-950/80 border-amber-700 text-white' : 'bg-neutral-950 border-neutral-800 text-neutral-300'}`}
                >
                  <span className="block text-[10px] uppercase tracking-wider text-amber-300 mb-1">Yellow Tag</span>
                  Caution, warning, or update request
                </button>
              </div>

              <form onSubmit={handleNotificationSubmit} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    required
                    rows={4}
                    value={notificationDescription}
                    onChange={(e) => setNotificationDescription(e.target.value)}
                    placeholder="Describe the issue or update needed..."
                    className="w-full bg-white border border-neutral-300 rounded-xl p-3 text-sm text-black focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Current Location</label>
                  <input
                    type="text"
                    required
                    value={notificationLocation}
                    onChange={(e) => setNotificationLocation(e.target.value)}
                    placeholder="Where are you right now?"
                    className="w-full bg-white border border-neutral-300 rounded-xl p-3 text-sm text-black focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="text-[10px] text-neutral-500">
                    Submitted by <span className="font-semibold text-neutral-300">{user.name}</span>
                  </div>
                  <button
                    type="submit"
                    disabled={submittingNotification}
                    className="bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg px-4 py-2 transition disabled:opacity-50"
                  >
                    {submittingNotification ? 'Sending...' : 'Send Notification'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
