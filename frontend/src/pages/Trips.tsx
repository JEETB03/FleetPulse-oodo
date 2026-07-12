import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { PageHeader, ReadOnlyBanner } from '../components/ui';
import { useToast } from '../hooks/useToast';
import { useCurrentUser } from '../hooks/useCurrentUser';
import { 
  Plus, 
  MapPin, 
  User, 
  Car, 
  Calendar, 
  Play, 
  CheckCircle, 
  AlertOctagon, 
  ShieldAlert, 
  X, 
  Sparkles,
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  Wind,
  CloudFog
} from 'lucide-react';

const getWeatherIcon = (condition: string) => {
  const cond = condition.toLowerCase();
  if (cond.includes('sunny')) return <Sun className="w-4 h-4 text-amber-405" />;
  if (cond.includes('cloud')) return <Cloud className="w-4 h-4 text-neutral-400" />;
  if (cond.includes('storm')) return <CloudLightning className="w-4 h-4 text-purple-400 animate-pulse" />;
  if (cond.includes('rain')) return <CloudRain className="w-4 h-4 text-blue-400" />;
  if (cond.includes('wind')) return <Wind className="w-4 h-4 text-teal-400" />;
  if (cond.includes('fog')) return <CloudFog className="w-4 h-4 text-neutral-300" />;
  return <Cloud className="w-4 h-4 text-neutral-400" />;
};

interface Trip {
  id: string;
  origin: string;
  destination: string;
  scheduled_start: string;
  vehicle_id: string | null;
  driver_id: string | null;
  status: string;
  distance_km: number | null;
}

interface Vehicle {
  id: string;
  plate_no: string;
  v_type: string;
  status: string;
}

interface Driver {
  id: string;
  name: string;
  safety_score: number;
}

export const Trips: React.FC = () => {
  const toast = useToast();
  const { canWriteDispatch } = useCurrentUser();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Trip modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [useAutoAssign, setUseAutoAssign] = useState(false);
  const [conflictError, setConflictError] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Complete Trip modal state
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [distanceKm, setDistanceKm] = useState(150);
  const [completeLoading, setCompleteLoading] = useState(false);

  // Weather states
  const [weatherPreview, setWeatherPreview] = useState<any | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');

  const [selectedWeatherTrip, setSelectedWeatherTrip] = useState<Trip | null>(null);
  const [tripWeatherDetails, setTripWeatherDetails] = useState<any | null>(null);
  const [tripWeatherLoading, setTripWeatherLoading] = useState(false);
  const [tripWeatherError, setTripWeatherError] = useState('');

  const vehicleMap = useMemo(() => Object.fromEntries(vehicles.map(v => [v.id, v])), [vehicles]);
  const driverMap = useMemo(() => Object.fromEntries(drivers.map(d => [d.id, d])), [drivers]);

  const labelVehicle = (id: string | null) => id ? (vehicleMap[id]?.plate_no || id) : 'Unassigned';
  const labelDriver = (id: string | null) => id ? (driverMap[id]?.name || id) : 'Unassigned';

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!origin || !destination || !scheduledStart) {
      setWeatherPreview(null);
      setWeatherError('');
      return;
    }

    const handler = setTimeout(async () => {
      setWeatherLoading(true);
      setWeatherError('');
      try {
        const data = await api.get<any>(
          `/weather?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&scheduled_date=${encodeURIComponent(scheduledStart)}`
        );
        setWeatherPreview(data);
      } catch (err: any) {
        setWeatherError(err.message || 'Failed to fetch weather forecast');
        setWeatherPreview(null);
      } finally {
        setWeatherLoading(false);
      }
    }, 600);

    return () => clearTimeout(handler);
  }, [origin, destination, scheduledStart]);

  const handleOpenWeatherModal = async (trip: Trip) => {
    setSelectedWeatherTrip(trip);
    setTripWeatherDetails(null);
    setTripWeatherError('');
    setTripWeatherLoading(true);
    try {
      const data = await api.get<any>(
        `/weather?origin=${encodeURIComponent(trip.origin)}&destination=${encodeURIComponent(trip.destination)}&scheduled_date=${encodeURIComponent(trip.scheduled_start)}`
      );
      setTripWeatherDetails(data);
    } catch (err: any) {
      setTripWeatherError(err.message || 'Failed to fetch weather details.');
    } finally {
      setTripWeatherLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [tripList, vehicleList, driverList] = await Promise.all([
        api.get<Trip[]>('/trips'),
        api.get<Vehicle[]>('/vehicles'),
        api.get<Driver[]>('/drivers'),
      ]);
      setTrips(tripList);
      setVehicles(vehicleList.filter(v => v.status !== 'Retired'));
      setDrivers(driverList);
    } catch (err: any) {
      setError(err.message || 'Failed to sync dispatch records');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError('');
    setAddLoading(true);

    try {
      if (useAutoAssign) {
        // First create trip, then auto-assign it
        const newTrip = await api.post<Trip>('/trips', {
          origin,
          destination,
          scheduled_start: scheduledStart
        });
        
        await api.post(`/trips/${newTrip.id}/auto-assign`);
      } else {
        // Manual assignment
        await api.post('/trips', {
          origin,
          destination,
          scheduled_start: scheduledStart,
          vehicle_id: vehicleId || null,
          driver_id: driverId || null
        });
      }
      setShowAddModal(false);
      // Reset form fields
      setOrigin('');
      setDestination('');
      setScheduledStart('');
      setVehicleId('');
      setDriverId('');
      setUseAutoAssign(false);
      fetchData();
      toast('Trip dispatched successfully', 'success');
    } catch (err: any) {
      // Catch validation conflicts and display in inline red error box
      setConflictError(err.message || 'Dispatch conflict occurred.');
    } finally {
      setAddLoading(false);
    }
  };

  const handleCompleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTrip) return;
    setCompleteLoading(true);
    try {
      await api.post(`/trips/${selectedTrip.id}/complete`, { distance_km: distanceKm });
      setSelectedTrip(null);
      fetchData();
      toast('Trip completed', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to complete trip', 'error');
    } finally {
      setCompleteLoading(false);
    }
  };

  const startTrip = async (tripId: string) => {
    try {
      await api.post(`/trips/${tripId}/start`);
      fetchData();
      toast('Trip started', 'success');
    } catch (err: any) {
      toast(err.message || 'Failed to start trip', 'error');
    }
  };

  const delayTrip = async (tripId: string) => {
    try {
      await api.post(`/trips/${tripId}/delay`);
      fetchData();
      toast('Trip flagged as delayed', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to delay trip', 'error');
    }
  };

  const cancelTrip = async (tripId: string) => {
    try {
      await api.post(`/trips/${tripId}/cancel`);
      fetchData();
      toast('Trip cancelled', 'info');
    } catch (err: any) {
      toast(err.message || 'Failed to cancel trip', 'error');
    }
  };

  const hasWriteAccess = canWriteDispatch;

  // Group trips for Kanban layout
  const groupedTrips = {
    Assigned: trips.filter(t => t.status === 'Assigned'),
    'In Transit': trips.filter(t => t.status === 'In Transit' || t.status === 'Delayed'),
    Completed: trips.filter(t => t.status === 'Completed'),
    Cancelled: trips.filter(t => t.status === 'Cancelled'),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Trip Dispatcher"
        subtitle="Real-time scheduling and fatigue-aware auto-routing console."
        onRefresh={fetchData}
        refreshing={loading}
        action={
          hasWriteAccess ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs px-4 py-2.5 rounded-lg transition font-semibold shadow-lg shadow-brand-500/10"
            >
              <Plus className="w-4 h-4" /> Dispatch New Trip
            </button>
          ) : (
            <ReadOnlyBanner message="Read-only — Dispatcher or Manager required" />
          )
        }
      />

      {error && (
        <div className="text-xs bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg">{error}</div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex flex-col h-full bg-neutral-900/40 p-4 border border-neutral-800/80 rounded-xl min-h-[400px] space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-4 w-28 bg-neutral-850 rounded"></div>
                <div className="h-4 w-6 bg-neutral-850 rounded"></div>
              </div>
              <div className="space-y-3 flex-grow">
                {[1, 2].map((j) => (
                  <div key={j} className="h-28 bg-neutral-950/40 border border-neutral-850/60 p-4 rounded-xl space-y-3">
                    <div className="flex justify-between">
                      <div className="h-3 w-10 bg-neutral-850 rounded"></div>
                      <div className="h-3 w-12 bg-neutral-850 rounded"></div>
                    </div>
                    <div className="h-4 w-32 bg-neutral-850 rounded"></div>
                    <div className="h-3 w-24 bg-neutral-850 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* ASSIGNED COLUMN */}
          <div className="flex flex-col h-full bg-neutral-900/40 p-4 border border-neutral-800/80 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Assigned Schedule</h3>
              <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[10px] font-mono">{groupedTrips.Assigned.length}</span>
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto max-h-[70vh] min-h-[200px]">
              {groupedTrips.Assigned.map((trip) => (
                <div key={trip.id} className="glass p-4 rounded-xl border border-neutral-800 space-y-3 hover:border-neutral-700 transition">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] text-brand-400 font-bold">{trip.id}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWeatherModal(trip);
                        }}
                        className="bg-neutral-950 hover:bg-neutral-900/60 p-1.5 rounded-lg border border-neutral-800/80 text-neutral-400 hover:text-brand-400 transition"
                        title="View Weather Forecast"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                      </button>
                      <span className="text-[9px] bg-neutral-800 text-white px-1.5 py-0.5 rounded border border-neutral-800">Pending</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-200">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{trip.origin} → {trip.destination}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{new Date(trip.scheduled_start).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-neutral-900 pt-2 flex justify-between text-[10px] text-neutral-400">
                    <span className="flex items-center gap-1 truncate"><Car className="w-3 h-3 text-neutral-500 shrink-0" /> {labelVehicle(trip.vehicle_id)}</span>
                    <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 text-neutral-500 shrink-0" /> {labelDriver(trip.driver_id)}</span>
                  </div>

                  {hasWriteAccess && (
                    <div className="border-t border-neutral-900 pt-2 flex gap-2">
                      {trip.vehicle_id && trip.driver_id ? (
                        <>
                          <button 
                            onClick={() => startTrip(trip.id)}
                            className="flex-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] py-1.5 rounded-lg border border-emerald-500/30 transition flex items-center justify-center gap-1 font-semibold"
                          >
                            <Play className="w-3.5 h-3.5" /> Start Trip
                          </button>
                          <button 
                            onClick={() => cancelTrip(trip.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] px-2.5 py-1.5 rounded-lg border border-red-500/30 transition flex items-center justify-center font-semibold"
                            title="Cancel Dispatch"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-amber-500 font-medium w-full text-center">⚠️ Assign vehicle & driver to start</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* IN TRANSIT / DELAYED COLUMN */}
          <div className="flex flex-col h-full bg-neutral-900/40 p-4 border border-neutral-800/80 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">In Transit</h3>
              <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[10px] font-mono">{groupedTrips['In Transit'].length}</span>
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto max-h-[70vh] min-h-[200px]">
              {groupedTrips['In Transit'].map((trip) => (
                <div key={trip.id} className="glass p-4 rounded-xl border border-neutral-800 space-y-3 hover:border-neutral-700 transition">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] text-brand-400 font-bold">{trip.id}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenWeatherModal(trip);
                        }}
                        className="bg-neutral-950 hover:bg-neutral-900/60 p-1.5 rounded-lg border border-neutral-800/80 text-neutral-400 hover:text-brand-400 transition"
                        title="View Weather Forecast"
                      >
                        <Cloud className="w-3.5 h-3.5" />
                      </button>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border text-white ${
                        trip.status === 'Delayed' ? 'bg-amber-950/60 border-amber-800/40' : 'bg-blue-950/60 border-blue-800/40'
                      }`}>
                        {trip.status}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-200">
                      <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{trip.origin} → {trip.destination}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-400">
                      <Calendar className="w-3.5 h-3.5 text-neutral-500" />
                      <span>{new Date(trip.scheduled_start).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-neutral-900 pt-2 flex justify-between text-[10px] text-neutral-400">
                    <span className="flex items-center gap-1 truncate"><Car className="w-3 h-3 text-neutral-500 shrink-0" /> {labelVehicle(trip.vehicle_id)}</span>
                    <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 text-neutral-500 shrink-0" /> {labelDriver(trip.driver_id)}</span>
                  </div>

                  {hasWriteAccess && (
                    <div className="border-t border-neutral-900 pt-2 flex flex-col gap-2">
                      <button 
                        onClick={() => setSelectedTrip(trip)}
                        className="w-full bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 text-[10px] py-1.5 rounded-lg border border-brand-500/30 transition flex items-center justify-center gap-1 font-semibold"
                      >
                        <CheckCircle className="w-3.5 h-3.5" /> Complete Dispatch
                      </button>
                      <div className="flex gap-2 w-full">
                        {trip.status === 'Delayed' ? (
                          <button 
                            onClick={() => startTrip(trip.id)}
                            className="flex-1 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-[10px] py-1.5 rounded-lg border border-blue-500/30 transition flex items-center justify-center gap-1 font-semibold"
                          >
                            <Play className="w-3.5 h-3.5" /> Resume Route
                          </button>
                        ) : (
                          <button 
                            onClick={() => delayTrip(trip.id)}
                            className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] py-1.5 rounded-lg border border-amber-500/30 transition flex items-center justify-center gap-1 font-semibold"
                          >
                            <AlertOctagon className="w-3.5 h-3.5" /> Flag Delay
                          </button>
                        )}
                        <button 
                          onClick={() => cancelTrip(trip.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-[10px] px-2.5 py-1.5 rounded-lg border border-red-500/30 transition flex items-center justify-center font-semibold"
                          title="Cancel Dispatch"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* COMPLETED COLUMN */}
          <div className="flex flex-col h-full bg-neutral-900/40 p-4 border border-neutral-800/80 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Completed</h3>
              <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[10px] font-mono">{groupedTrips.Completed.length}</span>
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto max-h-[70vh] min-h-[200px]">
              {groupedTrips.Completed.map((trip) => (
                <div key={trip.id} className="bg-neutral-950/60 p-4 rounded-xl border border-neutral-900 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] text-neutral-500 font-bold">{trip.id}</span>
                    <span className="text-[9px] bg-emerald-950/60 text-white border border-emerald-800/40 px-1.5 py-0.5 rounded">Completed</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <MapPin className="w-3.5 h-3.5 text-neutral-600" />
                      <span>{trip.origin} → {trip.destination}</span>
                    </div>
                    {trip.distance_km && (
                      <span className="text-[10px] text-brand-400 font-bold block mt-1 font-mono">{trip.distance_km} KM logged</span>
                    )}
                  </div>

                  <div className="border-t border-neutral-900 pt-2 flex justify-between text-[10px] text-neutral-500">
                    <span className="flex items-center gap-1 truncate"><Car className="w-3 h-3 shrink-0" /> {labelVehicle(trip.vehicle_id)}</span>
                    <span className="flex items-center gap-1 truncate"><User className="w-3 h-3 shrink-0" /> {labelDriver(trip.driver_id)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CANCELLED COLUMN */}
          <div className="flex flex-col h-full bg-neutral-900/40 p-4 border border-neutral-800/80 rounded-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">Cancelled</h3>
              <span className="bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded text-[10px] font-mono">{groupedTrips.Cancelled.length}</span>
            </div>
            <div className="space-y-3 flex-grow overflow-y-auto max-h-[70vh] min-h-[200px]">
              {groupedTrips.Cancelled.map((trip) => (
                <div key={trip.id} className="bg-neutral-950/40 p-4 rounded-xl border border-neutral-900 space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-[10px] text-neutral-500 font-bold">{trip.id}</span>
                    <span className="text-[9px] bg-red-950/60 text-white border border-red-800/40 px-1.5 py-0.5 rounded">Cancelled</span>
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                      <MapPin className="w-3.5 h-3.5 text-neutral-600" />
                      <span>{trip.origin} → {trip.destination}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* Complete Dispatch Modal */}
      {selectedTrip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-sm rounded-2xl border border-neutral-800 p-6">
            <div className="flex justify-between items-start pb-3 border-b border-neutral-800 mb-4">
              <h2 className="text-sm font-bold text-neutral-100 uppercase">Complete Dispatch</h2>
              <button 
                onClick={() => setSelectedTrip(null)}
                className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteTrip} className="space-y-4 text-xs">
              <p className="text-neutral-400 leading-relaxed text-xs">
                Log the actual distance covered by vehicle <span className="font-mono text-brand-400 font-bold">{selectedTrip.vehicle_id}</span> to close the dispatch record.
              </p>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Distance Traveled (KM)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(parseInt(e.target.value) || 0)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={completeLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                {completeLoading ? 'Closing dispatch...' : 'Submit and Complete'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Dispatch Modal Form */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-lg rounded-2xl border border-neutral-800 p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start pb-4 border-b border-neutral-800 mb-4">
              <h2 className="text-lg font-bold text-neutral-100">Dispatch Fleet Cargo</h2>
              <button 
                onClick={() => {
                  setShowAddModal(false);
                  setConflictError('');
                }}
                className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Red Conflict Alert Box matches wireframe */}
            {conflictError && (
              <div className="flex items-start gap-3 bg-red-950/80 border border-red-800 text-red-200 text-xs p-4 rounded-xl mb-4 relative animate-shake">
                <ShieldAlert className="w-5 h-5 flex-shrink-0 text-red-400 mt-0.5" />
                <div>
                  <h4 className="font-bold uppercase tracking-wider text-red-300">Dispatch Conflict Detected</h4>
                  <p className="mt-1 text-red-200">{conflictError}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleCreateTrip} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Trip Origin</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Warehouse A"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Trip Destination</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Client Site Z"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Scheduled Departure</label>
                <input
                  type="datetime-local"
                  required
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              {/* Weather Forecast Preview */}
              {(origin || destination || scheduledStart) && (
                <div className="bg-neutral-950/60 border border-neutral-900 rounded-xl p-4 space-y-3">
                  <span className="text-[10px] font-bold text-neutral-350 uppercase tracking-wider flex items-center gap-1">
                    🌦️ Weather Route Outlook
                  </span>
                  {weatherLoading ? (
                    <p className="text-[10px] text-neutral-500 animate-pulse">Fetching en-route meteorological data...</p>
                  ) : weatherError ? (
                    <p className="text-[10px] text-red-400">⚠️ {weatherError}</p>
                  ) : weatherPreview ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-neutral-900/50 p-2.5 rounded-lg border border-neutral-800/80 text-center">
                          <span className="text-[9px] text-neutral-500 block uppercase font-semibold">Origin Weather</span>
                          <span className="font-semibold text-neutral-200 block text-[11px] mt-1 truncate">{weatherPreview.origin.city}</span>
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            {getWeatherIcon(weatherPreview.origin.condition)}
                            <span className="font-mono text-xs font-bold text-neutral-100">{weatherPreview.origin.temperature}°C</span>
                          </div>
                          <span className="text-[9px] text-neutral-400 block mt-1">{weatherPreview.origin.condition}</span>
                        </div>
                        <div className="bg-neutral-900/50 p-2.5 rounded-lg border border-neutral-800/80 text-center">
                          <span className="text-[9px] text-neutral-500 block uppercase font-semibold">Dest Weather</span>
                          <span className="font-semibold text-neutral-200 block text-[11px] mt-1 truncate">{weatherPreview.destination.city}</span>
                          <div className="flex items-center justify-center gap-1.5 mt-1">
                            {getWeatherIcon(weatherPreview.destination.condition)}
                            <span className="font-mono text-xs font-bold text-neutral-100">{weatherPreview.destination.temperature}°C</span>
                          </div>
                          <span className="text-[9px] text-neutral-400 block mt-1">{weatherPreview.destination.condition}</span>
                        </div>
                      </div>
                      
                      {/* Route hazard level warning */}
                      <div className={`p-2.5 rounded-lg text-[10px] leading-relaxed border ${
                        weatherPreview.route_hazard_level === 'High' 
                          ? 'bg-red-950/40 border-red-800/60 text-red-200' 
                          : weatherPreview.route_hazard_level === 'Medium'
                          ? 'bg-amber-950/40 border-amber-800/60 text-amber-200'
                          : 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                      }`}>
                        <div className="font-bold uppercase tracking-wider flex items-center gap-1">
                          {weatherPreview.route_hazard_level === 'High' && <span>🚨 Critical Risk</span>}
                          {weatherPreview.route_hazard_level === 'Medium' && <span>⚠️ Moderate Risk</span>}
                          {weatherPreview.route_hazard_level === 'Low' && <span>✅ Optimal Route</span>}
                          <span>• {weatherPreview.route_hazard_level} Hazard Level</span>
                        </div>
                        <div className="mt-1 font-medium">{weatherPreview.recommendations[0]}</div>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}

              {/* Assignment Controls */}
              <div className="bg-neutral-950/60 p-4 border border-neutral-900 rounded-xl space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-brand-500" /> Assignment Engine
                  </span>
                  
                  {/* Toggle button */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useAutoAssign}
                      onChange={(e) => setUseAutoAssign(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-500 peer-checked:after:bg-neutral-900"></div>
                    <span className="ml-2 text-[10px] font-medium text-neutral-400 uppercase">Auto Assign</span>
                  </label>
                </div>

                {!useAutoAssign ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">Select Vehicle</label>
                      <select
                        value={vehicleId}
                        onChange={(e) => setVehicleId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Select --</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id} className="bg-neutral-900 text-white">{v.plate_no} ({v.v_type} - {v.status})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-semibold text-neutral-400 uppercase mb-1">Select Driver</label>
                      <select
                        value={driverId}
                        onChange={(e) => setDriverId(e.target.value)}
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-lg p-2 text-white"
                      >
                        <option value="">-- Select --</option>
                        {drivers.map(d => (
                          <option key={d.id} value={d.id} className="bg-neutral-900 text-white">{d.name} (Score: {d.safety_score})</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="text-[10px] text-brand-400 leading-normal font-medium bg-neutral-900/80 p-2.5 rounded border border-brand-500/10">
                    ℹ️ Smart Dispatch will automatically allocate the available driver with the highest safety score and the available vehicle with the least mileage since its last service.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={addLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                {addLoading ? 'Dispatching...' : 'Dispatch Fleet'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Trip Weather Details Modal */}
      {selectedWeatherTrip && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass w-full max-w-md rounded-2xl border border-neutral-800 p-6">
            <div className="flex justify-between items-start pb-3 border-b border-neutral-800 mb-4">
              <div>
                <span className="text-[10px] text-neutral-500 font-mono font-bold uppercase tracking-wider">Meteorological Intel</span>
                <h2 className="text-sm font-bold text-neutral-100 uppercase mt-0.5">Weather Outlook en Route</h2>
              </div>
              <button 
                onClick={() => setSelectedWeatherTrip(null)}
                className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {tripWeatherLoading ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2">
                <div className="w-6 h-6 border-2 border-t-brand-500 border-neutral-800 rounded-full animate-spin" />
                <p className="text-[10px] text-neutral-500 animate-pulse">Syncing satellite telemetry forecast...</p>
              </div>
            ) : tripWeatherError ? (
              <div className="text-xs bg-red-950 border border-red-800 text-red-200 p-3 rounded-lg">
                {tripWeatherError}
              </div>
            ) : tripWeatherDetails ? (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between bg-neutral-950/40 p-3 border border-neutral-900 rounded-xl">
                  <div>
                    <span className="text-neutral-500 text-[10px] block uppercase font-mono">Trip ID</span>
                    <span className="font-mono text-brand-400 font-bold">{selectedWeatherTrip.id}</span>
                  </div>
                  <div>
                    <span className="text-neutral-550 text-[10px] block uppercase font-mono text-right">Route</span>
                    <span className="font-semibold text-neutral-200">{selectedWeatherTrip.origin} → {selectedWeatherTrip.destination}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-850 relative overflow-hidden">
                    <span className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider block">Origin Weather</span>
                    <span className="text-xs font-bold text-neutral-100 mt-1 block truncate">{tripWeatherDetails.origin.city}</span>
                    <div className="flex items-center gap-2 mt-2">
                      {getWeatherIcon(tripWeatherDetails.origin.condition)}
                      <span className="font-mono text-base font-extrabold text-neutral-200">{tripWeatherDetails.origin.temperature}°C</span>
                    </div>
                    <span className="text-[10px] text-neutral-550 block mt-2">{tripWeatherDetails.origin.condition}</span>
                    <p className="text-[9px] text-neutral-400 mt-2 border-t border-neutral-800/80 pt-2 leading-relaxed italic">{tripWeatherDetails.origin.advisory}</p>
                  </div>

                  <div className="bg-neutral-900/60 p-3 rounded-xl border border-neutral-850 relative overflow-hidden">
                    <span className="text-[9px] text-neutral-400 font-semibold uppercase tracking-wider block">Destination Weather</span>
                    <span className="text-sm font-bold text-neutral-100 mt-1 block truncate">{tripWeatherDetails.destination.city}</span>
                    <div className="flex items-center gap-2 mt-2">
                      {getWeatherIcon(tripWeatherDetails.destination.condition)}
                      <span className="font-mono text-base font-extrabold text-neutral-200">{tripWeatherDetails.destination.temperature}°C</span>
                    </div>
                    <span className="text-[10px] text-neutral-550 block mt-2">{tripWeatherDetails.destination.condition}</span>
                    <p className="text-[9px] text-neutral-400 mt-2 border-t border-neutral-800/80 pt-2 leading-relaxed italic">{tripWeatherDetails.destination.advisory}</p>
                  </div>
                </div>

                <div className={`p-3 rounded-xl border ${
                  tripWeatherDetails.route_hazard_level === 'High'
                    ? 'bg-red-950/30 border-red-800/60 text-red-200'
                    : tripWeatherDetails.route_hazard_level === 'Medium'
                    ? 'bg-amber-950/20 border-amber-800/60 text-amber-200'
                    : 'bg-emerald-950/10 border-emerald-900/30 text-emerald-300'
                }`}>
                  <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                    {tripWeatherDetails.route_hazard_level === 'High' ? '🔴' : tripWeatherDetails.route_hazard_level === 'Medium' ? '🟡' : '🟢'}
                    <span>Route Risk Outlook: {tripWeatherDetails.route_hazard_level}</span>
                  </div>
                  <p className="mt-1 text-[10px] leading-relaxed font-medium">{tripWeatherDetails.recommendations[0]}</p>
                </div>

                <button
                  onClick={() => setSelectedWeatherTrip(null)}
                  className="w-full bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-850 font-semibold rounded-lg py-2 transition text-xs"
                >
                  Close Intel
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
