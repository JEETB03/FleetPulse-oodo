import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  Plus, 
  Wrench, 
  X,
  Lock,
  ArrowRight
} from 'lucide-react';

interface UpcomingService {
  vehicle_id: string;
  plate_no: string;
  v_type: string;
  odometer_km: number;
  last_service_km: number;
  last_service_date: string;
  engine_hours: number;
  risk_score: number;
  urgency: string;
}

interface Vehicle {
  id: string;
  plate_no: string;
  odometer_km: number;
}

export const Maintenance: React.FC = () => {
  const [upcoming, setUpcoming] = useState<UpcomingService[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Log Service Modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState(0);
  const [odometerKm, setOdometerKm] = useState(0);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState('');

  // Current logged in user for permission checks
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpulse_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const list = await api.get<UpcomingService[]>('/maintenance/upcoming');
      setUpcoming(list);

      const vehicleList = await api.get<Vehicle[]>('/vehicles');
      setVehicles(vehicleList);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch maintenance details');
    } finally {
      setLoading(false);
    }
  };

  const handleLogService = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError('');
    setLogLoading(true);
    try {
      await api.post('/maintenance/log', {
        vehicle_id: selectedVehicleId,
        date: serviceDate,
        description,
        cost,
        odometer_km: odometerKm
      });
      setShowLogModal(false);
      // Reset form
      setSelectedVehicleId('');
      setDescription('');
      setCost(0);
      setOdometerKm(0);
      fetchData();
    } catch (err: any) {
      setLogError(err.message || 'Failed to log service record');
    } finally {
      setLogLoading(false);
    }
  };

  const handleOpenLogModal = (vehicleId: string) => {
    setSelectedVehicleId(vehicleId);
    const selectedVeh = vehicles.find(v => v.id === vehicleId);
    if (selectedVeh) {
      setOdometerKm(selectedVeh.odometer_km);
    }
    setShowLogModal(true);
  };

  // Check write access (Admin, Fleet Manager)
  const hasWriteAccess = currentUser && (
    currentUser.role === 'Admin' || 
    currentUser.role === 'Fleet Manager'
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Predictive Maintenance Risk</h1>
          <p className="text-xs text-neutral-400 mt-1">Multi-factor engine risk index monitoring (miles since service + days + engine hours).</p>
        </div>
        <div>
          {hasWriteAccess ? (
            <button 
              onClick={() => setShowLogModal(true)}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs px-4 py-2.5 rounded-lg transition font-semibold shadow-lg shadow-brand-500/10"
            >
              <Plus className="w-4 h-4" /> Log Service Entry
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 px-3 py-2 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only (Admin / Manager required to log service)
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg">{error}</div>
      )}

      {/* Info Alert explaining the formula */}
      <div className="bg-neutral-900/60 p-4 border border-neutral-800 rounded-xl text-xs text-neutral-300 leading-relaxed flex items-start gap-3">
        <Wrench className="w-5 h-5 text-brand-500 flex-shrink-0 mt-0.5" />
        <div>
          <h4 className="font-bold text-neutral-200">How Predictive Risk is Calculated</h4>
          <p className="mt-1 text-neutral-400">
            Unlike static date schedules, the risk engine aggregates three telemetry ratios: 
            <span className="text-brand-400 font-medium"> (km since last service / 10,000)</span>, 
            <span className="text-brand-400 font-medium"> (days since last service / 180)</span>, and 
            <span className="text-brand-400 font-medium"> (engine hours / 500)</span>. 
            The worst ratio represents the vehicle risk index, capped at 150% overdue (100% risk) and sorted descending.
          </p>
        </div>
      </div>

      {/* Upcoming Maintenance List */}
      <div className="glass rounded-xl border border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-neutral-900/40 text-neutral-400 border-b border-neutral-800 pb-2 uppercase tracking-wide text-[10px] font-semibold">
                <th className="p-4">Vehicle Plate</th>
                <th className="p-4">Type</th>
                <th className="p-4">Mileage Details</th>
                <th className="p-4">Engine Hours</th>
                <th className="p-4">Days Since Service</th>
                <th className="p-4 text-center">Risk Score</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="p-4"><div className="h-4 w-16 bg-neutral-800 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-12 bg-neutral-800 rounded"></div></td>
                    <td className="p-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="h-4 w-24 bg-neutral-800 rounded"></div>
                        <div className="h-3 w-32 bg-neutral-850 rounded"></div>
                      </div>
                    </td>
                    <td className="p-4"><div className="h-4 w-12 bg-neutral-800 rounded"></div></td>
                    <td className="p-4"><div className="h-4 w-20 bg-neutral-800 rounded"></div></td>
                    <td className="p-4 text-center"><div className="h-4 w-8 bg-neutral-800 rounded mx-auto"></div></td>
                    <td className="p-4 text-center"><div className="h-5 w-16 bg-neutral-800 rounded-full mx-auto"></div></td>
                    <td className="p-4 text-right"><div className="h-6 w-16 bg-neutral-800 rounded ml-auto"></div></td>
                  </tr>
                ))
              ) : upcoming.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-neutral-500">No vehicle telemetry found.</td>
                </tr>
              ) : (
                upcoming.map((u) => {
                  let urgencyBadge = 'bg-neutral-800 text-neutral-400';
                  let riskColor = 'text-neutral-400';
                  
                  if (u.urgency === 'red') {
                    urgencyBadge = 'bg-red-950/60 text-red-400 border border-red-800/40 font-bold';
                    riskColor = 'text-red-500 font-black';
                  } else if (u.urgency === 'orange') {
                    urgencyBadge = 'bg-amber-950/60 text-amber-400 border border-amber-800/40 font-semibold';
                    riskColor = 'text-amber-500 font-bold';
                  } else {
                    urgencyBadge = 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
                    riskColor = 'text-emerald-400 font-medium';
                  }

                  const days = Math.round((new Date().getTime() - new Date(u.last_service_date).getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <tr key={u.vehicle_id} className="hover:bg-neutral-900/40 transition">
                      <td className="p-4 font-mono font-bold text-neutral-200">{u.plate_no}</td>
                      <td className="p-4">{u.v_type}</td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span>{u.odometer_km.toLocaleString()} km total</span>
                          <span className="text-[10px] text-neutral-500">{(u.odometer_km - u.last_service_km).toLocaleString()} km driven since service</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono">{u.engine_hours} Hrs</td>
                      <td className="p-4">{days} Days ago</td>
                      <td className="p-4 text-center font-mono text-base tracking-tighter">
                        <span className={riskColor}>{u.risk_score}%</span>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase font-semibold tracking-wider ${urgencyBadge}`}>
                          {u.urgency === 'red' ? 'Critical' : u.urgency === 'orange' ? 'Warning' : 'Healthy'}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        {hasWriteAccess ? (
                          <button
                            onClick={() => handleOpenLogModal(u.vehicle_id)}
                            className="bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/20 text-[10px] font-semibold px-2.5 py-1 rounded transition flex items-center gap-1 ml-auto"
                          >
                            Service <ArrowRight className="w-3 h-3" />
                          </button>
                        ) : (
                          <span className="text-[10px] text-neutral-500">Gated</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Service Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-neutral-800 p-6">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
              <h2 className="text-lg font-bold text-neutral-100">Log Maintenance Record</h2>
              <button 
                onClick={() => {
                  setShowLogModal(false);
                  setLogError('');
                }}
                className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {logError && (
              <div className="text-xs bg-red-950 border border-red-800 text-red-200 p-3 rounded-lg mb-4">
                {logError}
              </div>
            )}

            <form onSubmit={handleLogService} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Select Vehicle</label>
                <select
                  required
                  value={selectedVehicleId}
                  onChange={(e) => {
                    setSelectedVehicleId(e.target.value);
                    const sel = vehicles.find(v => v.id === e.target.value);
                    if (sel) setOdometerKm(sel.odometer_km);
                  }}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate_no}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Service Date</label>
                <input
                  type="date"
                  required
                  value={serviceDate}
                  onChange={(e) => setServiceDate(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Service Description</label>
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Engine Oil Flush, brake pads replacement"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Service Cost (₹)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={cost}
                    onChange={(e) => setCost(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Odometer KM</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={odometerKm}
                    onChange={(e) => setOdometerKm(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={logLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                {logLoading ? 'Submitting log...' : 'Save Maintenance Log'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
