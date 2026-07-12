import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { ErrorBanner, KpiCard, PageHeader, StatusBadge } from '../components/ui';
import { AlertTriangle, Car, FileWarning, Fuel, MapPin, Route, Users } from 'lucide-react';

interface DashboardStats {
  vehicle_counts: Record<string, number>;
  total_vehicles: number;
  total_drivers: number;
  total_trips: number;
  active_trips_count: number;
  compliance_alerts: Array<{ plate_no: string; message: string }>;
  fuel_anomalies: Array<{ message: string }>;
  severe_notifications: Array<{
    id: string;
    driver_id: string;
    driver_name: string;
    tag: string;
    description: string;
    location: string;
    created_at: string;
  }>;
}

export const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentTrips, setRecentTrips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const [data, trips] = await Promise.all([
        api.get<DashboardStats>('/analytics/dashboard'),
        api.get<any[]>('/trips'),
      ]);
      setStats(data);
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

  const activeCount = stats.vehicle_counts['Active'] || 0;
  const onTripCount = stats.vehicle_counts['On Trip'] || 0;
  const idleCount = stats.vehicle_counts['Idle'] || 0;
  const inShopCount = stats.vehicle_counts['In Shop'] || 0;
  const retiredCount = stats.vehicle_counts['Retired'] || 0;
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
          value={stats.total_vehicles}
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
          value={stats.total_drivers}
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
          value={stats.active_trips_count}
          icon={<Route className="w-4 h-4 text-purple-500" />}
          footer={<span className="text-[10px] text-neutral-400">Total trips: {stats.total_trips}</span>}
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

      {stats.severe_notifications?.length > 0 && (
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
                          <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
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
