import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBanner, KpiCard, PageHeader, StatusBadge } from '../components/ui';
import { 
  AlertTriangle, Car, FileWarning, Fuel, MapPin, Route, Users,
  Award, Clock, UserCheck, Wrench, CheckCircle, Navigation, X,
  Sun, Cloud, CloudRain, CloudLightning, Wind, CloudFog
} from 'lucide-react';

const getWeatherIcon = (condition: string) => {
  const cond = condition.toLowerCase();
  if (cond.includes('sunny')) return <Sun className="w-5 h-5 text-amber-400" />;
  if (cond.includes('cloud')) return <Cloud className="w-5 h-5 text-neutral-400" />;
  if (cond.includes('storm')) return <CloudLightning className="w-5 h-5 text-purple-400 animate-bounce" />;
  if (cond.includes('rain')) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (cond.includes('wind')) return <Wind className="w-5 h-5 text-teal-400" />;
  if (cond.includes('fog')) return <CloudFog className="w-5 h-5 text-neutral-300" />;
  return <Cloud className="w-5 h-5 text-neutral-400" />;
};
import { useToast } from '../hooks/useToast';

interface DashboardStats {
  // Fleet manager fields
  vehicle_counts?: Record<string, number>;
  total_vehicles?: number;
  total_drivers?: number;
  total_trips?: number;
  active_trips_count?: number;
  compliance_alerts: Array<{ plate_no: string; message: string }>;
  fuel_anomalies: Array<{ message: string }>;
  severe_notifications?: Array<{
    id: string;
    driver_id: string;
    driver_name: string;
    tag: string;
    description: string;
    location: string;
    created_at: string;
  }>;

  // Driver fields
  role?: string;
  has_profile?: boolean;
  message?: string;
  driver?: {
    id: string;
    name: string;
    license_no: string;
    license_expiry: string;
    violations: number;
    trips_completed: number;
    hours_driven_7d: number;
    safety_score: number;
    safety_badge: string;
  };
  active_trip?: {
    id: string;
    origin: string;
    destination: string;
    scheduled_start: string;
    status: string;
    vehicle_id: string | null;
    driver_id: string | null;
  } | null;
  vehicle?: {
    id: string;
    plate_no: string;
    v_type: string;
    odometer_km: number;
    last_service_km: number;
    last_service_date: string;
    insurance_expiry: string;
    days_left: number;
    status: string;
    engine_hours: number;
    risk_score: number;
    urgency: string;
  } | null;
}

export const Dashboard: React.FC = () => {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [activeWeather, setActiveWeather] = useState<any | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // User RBAC checks
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Driver Profile Setup Form State
  const [profileName, setProfileName] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  // Complete Trip modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [distanceKm, setDistanceKm] = useState(100);
  const [completeLoading, setCompleteLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      const userStr = localStorage.getItem('fleetpulse_user');
      const userObj = userStr ? JSON.parse(userStr) : null;
      setCurrentUser(userObj);

      const [data, trips] = await Promise.all([
        api.get<DashboardStats>('/analytics/dashboard'),
        api.get<any[]>('/trips'),
      ]);
      setStats(data);
      
      if (userObj?.role === 'Driver') {
        if (data.has_profile && data.driver) {
          setProfileName(data.driver.name);
          setLicenseNo(data.driver.license_no);
          setLicenseExpiry(data.driver.license_expiry);
        } else {
          setProfileName(userObj.name || '');
        }
      }

      setRecentTrips(
        trips
          .sort((a, b) => new Date(b.scheduled_start).getTime() - new Date(a.scheduled_start).getTime())
          .slice(0, 10)
      );
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  useEffect(() => {
    if (!stats?.active_trip) {
      setActiveWeather(null);
      return;
    }

    let cancelled = false;
    const { origin, destination, scheduled_start } = stats.active_trip;
    setWeatherLoading(true);
    api.get<any>(`/weather?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&scheduled_date=${encodeURIComponent(scheduled_start)}`)
      .then((data) => {
        if (!cancelled) {
          setActiveWeather(data);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch active route weather:', err);
      })
      .finally(() => {
        if (!cancelled) {
          setWeatherLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [stats?.active_trip?.id]);

  // Driver actions
  const handleStartTrip = async (tripId: string) => {
    try {
      await api.post(`/trips/${tripId}/start`);
      toast('Trip started successfully', 'success');
      fetchDashboardData();
    } catch (err: any) {
      toast(err.message || 'Failed to start trip', 'error');
    }
  };

  const handleDelayTrip = async (tripId: string) => {
    try {
      await api.post(`/trips/${tripId}/delay`);
      toast('Trip flagged as delayed', 'info');
      fetchDashboardData();
    } catch (err: any) {
      toast(err.message || 'Failed to delay trip', 'error');
    }
  };

  const handleRefuseTrip = async (tripId: string) => {
    if (!window.confirm('Are you sure you want to refuse this trip assignment?')) return;
    try {
      await api.post(`/trips/${tripId}/refuse`);
      toast('Trip assignment refused', 'info');
      fetchDashboardData();
    } catch (err: any) {
      toast(err.message || 'Failed to refuse trip', 'error');
    }
  };

  const handleCompleteTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stats?.active_trip) return;
    setCompleteLoading(true);
    try {
      await api.post(`/trips/${stats.active_trip.id}/complete`, { distance_km: distanceKm });
      toast('Trip completed successfully', 'success');
      setShowCompleteModal(false);
      fetchDashboardData();
    } catch (err: any) {
      toast(err.message || 'Failed to complete trip', 'error');
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileError('');
    try {
      await api.post('/drivers/me', {
        name: profileName,
        license_no: licenseNo,
        license_expiry: licenseExpiry
      });
      toast('Driver profile saved successfully', 'success');
      fetchDashboardData();
    } catch (err: any) {
      setProfileError(err.message || 'Failed to save driver profile');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-7 w-48 bg-neutral-800 rounded-lg" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-neutral-900 border border-neutral-800 rounded-xl" />
          ))}
        </div>
        <div className="h-80 bg-neutral-900 border border-neutral-800 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <ErrorBanner title="Telemetry Sync Error" message={error} icon={<AlertTriangle className="w-6 h-6 text-red-400" />} />;
  }

  if (!stats) return null;

  const isDriver = currentUser?.role === 'Driver';

  // Render Driver Dashboard View
  if (isDriver) {
    const hasProfile = stats.has_profile;

    return (
      <div className="space-y-6">
        <PageHeader
          title="Driver Ops Control"
          subtitle="Your profile stats, active assignments, and vehicle health telemetry."
          onRefresh={fetchDashboardData}
          refreshing={loading}
        />

        {!hasProfile ? (
          /* Create Profile Setup Form */
          <div className="glass rounded-xl p-6 border border-neutral-800 max-w-xl mx-auto space-y-6">
            <div className="flex items-center gap-3 border-b border-neutral-800 pb-4">
              <div className="w-10 h-10 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-100">Setup Driver Profile</h2>
                <p className="text-[11px] text-neutral-400 mt-0.5">Please create your operator record to receive dispatch routing.</p>
              </div>
            </div>

            {profileError && (
              <div className="text-xs bg-red-950 border border-red-800 text-red-200 p-3 rounded-lg">
                {profileError}
              </div>
            )}

            <form onSubmit={handleCreateProfile} className="space-y-4 text-xs">
              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Driver Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Robert Taylor"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">Commercial License Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. DL-99201928"
                  value={licenseNo}
                  onChange={(e) => setLicenseNo(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">License Expiration Date</label>
                <input
                  type="date"
                  required
                  value={licenseExpiry}
                  onChange={(e) => setLicenseExpiry(e.target.value)}
                  className="w-full bg-neutral-905 border border-neutral-800 rounded-lg p-2.5 text-neutral-200 focus:outline-none focus:border-brand-500 transition"
                />
              </div>

              <button
                type="submit"
                disabled={profileLoading}
                className="w-full bg-brand-500 hover:bg-brand-600 text-white font-semibold rounded-lg py-2.5 transition text-xs shadow-lg shadow-brand-500/15"
              >
                {profileLoading ? 'Registering operator...' : 'Save Profile Details'}
              </button>
            </form>
          </div>
        ) : (
          /* Main Driver Dashboard Layout */
          <>
            {/* Operator statistics Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard
                label="Safety Score"
                value={`${stats.driver?.safety_score || 100}`}
                icon={<Award className="w-4 h-4 text-brand-500" />}
                footer={
                  <span className={`text-[10px] font-bold ${
                    (stats.driver?.safety_score || 100) >= 85 ? 'text-emerald-400' : (stats.driver?.safety_score || 100) >= 65 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    Badge: {stats.driver?.safety_badge}
                  </span>
                }
              />
              <KpiCard
                label="Completed Trips"
                value={stats.driver?.trips_completed || 0}
                icon={<CheckCircle className="w-4 h-4 text-blue-500" />}
                footer={<span className="text-[10px] text-neutral-500">All-time closed routes</span>}
              />
              <KpiCard
                label="Hours Driven (7d)"
                value={`${stats.driver?.hours_driven_7d || 0}h`}
                icon={<Clock className="w-4 h-4 text-purple-500" />}
                footer={
                  <span className={`text-[10px] ${
                    (stats.driver?.hours_driven_7d || 0) > 50 ? 'text-red-400 font-bold' : 'text-neutral-500'
                  }`}>
                    {(stats.driver?.hours_driven_7d || 0) > 50 ? 'Fatigue penalty active' : 'Safe limits'}
                  </span>
                }
              />
              <KpiCard
                label="Active Violations"
                value={stats.driver?.violations || 0}
                icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
                footer={
                  <span className={`text-[10px] ${
                    (stats.driver?.violations || 0) > 0 ? 'text-red-400 font-bold animate-pulse' : 'text-neutral-500'
                  }`}>
                    {(stats.driver?.violations || 0) > 0 ? 'Critical review pending' : 'No citations logged'}
                  </span>
                }
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Active Trip Details Column */}
              <div className="lg:col-span-7 glass rounded-xl p-5 border border-neutral-800 space-y-4">
                <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Navigation className="w-4 h-4 text-brand-500" /> Active Dispatch Assignment
                </h2>

                {stats.active_trip ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-start bg-neutral-950/40 p-4 border border-neutral-900 rounded-xl space-y-2 flex-col sm:flex-row sm:items-center sm:space-y-0">
                      <div>
                        <span className="font-mono text-[10px] text-brand-400 font-bold">{stats.active_trip.id}</span>
                        <div className="flex items-center gap-1.5 text-xs text-neutral-200 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500" />
                          <span className="font-bold">{stats.active_trip.origin} → {stats.active_trip.destination}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-neutral-400 mt-1">
                          <Clock className="w-3.5 h-3.5 text-neutral-500" />
                          <span>Depart: {new Date(stats.active_trip.scheduled_start).toLocaleString()}</span>
                        </div>
                      </div>
                      <StatusBadge status={stats.active_trip.status} />
                    </div>

                    {/* Active Route Weather Outlook */}
                    {(activeWeather || weatherLoading) && (
                      <div className="bg-neutral-950/40 p-4 border border-neutral-900 rounded-xl space-y-3">
                        <h4 className="text-[10px] font-bold text-neutral-350 uppercase tracking-wider flex items-center gap-1.5">
                          🌦️ Route Weather Safety Outlook
                        </h4>
                        
                        {weatherLoading ? (
                          <p className="text-[10px] text-neutral-500 animate-pulse">Syncing en-route meteorological telemetry...</p>
                        ) : activeWeather ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3 text-center">
                              <div className="bg-neutral-955/50 p-2.5 rounded-lg border border-neutral-900/60">
                                <span className="text-[9px] text-neutral-500 block uppercase font-mono">Origin ({activeWeather.origin.city})</span>
                                <div className="flex items-center justify-center gap-2 mt-1">
                                  {getWeatherIcon(activeWeather.origin.condition)}
                                  <span className="font-mono text-sm font-bold text-neutral-250">{activeWeather.origin.temperature}°C</span>
                                </div>
                                <span className="text-[9px] text-neutral-400 block mt-1">{activeWeather.origin.condition}</span>
                              </div>
                              <div className="bg-neutral-955/50 p-2.5 rounded-lg border border-neutral-900/60">
                                <span className="text-[9px] text-neutral-500 block uppercase font-mono">Dest ({activeWeather.destination.city})</span>
                                <div className="flex items-center justify-center gap-2 mt-1">
                                  {getWeatherIcon(activeWeather.destination.condition)}
                                  <span className="font-mono text-sm font-bold text-neutral-250">{activeWeather.destination.temperature}°C</span>
                                </div>
                                <span className="text-[9px] text-neutral-400 block mt-1">{activeWeather.destination.condition}</span>
                              </div>
                            </div>

                            {/* Alert recommendation en route */}
                            <div className={`p-3 rounded-lg border text-[10px] leading-relaxed ${
                              activeWeather.route_hazard_level === 'High'
                                ? 'bg-red-950/30 border-red-800/60 text-red-200'
                                : activeWeather.route_hazard_level === 'Medium'
                                ? 'bg-amber-950/20 border-amber-800/60 text-amber-200'
                                : 'bg-emerald-950/10 border-emerald-900/30 text-emerald-300'
                            }`}>
                              <div className="font-bold uppercase tracking-wider flex items-center gap-1.5">
                                {activeWeather.route_hazard_level === 'High' ? '🚨' : activeWeather.route_hazard_level === 'Medium' ? '⚠️' : '✅'}
                                <span>Risk Level: {activeWeather.route_hazard_level}</span>
                              </div>
                              <p className="mt-1 font-medium">{activeWeather.recommendations[0]}</p>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {/* Operational controls */}
                    <div className="bg-neutral-950/60 p-4 border border-neutral-900 rounded-xl space-y-3">
                      <h4 className="text-[10px] font-bold text-neutral-300 uppercase tracking-wider">Operator Action console</h4>
                      <div className="flex flex-wrap gap-3">
                        {(stats.active_trip.status === 'Assigned' || stats.active_trip.status === 'Delayed') && (
                          <button
                            onClick={() => handleStartTrip(stats.active_trip!.id)}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
                          >
                            Start Trip
                          </button>
                        )}
                        {(stats.active_trip.status === 'Assigned' || stats.active_trip.status === 'In Transit') && (
                          <button
                            onClick={() => handleDelayTrip(stats.active_trip!.id)}
                            className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs px-4 py-2 rounded-lg font-semibold transition"
                          >
                            Flag Delay
                          </button>
                        )}
                        {(stats.active_trip.status === 'In Transit' || stats.active_trip.status === 'Delayed') && (
                          <button
                            onClick={() => setShowCompleteModal(true)}
                            className="bg-brand-500 hover:bg-brand-600 text-white text-xs px-4 py-2 rounded-lg font-semibold transition"
                          >
                            Complete Route
                          </button>
                        )}
                        {stats.active_trip.status === 'Assigned' && (
                          <button
                            onClick={() => handleRefuseTrip(stats.active_trip!.id)}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-4 py-2 rounded-lg font-semibold transition ml-auto"
                          >
                            Refuse Route
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-neutral-950/30 p-8 text-center text-neutral-500 rounded-xl border border-neutral-900 border-dashed">
                    <p className="text-xs">No active dispatch schedules assigned to you at this time.</p>
                  </div>
                )}
              </div>

              {/* Active Vehicle Details Column */}
              <div className="lg:col-span-5 glass rounded-xl p-5 border border-neutral-800 space-y-4">
                <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-1.5">
                  <Car className="w-4 h-4 text-brand-500" /> Assigned Vehicle Status
                </h2>

                {stats.vehicle ? (
                  <div className="space-y-4">
                    {/* Plate/type */}
                    <div className="flex justify-between items-center bg-neutral-950/20 p-3 rounded-lg border border-neutral-900">
                      <div>
                        <span className="font-mono text-neutral-100 font-bold block">{stats.vehicle.plate_no}</span>
                        <span className="text-[10px] text-neutral-500 block mt-0.5">{stats.vehicle.v_type}</span>
                      </div>
                      <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-semibold px-2 py-0.5 rounded">
                        {stats.vehicle.status}
                      </span>
                    </div>

                    {/* Mileage/Engine metrics */}
                    <div className="grid grid-cols-2 gap-3 text-xs bg-neutral-950/20 p-3 rounded-lg border border-neutral-900">
                      <div>
                        <span className="text-neutral-500 block">Total Odometer</span>
                        <span className="font-mono text-neutral-200 font-bold mt-0.5 block">{stats.vehicle.odometer_km.toLocaleString()} km</span>
                      </div>
                      <div>
                        <span className="text-neutral-500 block">Engine Hours</span>
                        <span className="font-mono text-neutral-200 font-bold mt-0.5 block">{stats.vehicle.engine_hours} Hrs</span>
                      </div>
                    </div>

                    {/* Predictive Maintenance Risk Score card */}
                    <div className="bg-neutral-950/40 p-4 border border-neutral-900 rounded-xl space-y-3">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-neutral-400 flex items-center gap-1.5"><Wrench className="w-3.5 h-3.5 text-neutral-500" /> Maintenance Risk Score</span>
                        <span className={`font-mono font-black ${
                          stats.vehicle.risk_score >= 80 ? 'text-red-500' : stats.vehicle.risk_score >= 50 ? 'text-amber-500' : 'text-emerald-400'
                        }`}>{stats.vehicle.risk_score}%</span>
                      </div>

                      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${
                          stats.vehicle.risk_score >= 80 ? 'bg-status-red' : stats.vehicle.risk_score >= 50 ? 'bg-status-orange' : 'bg-status-green'
                        }`} style={{ width: `${stats.vehicle.risk_score}%` }} />
                      </div>

                      <div className="flex justify-between items-center text-[10px] text-neutral-500">
                        <span>Last Service: {new Date(stats.vehicle.last_service_date).toLocaleDateString()}</span>
                        <span className="font-medium capitalize">Urgency: {stats.vehicle.urgency}</span>
                      </div>
                    </div>

                    {/* Compliance alerts */}
                    {stats.compliance_alerts.length > 0 && (
                      <div className="bg-red-950/30 border border-red-800/80 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-red-400 font-bold uppercase text-[10px] tracking-wider">
                          <FileWarning className="w-3.5 h-3.5" /> Compliance Advisories
                        </div>
                        {stats.compliance_alerts.map((alert, idx) => (
                          <div key={idx} className="bg-neutral-950/40 border border-neutral-900 p-2 rounded text-red-200 font-medium">
                            {alert.message}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Fuel anomalies */}
                    {stats.fuel_anomalies && stats.fuel_anomalies.length > 0 && (
                      <div className="bg-amber-950/20 border border-amber-800/60 rounded-xl p-3 text-xs space-y-2">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase text-[10px] tracking-wider">
                          <Fuel className="w-3.5 h-3.5" /> Fuel Anomaly warnings
                        </div>
                        {stats.fuel_anomalies.map((anom, idx) => (
                          <div key={idx} className="bg-neutral-950/40 border border-neutral-900 p-2 rounded text-amber-200">
                            {anom.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-neutral-950/30 p-8 text-center text-neutral-500 rounded-xl border border-neutral-900 border-dashed">
                    <p className="text-xs">No vehicle currently dispatched with your routes.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* Complete Dispatch Modal */}
        {showCompleteModal && stats?.active_trip && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass w-full max-w-sm rounded-2xl border border-neutral-800 p-6">
              <div className="flex justify-between items-start pb-3 border-b border-neutral-800 mb-4">
                <h2 className="text-sm font-bold text-neutral-100 uppercase">Complete Active Trip</h2>
                <button 
                  onClick={() => setShowCompleteModal(false)}
                  className="bg-neutral-900 hover:bg-neutral-800 p-1.5 rounded-lg border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCompleteTrip} className="space-y-4 text-xs">
                <p className="text-neutral-400 leading-relaxed text-xs">
                  Please log the actual distance covered to complete and close the dispatch record for vehicle <span className="font-mono text-brand-400 font-bold">{stats.active_trip.vehicle_id}</span>.
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
                  {completeLoading ? 'Submitting details...' : 'Submit and Complete'}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Admin / Fleet Manager / Dispatcher View
  const activeCount = stats.vehicle_counts?.['Active'] || 0;
  const onTripCount = stats.vehicle_counts?.['On Trip'] || 0;
  const idleCount = stats.vehicle_counts?.['Idle'] || 0;
  const inShopCount = stats.vehicle_counts?.['In Shop'] || 0;
  const retiredCount = stats.vehicle_counts?.['Retired'] || 0;
  const total = stats.total_vehicles || 1;
  const uptimePct = Math.round(((activeCount + onTripCount) / total) * 100) || 0;
  const pct = (n: number) => Math.round((n / total) * 100) || 0;

  const distribution = [
    { label: 'Active Operation', count: activeCount, color: 'bg-status-green' },
    { label: 'Dispatch Transit', count: onTripCount, color: 'bg-status-blue' },
    { label: 'Idle / Depot', count: idleCount, color: 'bg-neutral-500' },
    { label: 'Maintenance / In Shop', count: inShopCount, color: 'bg-status-orange' },
    { label: 'Retired', count: retiredCount, color: 'bg-status-red' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operations Control"
        subtitle="Real-time status updates and predictive compliance telemetry."
        onRefresh={fetchDashboardData}
        refreshing={loading}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Fleet Vehicles"
          value={stats.total_vehicles || 0}
          icon={<Car className="w-4 h-4 text-brand-500" />}
          footer={
            <div className="flex items-center gap-3 text-[10px] text-neutral-400">
              <span className="text-emerald-500 font-bold">{activeCount + onTripCount} Active</span>
              <span>•</span>
              <span className="text-amber-500 font-bold">{inShopCount} In Shop</span>
            </div>
          }
        />
        <KpiCard
          label="Operators"
          value={stats.total_drivers || 0}
          icon={<Users className="w-4 h-4 text-blue-500" />}
          footer={
            <div className="flex items-center gap-2 text-[10px] text-emerald-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Licensed & Logged
            </div>
          }
        />
        <KpiCard
          label="Active Dispatches"
          value={stats.active_trips_count || 0}
          icon={<Route className="w-4 h-4 text-purple-500" />}
          footer={<span className="text-[10px] text-neutral-400">Total trips: {stats.total_trips || 0}</span>}
        />
        <KpiCard
          label="Compliance Alerts"
          value={stats.compliance_alerts.length + stats.fuel_anomalies.length}
          icon={<AlertTriangle className="w-4 h-4 text-red-500" />}
          footer={
            <div className="flex items-center gap-3 text-[10px] text-neutral-400">
              <span className="text-red-400 font-bold">{stats.compliance_alerts.length} Insurance</span>
              <span>•</span>
              <span className="text-amber-400 font-bold">{stats.fuel_anomalies.length} Fuel</span>
            </div>
          }
        />
      </div>

      {stats.compliance_alerts.length > 0 && (
        <div className="bg-red-950/30 border border-red-800/80 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <FileWarning className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Critical Compliance Advisories</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.compliance_alerts.map((alert, i) => (
              <div key={i} className="text-xs flex items-center gap-2 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900 text-red-300">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="font-mono text-neutral-300 font-bold">{alert.plate_no}:</span>
                <span className="truncate">{alert.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.fuel_anomalies.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-800/60 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Fuel className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Fuel Anomalies</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.fuel_anomalies.map((a, i) => (
              <div key={i} className="text-xs flex items-center gap-2 bg-neutral-950/40 p-2.5 rounded-lg border border-neutral-900 text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="truncate">{a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.severe_notifications && stats.severe_notifications.length > 0 && (
        <div className="bg-red-950/25 border border-red-800/70 rounded-xl p-4">
          <div className="flex items-center gap-2 text-red-400 mb-2">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Severe Driver Alerts</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {stats.severe_notifications.map((notification) => (
              <div key={notification.id} className="bg-neutral-950/40 border border-red-900/40 rounded-lg p-3 text-xs text-red-200">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded-full bg-red-950/80 border border-red-800 text-[10px] font-bold uppercase tracking-wider text-white">🔴</span>
                  <span className="text-[10px] text-neutral-400">{new Date(notification.created_at).toLocaleString()}</span>
                </div>
                <div className="font-semibold text-neutral-100 mb-1">{notification.driver_name}</div>
                <div className="text-red-300 leading-relaxed">{notification.description}</div>
                <div className="mt-2 text-[10px] text-neutral-400">
                  Location: <span className="text-neutral-200">{notification.location}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 glass rounded-xl p-5 border border-neutral-800">
          <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wide mb-4">Fleet Status Distribution</h2>
          <div className="space-y-3">
            {distribution.map(({ label, count, color }) => (
              <div key={label} className="space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-neutral-400 flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${color}`} /> {label}
                  </span>
                  <span className="font-bold text-neutral-200">{count} ({pct(count)}%)</span>
                </div>
                <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
                  <div className={`h-full ${color} rounded-full transition-all duration-700`} style={{ width: `${pct(count)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-neutral-800 flex items-center justify-center">
            <div className="relative w-28 h-28 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="56" cy="56" r="44" className="stroke-neutral-800" strokeWidth="8" fill="transparent" />
                <circle
                  cx="56" cy="56" r="44"
                  className="stroke-brand-500 transition-all duration-1000"
                  strokeWidth="8" fill="transparent"
                  strokeDasharray={2 * Math.PI * 44}
                  strokeDashoffset={2 * Math.PI * 44 * (1 - uptimePct / 100)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute text-center">
                <span className="text-xl font-extrabold text-neutral-100 block">{uptimePct}%</span>
                <span className="text-[9px] text-neutral-400 font-bold uppercase">Uptime</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 glass rounded-xl p-5 border border-neutral-800">
          <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wide mb-4">Recent Dispatches</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-neutral-400 border-b border-neutral-800 uppercase tracking-wide text-[10px] font-semibold">
                  <th className="pb-3 pr-4">Trip ID</th>
                  <th className="pb-3 pr-4">Route</th>
                  <th className="pb-3 pr-4 hidden sm:table-cell">Scheduled</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-900">
                {recentTrips.length === 0 ? (
                  <tr><td colSpan={4} className="py-8 text-center text-neutral-500">No recent trip logs.</td></tr>
                ) : (
                  recentTrips.map((trip) => (
                    <tr key={trip.id} className="hover:bg-neutral-900/40 transition">
                      <td className="py-3 font-mono text-brand-400 font-bold pr-4">{trip.id}</td>
                      <td className="py-3 pr-4">
                        <span className="flex items-center gap-1 text-neutral-200">
                          <MapPin className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                          {trip.origin} → {trip.destination}
                        </span>
                      </td>
                      <td className="py-3 text-neutral-400 hidden sm:table-cell pr-4">
                        {new Date(trip.scheduled_start).toLocaleString()}
                      </td>
                      <td className="py-3"><StatusBadge status={trip.status} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
