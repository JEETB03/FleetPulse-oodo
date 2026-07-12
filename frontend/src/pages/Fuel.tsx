import React, { useEffect, useState } from 'react';
import { api, API_URL } from '../api';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { 
  Plus, 
  AlertTriangle, 
  IndianRupee, 
  TrendingUp, 
  Calendar, 
  X,
  Lock,
  FileText
} from 'lucide-react';
import { useToast } from '../hooks/useToast';

interface FuelLog {
  id: string;
  vehicle_id: string;
  date: string;
  odometer_km: number;
  liters: number;
  cost: number;
  receipt_url?: string | null;
}

interface FuelAnomaly {
  id: string;
  vehicle_id: string;
  date: string;
  liters: number;
  cost: number;
  z_score: number;
  message: string;
}

interface Vehicle {
  id: string;
  plate_no: string;
  odometer_km: number;
}

export const FuelExpense: React.FC = () => {
  const toast = useToast();
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [anomalies, setAnomalies] = useState<FuelAnomaly[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [totalOperatingCost, setTotalOperatingCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Log Fuel Modal state
  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [liters, setLiters] = useState(0);
  const [cost, setCost] = useState(0);
  const [odometerKm, setOdometerKm] = useState(0);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [logLoading, setLogLoading] = useState(false);
  const [logError, setLogError] = useState('');
  const { canWriteFuel } = useCurrentUser();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const logs = await api.get<FuelLog[]>('/fuel');
      setFuelLogs(logs);

      const anomalyLogs = await api.get<FuelAnomaly[]>('/fuel/anomalies');
      setAnomalies(anomalyLogs);

      const vehicleList = await api.get<Vehicle[]>('/vehicles');
      setVehicles(vehicleList);

      const reports = await api.get<any>('/analytics/reports');
      setTotalOperatingCost(reports.total_operating_cost);
    } catch (err: any) {
      setError(err.message || 'Failed to sync fuel expense logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setReceiptFile(e.target.files[0]);
    }
  };

  const handleLogFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    setLogError('');
    setLogLoading(true);
    try {
      let uploadedReceiptUrl = null;

      if (receiptFile) {
        const formData = new FormData();
        formData.append('file', receiptFile);
        
        const token = localStorage.getItem('fleetpulse_token');
        const response = await fetch(`${API_URL}/api/v1/expenses/upload`, {
          method: 'POST',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: formData,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          throw new Error(errBody.detail || 'Receipt file upload failed.');
        }

        const uploadResult = await response.json();
        uploadedReceiptUrl = uploadResult.receipt_url;
      }

      await api.post('/fuel/log', {
        vehicle_id: selectedVehicleId,
        date: logDate,
        odometer_km: odometerKm,
        liters,
        cost,
        receipt_url: uploadedReceiptUrl
      });

      toast('Fuel fill-up transaction logged successfully', 'success');
      setShowLogModal(false);
      setSelectedVehicleId('');
      setLiters(0);
      setCost(0);
      setOdometerKm(0);
      setReceiptFile(null);
      fetchData();
    } catch (err: any) {
      setLogError(err.message || 'Failed to submit fuel transaction');
    } finally {
      setLogLoading(false);
    }
  };

  const handleOpenLogModal = () => {
    setShowLogModal(true);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Fuel & Expenses Ledger</h1>
          <p className="text-xs text-neutral-400 mt-1">Operational expense records and statistical leakage auditing.</p>
        </div>
        <div>
          {canWriteFuel ? (
            <button 
              onClick={handleOpenLogModal}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs px-4 py-2.5 rounded-lg transition font-semibold shadow-lg shadow-brand-500/10"
            >
              <Plus className="w-4 h-4" /> Log Fuel Fill
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 px-3 py-2 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only (Admin / Manager / Finance required to log fuel)
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg">{error}</div>
      )}

      {/* KPI stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass rounded-xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
            <IndianRupee className="w-4 h-4 text-brand-500" />
          </div>
          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">Total Operating Cost</span>
          <span className="text-2xl font-extrabold text-neutral-100 mt-1 block">₹{totalOperatingCost.toLocaleString()}</span>
          <span className="text-[9px] text-neutral-500 block mt-2">Aggregated fuel + service ledger records</span>
        </div>

        <div className="glass rounded-xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">Fuel Log Entries</span>
          <span className="text-2xl font-extrabold text-neutral-100 mt-1 block">{fuelLogs.length}</span>
          <span className="text-[9px] text-neutral-500 block mt-2">Active logging telemetry frequency</span>
        </div>

        <div className="glass rounded-xl p-4 border border-neutral-800 relative overflow-hidden">
          <div className="absolute right-3 top-3 bg-neutral-900/60 p-2 rounded-lg border border-neutral-800">
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider block">Fuel Anomalies flagged</span>
          <span className="text-2xl font-extrabold text-neutral-100 mt-1 block">{anomalies.length}</span>
          <span className="text-[9px] text-neutral-500 block mt-2">Z-score deviations &gt;= 2.0σ</span>
        </div>
      </div>

      {/* Fuel Anomalies warning banners matches wireframe */}
      {anomalies.length > 0 && (
        <div className="bg-red-950/20 border border-red-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="text-xs font-bold uppercase tracking-wider">Potential Fuel Misuse / Leakage warning</span>
          </div>
          <div className="space-y-2">
            {anomalies.map((anom) => (
              <div key={anom.id} className="text-xs flex items-center justify-between bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900/80 text-red-300">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
                  <span>{anom.message}</span>
                </div>
                <span className="text-[10px] font-mono bg-red-950 border border-red-800 px-2 py-0.5 rounded text-red-400 font-bold">
                  {anom.z_score} σ
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fuel Log Table */}
      <div className="glass rounded-xl border border-neutral-800 overflow-hidden">
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/40 flex justify-between items-center">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Fuel transaction Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-neutral-400 border-b border-neutral-800 pb-2 uppercase tracking-wide text-[10px] font-semibold">
                <th className="p-4">Vehicle Plate</th>
                <th className="p-4">Fill-Up Date</th>
                <th className="p-4">Odometer (KM)</th>
                <th className="p-4">Quantity (Liters)</th>
                <th className="p-4">Total Cost</th>
                <th className="p-4">Price / L</th>
                <th className="p-4">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500">Syncing expense database...</td>
                </tr>
              ) : fuelLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500">No fuel records registered.</td>
                </tr>
              ) : (
                fuelLogs.map((log) => {
                  // Check if this log is one of the anomalies to highlight it
                  const isAnomaly = anomalies.some(a => a.vehicle_id === log.vehicle_id && a.date === log.date && a.liters === log.liters);

                  return (
                    <tr 
                      key={log.id} 
                      className={`hover:bg-neutral-900/40 transition ${isAnomaly ? 'bg-red-950/15 border-l-2 border-l-red-500' : ''}`}
                    >
                      <td className="p-4 font-mono font-bold text-neutral-200">
                        {log.vehicle_id}
                        {isAnomaly && (
                          <span className="ml-2 text-[9px] bg-red-950 text-red-400 border border-red-800/40 px-1.5 py-0.2 rounded uppercase font-bold">Anomaly</span>
                        )}
                      </td>
                      <td className="p-4 flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-neutral-500" />{new Date(log.date).toLocaleDateString()}</td>
                      <td className="p-4 font-mono text-neutral-300">{log.odometer_km.toLocaleString()} km</td>
                      <td className="p-4 font-mono font-semibold text-neutral-200">{log.liters} L</td>
                      <td className="p-4 font-mono text-brand-400 font-bold">₹{log.cost.toLocaleString()}</td>
                      <td className="p-4 font-mono text-neutral-400">₹{(log.cost / log.liters).toFixed(2)}</td>
                      <td className="p-4">
                        {log.receipt_url ? (
                          <a 
                            href={`${API_URL}${log.receipt_url}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-[10px] text-brand-400 hover:text-brand-300 font-semibold bg-neutral-950 border border-neutral-800 px-2 py-1.5 rounded hover:underline inline-flex items-center gap-1"
                          >
                            <FileText className="w-3.5 h-3.5" /> View
                          </a>
                        ) : (
                          <span className="text-[10px] text-neutral-600">None</span>
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

      {/* Log Fuel Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-neutral-800 p-6">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
              <h2 className="text-lg font-bold text-neutral-100">Log Fuel Fill-Up</h2>
              <button 
                onClick={() => {
                  setShowLogModal(false);
                  setLogError('');
                  setReceiptFile(null);
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

            <form onSubmit={handleLogFuel} className="space-y-4 text-xs">
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
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-black focus:outline-none focus:border-brand-500 transition"
                >
                  <option value="">-- Choose Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.plate_no}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Fill Date</label>
                <input
                  type="date"
                  required
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Quantity (Liters)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="1"
                    value={liters}
                    onChange={(e) => setLiters(parseFloat(e.target.value) || 0)}
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

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Total Transaction Cost (₹)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={cost}
                  onChange={(e) => setCost(parseInt(e.target.value) || 0)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Upload Expense Receipt (Optional)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="w-full text-neutral-400 text-xs bg-neutral-905 border border-neutral-800 rounded-lg p-2 focus:outline-none focus:border-brand-500 transition file:mr-3 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-neutral-850 file:text-black hover:file:bg-neutral-750 file:cursor-pointer"
                />
              </div>

              <button
                type="submit"
                disabled={logLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                {logLoading ? 'Submitting record...' : 'Save Fuel Log'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
