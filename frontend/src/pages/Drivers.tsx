import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  Plus, 
  Search, 
  Clock, 
  Award, 
  X, 
  Lock,
  ThumbsUp,
  AlertTriangle
} from 'lucide-react';

interface Driver {
  id: string;
  name: string;
  license_no: string;
  license_expiry: string;
  violations: number;
  trips_completed: number;
  hours_driven_7d: number;
  last_trip_end: string | null;
  linked_user_id: string | null;
  safety_score: number;
  safety_badge: string;
}

export const Drivers: React.FC = () => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Add Driver state
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState(new Date().toISOString().split('T')[0]);
  const [violations, setViolations] = useState(0);
  const [hoursDriven, setHoursDriven] = useState(0);
  const [addError, setAddError] = useState('');

  // Current logged in user for permission checks
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpulse_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      setLoading(true);
      const data = await api.get<Driver[]>('/drivers');
      setDrivers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch driver registry');
    } finally {
      setLoading(false);
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    try {
      await api.post('/drivers', {
        name,
        license_no: licenseNo,
        license_expiry: licenseExpiry,
        violations: violations,
        hours_driven_7d: hoursDriven
      });
      setShowAddModal(false);
      setName('');
      setLicenseNo('');
      setViolations(0);
      setHoursDriven(0);
      fetchDrivers();
    } catch (err: any) {
      setAddError(err.message || 'Failed to register driver');
    }
  };

  // Check write access (Admin, Fleet Manager, Safety Officer)
  const hasWriteAccess = currentUser && (
    currentUser.role === 'Admin' || 
    currentUser.role === 'Fleet Manager' || 
    currentUser.role === 'Safety Officer'
  );

  const filteredDrivers = drivers.filter(d => 
    d.name.toLowerCase().includes(search.toLowerCase()) || 
    d.license_no.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Drivers & Safety Profiles</h1>
          <p className="text-xs text-neutral-400 mt-1">Real-time driver fatigue index and safety score engine auditing.</p>
        </div>
        <div>
          {hasWriteAccess ? (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs px-4 py-2.5 rounded-lg transition font-semibold shadow-lg shadow-brand-500/10"
            >
              <Plus className="w-4 h-4" /> Add Driver
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 px-3 py-2 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only Profile (Admin / Manager / Safety required to add)
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg">{error}</div>
      )}

      {/* Search Bar */}
      <div className="relative bg-neutral-900/60 p-4 border border-neutral-800 rounded-xl">
        <Search className="absolute left-7 top-7 text-neutral-500 w-4 h-4" />
        <input 
          type="text"
          placeholder="Search drivers by name or license number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-10 pr-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 transition"
        />
      </div>

      {/* Grid of Driver Profiles */}
      {loading ? (
        <p className="text-xs text-neutral-500 text-center py-10">Fetching driver telemetry logs...</p>
      ) : filteredDrivers.length === 0 ? (
        <p className="text-xs text-neutral-500 text-center py-10">No operator files matching search terms.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDrivers.map((d) => {
            // Badge color mapping
            let badgeBg = 'bg-neutral-800 text-neutral-400';
            let scoreColor = 'text-neutral-200';
            let icon = <Clock className="w-4 h-4" />;
            
            if (d.safety_badge === 'Excellent') {
              badgeBg = 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
              scoreColor = 'text-emerald-500';
              icon = <ThumbsUp className="w-4 h-4" />;
            } else if (d.safety_badge === 'Good') {
              badgeBg = 'bg-blue-950/60 text-blue-400 border border-blue-800/40';
              scoreColor = 'text-blue-500';
              icon = <Award className="w-4 h-4" />;
            } else {
              badgeBg = 'bg-red-950/60 text-red-400 border border-red-800/40';
              scoreColor = 'text-red-500';
              icon = <AlertTriangle className="w-4 h-4" />;
            }

            // Rest Status calculations
            let restStatus = 'Rested';
            let restColor = 'text-emerald-500';
            if (d.last_trip_end) {
              const gap = (new Date().getTime() - new Date(d.last_trip_end).getTime()) / 3600000;
              if (gap < 8) {
                restStatus = `Fatigued (${Math.round(8 - gap)}h rest needed)`;
                restColor = 'text-red-400 font-bold';
              }
            }

            return (
              <div key={d.id} className="glass rounded-xl p-5 border border-neutral-800 flex flex-col justify-between hover:border-neutral-700 transition relative overflow-hidden group">
                {/* Score badge at top right */}
                <div className="absolute right-4 top-4 text-right">
                  <span className="text-[10px] text-neutral-400 block uppercase font-medium">Safety Rating</span>
                  <span className={`text-2xl font-black ${scoreColor}`}>{d.safety_score}</span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-neutral-100 group-hover:text-brand-400 transition">{d.name}</h3>
                  <span className="text-[10px] text-neutral-400 font-mono block mt-0.5">License: {d.license_no}</span>
                  
                  {/* Safety Badge */}
                  <div className="flex items-center gap-1.5 mt-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 ${badgeBg}`}>
                      {icon} {d.safety_badge}
                    </span>
                  </div>

                  {/* Core Metrics */}
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-neutral-900 text-xs">
                    <div>
                      <span className="text-neutral-500 block">Trips Completed</span>
                      <span className="font-bold text-neutral-200 mt-0.5 block">{d.trips_completed} dispatches</span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block">Rolling Hours (7d)</span>
                      <span className={`font-bold mt-0.5 block ${d.hours_driven_7d > 50 ? 'text-red-400 font-extrabold' : 'text-neutral-200'}`}>
                        {d.hours_driven_7d} Hours
                      </span>
                    </div>
                  </div>

                  {/* Violations & Rest Hours */}
                  <div className="space-y-2 mt-4 pt-4 border-t border-neutral-900 text-xs">
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Violations Count:</span>
                      <span className={`font-bold ${d.violations > 0 ? 'text-red-400' : 'text-neutral-300'}`}>{d.violations}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">Rest Status Gap:</span>
                      <span className={restColor}>{restStatus}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-neutral-800 p-6">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
              <h2 className="text-lg font-bold text-neutral-100">Register Fleet Operator</h2>
              <button 
                onClick={() => setShowAddModal(false)}
                className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="text-xs bg-red-950 border border-red-800 text-red-200 p-3 rounded-lg mb-4">
                {addError}
              </div>
            )}

            <form onSubmit={handleAddDriver} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Driver Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Taylor"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">License Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DL-987654"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">License Expiry Date</label>
                <input
                  type="date"
                  required
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Violations</label>
                  <input
                    type="number"
                    min="0"
                    value={violations}
                    onChange={(e) => setViolations(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Hours Driven (7d)</label>
                  <input
                    type="number"
                    min="0"
                    value={hoursDriven}
                    onChange={(e) => setHoursDriven(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                Register Driver Profile
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
