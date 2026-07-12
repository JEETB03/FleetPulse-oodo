import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  Plus, 
  Search, 
  History, 
  X, 
  Info, 
  Lock 
} from 'lucide-react';

interface Vehicle {
  id: string;
  plate_no: string;
  v_type: string;
  odometer_km: number;
  last_service_km: number;
  last_service_date: string;
  insurance_expiry: string;
  status: string;
  engine_hours: number;
}


export const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selected vehicle details modal
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Add vehicle modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [plateNo, setPlateNo] = useState('');
  const [vType, setVType] = useState('Bus');
  const [odometer, setOdometer] = useState(0);
  const [lastServiceKm, setLastServiceKm] = useState(0);
  const [lastServiceDate, setLastServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [insuranceExpiry, setInsuranceExpiry] = useState(new Date().toISOString().split('T')[0]);
  const [engineHours, setEngineHours] = useState(0);
  const [addError, setAddError] = useState('');

  // User RBAC permission checker
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpulse_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchVehicles();
  }, []);

  const fetchVehicles = async () => {
    try {
      setLoading(true);
      const data = await api.get<Vehicle[]>('/vehicles');
      setVehicles(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch vehicles');
    } finally {
      setLoading(false);
    }
  };

  const fetchVehicleHistory = async (vId: string) => {
    try {
      setHistoryLoading(true);
      const data = await api.get<any>(`/vehicles/${vId}/history`);
      setHistory(data);
    } catch (err: any) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleRowClick = (v: Vehicle) => {
    setSelectedVehicle(v);
    fetchVehicleHistory(v.id);
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    try {
      await api.post('/vehicles', {
        plate_no: plateNo,
        v_type: vType,
        odometer_km: odometer,
        last_service_km: lastServiceKm,
        last_service_date: lastServiceDate,
        insurance_expiry: insuranceExpiry,
        engine_hours: engineHours,
        status: 'Idle'
      });
      setShowAddModal(false);
      // Reset form
      setPlateNo('');
      setOdometer(0);
      setLastServiceKm(0);
      setEngineHours(0);
      fetchVehicles();
    } catch (err: any) {
      setAddError(err.message || 'Failed to create vehicle');
    }
  };

  // Check write access (Admin or Fleet Manager)
  const hasWriteAccess = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Fleet Manager');

  // Filter vehicles
  const filteredVehicles = vehicles.filter(v => {
    const matchesSearch = v.plate_no.toLowerCase().includes(search.toLowerCase()) || v.v_type.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter ? v.v_type === typeFilter : true;
    const matchesStatus = statusFilter ? v.status === statusFilter : true;
    return matchesSearch && matchesType && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Vehicle Registry</h1>
          <p className="text-xs text-neutral-400 mt-1">Registry of all corporate buses, vans, and cargo trucks.</p>
        </div>
        <div>
          {hasWriteAccess ? (
            <button 
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs px-4 py-2.5 rounded-lg transition font-semibold shadow-lg shadow-brand-500/10"
            >
              <Plus className="w-4 h-4" /> Add Vehicle
            </button>
          ) : (
            <div className="flex items-center gap-1.5 bg-neutral-900 border border-neutral-800 text-[10px] text-neutral-400 px-3 py-2 rounded-lg">
              <Lock className="w-3.5 h-3.5 text-amber-500" /> Read-Only Profile (Admin / Manager required to add)
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="text-xs bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg">{error}</div>
      )}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-neutral-900/60 p-4 border border-neutral-800 rounded-xl">
        <div className="relative md:col-span-2">
          <Search className="absolute left-3 top-3 text-neutral-500 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search by license plate or vehicle type..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg pl-9 pr-4 py-2.5 text-xs text-neutral-200 focus:outline-none focus:border-brand-500 transition"
          />
        </div>
        <div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-300 focus:outline-none focus:border-brand-500 transition"
          >
            <option value="">All Vehicle Types</option>
            <option value="Bus">Bus</option>
            <option value="Van">Van</option>
            <option value="Truck">Truck</option>
          </select>
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-2.5 text-xs text-neutral-300 focus:outline-none focus:border-brand-500 transition"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="On Trip">On Trip</option>
            <option value="Idle">Idle</option>
            <option value="In Shop">In Shop</option>
            <option value="Retired">Retired</option>
          </select>
        </div>
      </div>

      {/* Table grid */}
      <div className="glass rounded-xl border border-neutral-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-neutral-900/40 text-neutral-400 border-b border-neutral-800 pb-2 uppercase tracking-wide text-[10px] font-semibold">
                <th className="p-4">License Plate</th>
                <th className="p-4">Type</th>
                <th className="p-4">Odometer (KM)</th>
                <th className="p-4">Last Service Date</th>
                <th className="p-4">Insurance Exp.</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500">
                    Syncing registry telemetry...
                  </td>
                </tr>
              ) : filteredVehicles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-neutral-500">
                    No vehicles found matching search filters.
                  </td>
                </tr>
              ) : (
                filteredVehicles.map((v) => {
                  let statusColor = 'bg-neutral-800 text-neutral-300';
                  if (v.status === 'Active') statusColor = 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40';
                  if (v.status === 'On Trip') statusColor = 'bg-blue-950/60 text-blue-400 border border-blue-800/40';
                  if (v.status === 'Idle') statusColor = 'bg-neutral-800 text-neutral-300 border border-neutral-700/40';
                  if (v.status === 'In Shop') statusColor = 'bg-amber-950/60 text-amber-400 border border-amber-800/40';
                  if (v.status === 'Retired') statusColor = 'bg-red-950/60 text-red-400 border border-red-800/40';

                  return (
                    <tr 
                      key={v.id} 
                      onClick={() => handleRowClick(v)}
                      className="hover:bg-neutral-900/40 transition cursor-pointer group"
                    >
                      <td className="p-4 font-mono font-bold text-neutral-200 group-hover:text-brand-400 transition">{v.plate_no}</td>
                      <td className="p-4">{v.v_type}</td>
                      <td className="p-4 font-mono text-neutral-300">{v.odometer_km.toLocaleString()} km</td>
                      <td className="p-4 text-neutral-400">{new Date(v.last_service_date).toLocaleDateString()}</td>
                      <td className="p-4 text-neutral-400">{new Date(v.insurance_expiry).toLocaleDateString()}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
                          {v.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-[10px] text-brand-400 hover:text-brand-300 font-semibold group-hover:underline flex items-center gap-1">
                          <Info className="w-3.5 h-3.5" /> Details
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Vehicle Detail History Modal */}
      {selectedVehicle && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-4xl rounded-2xl border border-neutral-800 max-h-[85vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-6">
              <div>
                <span className="text-[10px] text-brand-400 font-mono font-bold uppercase tracking-wider">{selectedVehicle.v_type} Registry Details</span>
                <h2 className="text-xl font-bold text-neutral-100 flex items-center gap-2 mt-1">
                  License Plate: <span className="font-mono text-brand-400">{selectedVehicle.plate_no}</span>
                </h2>
              </div>
              <button 
                onClick={() => setSelectedVehicle(null)}
                className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              {/* Telemetry metadata */}
              <div className="bg-neutral-900/60 p-4 border border-neutral-800 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wide border-b border-neutral-800 pb-2">Telemetry Status</h3>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Total Mileage:</span>
                  <span className="font-mono text-neutral-200 font-bold">{selectedVehicle.odometer_km.toLocaleString()} KM</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Engine Hours:</span>
                  <span className="font-mono text-neutral-200">{selectedVehicle.engine_hours} Hours</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Current Status:</span>
                  <span className="font-semibold text-brand-400">{selectedVehicle.status}</span>
                </div>
              </div>

              <div className="bg-neutral-900/60 p-4 border border-neutral-800 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wide border-b border-neutral-800 pb-2">Service Status</h3>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Last Service Odometer:</span>
                  <span className="font-mono text-neutral-200">{selectedVehicle.last_service_km.toLocaleString()} KM</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Last Service Date:</span>
                  <span className="text-neutral-200">{new Date(selectedVehicle.last_service_date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Next Service (Est):</span>
                  <span className="text-neutral-200">{(selectedVehicle.last_service_km + 10000).toLocaleString()} KM</span>
                </div>
              </div>

              <div className="bg-neutral-900/60 p-4 border border-neutral-800 rounded-xl space-y-3">
                <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wide border-b border-neutral-800 pb-2">Compliance Limits</h3>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Insurance Expiry:</span>
                  <span className="text-neutral-200">{new Date(selectedVehicle.insurance_expiry).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-400">Renewal Window:</span>
                  {new Date(selectedVehicle.insurance_expiry).getTime() - new Date().getTime() < 30 * 24 * 60 * 60 * 1000 ? (
                    <span className="font-bold text-red-400">ACTION REQUIRED</span>
                  ) : (
                    <span className="text-emerald-500 font-semibold">VALID</span>
                  )}
                </div>
              </div>
            </div>

            {/* History logs */}
            <div className="space-y-6">
              <div className="border-t border-neutral-800 pt-6">
                <h3 className="text-sm font-bold text-neutral-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-500" /> Vehicle Operations History
                </h3>

                {historyLoading ? (
                  <p className="text-xs text-neutral-500 text-center py-6">Syncing log records...</p>
                ) : !history ? (
                  <p className="text-xs text-neutral-500 text-center py-6">No records loaded.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Fuel Fill-ups */}
                    <div className="glass rounded-xl p-4 border border-neutral-800/80">
                      <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wide mb-3">Recent Fuel Entries</h4>
                      {history.fuel_logs.length === 0 ? (
                        <p className="text-xs text-neutral-500 py-2">No fuel log entries for this vehicle.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {history.fuel_logs.map((fl: any) => (
                            <div key={fl.id} className="text-xs flex justify-between bg-neutral-950/40 p-2 rounded border border-neutral-900">
                              <div>
                                <span className="text-neutral-300 font-semibold">{fl.liters} Liters</span>
                                <span className="text-[10px] text-neutral-500 block">{new Date(fl.date).toLocaleDateString()}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-neutral-300 font-mono">₹{fl.cost}</span>
                                <span className="text-[10px] text-neutral-500 block">{fl.odometer_km} km</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Service Logs */}
                    <div className="glass rounded-xl p-4 border border-neutral-800/80">
                      <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wide mb-3">Service Log entries</h4>
                      {history.service_logs.length === 0 ? (
                        <p className="text-xs text-neutral-500 py-2">No service/repair entries logged.</p>
                      ) : (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {history.service_logs.map((sl: any) => (
                            <div key={sl.id} className="text-xs bg-neutral-950/40 p-2.5 rounded border border-neutral-900">
                              <div className="flex justify-between font-semibold">
                                <span className="text-neutral-300">{sl.description}</span>
                                <span className="text-brand-400">₹{sl.cost}</span>
                              </div>
                              <div className="flex justify-between text-[10px] text-neutral-500 mt-1">
                                <span>Odometer: {sl.odometer_km} km</span>
                                <span>{new Date(sl.date).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-2xl border border-neutral-800 p-6">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
              <h2 className="text-lg font-bold text-neutral-100">Add Vehicle to Registry</h2>
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

            <form onSubmit={handleAddVehicle} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">License Plate No.</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. WB-01-AB-1234"
                    value={plateNo}
                    onChange={(e) => setPlateNo(e.target.value)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Vehicle Type</label>
                  <select
                    value={vType}
                    onChange={(e) => setVType(e.target.value)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  >
                    <option value="Bus">Bus</option>
                    <option value="Van">Van</option>
                    <option value="Truck">Truck</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Odometer Reading (KM)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={odometer}
                    onChange={(e) => setOdometer(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Engine Hours</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={engineHours}
                    onChange={(e) => setEngineHours(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Last Service KM</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={lastServiceKm}
                    onChange={(e) => setLastServiceKm(parseInt(e.target.value) || 0)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Last Service Date</label>
                  <input
                    type="date"
                    required
                    value={lastServiceDate}
                    onChange={(e) => setLastServiceDate(e.target.value)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Insurance Expiry Date</label>
                <input
                  type="date"
                  required
                  value={insuranceExpiry}
                  onChange={(e) => setInsuranceExpiry(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                Register Vehicle
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
