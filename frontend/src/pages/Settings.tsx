import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { 
  ShieldAlert, 
  Grid, 
  Users, 
  UserCheck,
  Save,
  RefreshCw
} from 'lucide-react';

type PermissionLevel = 'Read' | 'Write' | 'No Access';

interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PermissionRow {
  module: string;
  admin: PermissionLevel;
  manager: PermissionLevel;
  dispatcher: PermissionLevel;
  safety: PermissionLevel;
  finance: PermissionLevel;
  driver: PermissionLevel;
}

const MODULE_LABELS: Record<string, string> = {
  vehicles: 'Vehicles',
  drivers: 'Drivers',
  dispatch: 'Dispatch',
  maintenance: 'Maintenance',
  fuel_expense: 'Fuel & Expense',
  reports: 'Reports',
  settings: 'Settings',
};

const MODULE_ORDER = ['vehicles', 'drivers', 'dispatch', 'maintenance', 'fuel_expense', 'reports', 'settings'];

const ROLE_COLUMNS: Array<{ key: keyof Omit<PermissionRow, 'module'>; label: string }> = [
  { key: 'admin', label: 'Admin' },
  { key: 'manager', label: 'Fleet Manager' },
  { key: 'dispatcher', label: 'Dispatcher' },
  { key: 'safety', label: 'Safety Officer' },
  { key: 'finance', label: 'Finance Analyst' },
  { key: 'driver', label: 'Driver' },
];

const PERMISSION_OPTIONS: PermissionLevel[] = ['Read', 'Write', 'No Access'];

export const Settings: React.FC = () => {
  const [users, setUsers] = useState<SeedUser[]>([]);
  const [permissionsGrid, setPermissionsGrid] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  // Current logged in user for permission checks
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpulse_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchSettingsData();
  }, []);

  const fetchSettingsData = async () => {
    try {
      setLoading(true);
      setError('');
      const [userList, permissionList] = await Promise.all([
        api.get<SeedUser[]>('/users'),
        api.get<PermissionRow[]>('/settings/permissions'),
      ]);

      setUsers(userList);
      setPermissionsGrid(permissionList.sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module)));
    } catch (err: any) {
      setError(err.message || 'Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (module: string, column: keyof Omit<PermissionRow, 'module'>, value: PermissionLevel) => {
    setPermissionsGrid((previous) =>
      previous.map((row) => (row.module === module ? { ...row, [column]: value } : row))
    );
  };

  const savePermissions = async () => {
    try {
      setSaving(true);
      setError('');
      const payload = permissionsGrid.map(({ module, admin, manager, dispatcher, safety, finance, driver }) => ({
        module,
        admin,
        manager,
        dispatcher,
        safety,
        finance,
        driver,
      }));
      const updated = await api.put<PermissionRow[]>('/settings/permissions', { permissions: payload });
      setPermissionsGrid(updated.sort((a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module)));
    } catch (err: any) {
      setError(err.message || 'Failed to save permission changes');
    } finally {
      setSaving(false);
    }
  };

  // Check write access (Admin only)
  const isAdmin = currentUser && currentUser.role === 'Admin';

  if (!isAdmin) {
    return (
      <div className="p-6 bg-red-950/40 border border-red-800 rounded-2xl flex items-center gap-3 text-red-200">
        <ShieldAlert className="w-6 h-6 text-red-400 font-bold" />
        <div>
          <h3 className="font-bold text-neutral-100">Access Denied</h3>
          <p className="text-xs text-red-300 mt-1">
            Role "{currentUser?.role || 'Guest'}" lacks authorization for system configuration settings. Admin credentials required.
          </p>
        </div>
      </div>
    );
  }

  // RBAC grid data matching wireframe specifications
  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-100">Settings & RBAC</h1>
        <p className="text-xs text-neutral-400 mt-1">System authority configuration and role-based permissions matrix overrides.</p>
      </div>

      {/* Role Permission Grid matches wireframe */}
      <div className="glass rounded-xl p-5 border border-neutral-800 space-y-4">
        <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-1.5">
          <Grid className="w-4 h-4 text-brand-500" /> Role x Module Permission Matrix
        </h2>
        <p className="text-xs text-neutral-400">
          Global access control mapping for write/read clearances across application modules.
        </p>

        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={fetchSettingsData}
            disabled={loading || saving}
            className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 text-xs px-3 py-2 rounded-lg text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Reload
          </button>
          <button
            onClick={savePermissions}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-xs px-3 py-2 rounded-lg transition font-semibold shadow-lg shadow-brand-500/10 disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-pulse' : ''}`} />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {error && (
          <div className="text-xs bg-red-950/60 border border-red-800 text-red-200 p-3 rounded-lg">{error}</div>
        )}

        <div className="overflow-x-auto border border-neutral-800/80 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-neutral-900/60 text-neutral-400 border-b border-neutral-800 pb-2 uppercase tracking-wide text-[10px] font-bold">
                <th className="p-3">Module</th>
                <th className="p-3 text-center">Admin</th>
                <th className="p-3 text-center">Fleet Manager</th>
                <th className="p-3 text-center">Dispatcher</th>
                <th className="p-3 text-center">Safety Officer</th>
                <th className="p-3 text-center">Finance Analyst</th>
                <th className="p-3 text-center">Driver</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                <tr>
                  <td className="p-4 text-neutral-500" colSpan={7}>Loading permission matrix...</td>
                </tr>
              ) : permissionsGrid.map((row) => (
                <tr key={row.module} className="hover:bg-neutral-900/20 transition">
                  <td className="p-3 font-semibold text-neutral-300">{MODULE_LABELS[row.module] || row.module}</td>

                  {ROLE_COLUMNS.map(({ key }) => (
                    <td key={`${row.module}-${String(key)}`} className="p-3 text-center">
                      <select
                        value={row[key]}
                        onChange={(e) => handlePermissionChange(row.module, key, e.target.value as PermissionLevel)}
                        disabled={saving}
                        className={`px-2 py-1 rounded text-[9px] font-semibold text-white bg-neutral-900 border border-neutral-800 focus:outline-none focus:border-brand-500 ${row[key] === 'Write' ? 'bg-emerald-950/60' : row[key] === 'Read' ? 'bg-neutral-850' : 'bg-red-950/40'}`}
                      >
                        {PERMISSION_OPTIONS.map((option) => (
                          <option key={option} value={option} className="bg-neutral-900 text-white">{option}</option>
                        ))}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Management Table */}
      <div className="glass rounded-xl p-5 border border-neutral-800 space-y-4">
        <h2 className="text-sm font-bold text-neutral-200 uppercase tracking-wide flex items-center gap-1.5">
          <Users className="w-4 h-4 text-brand-500" /> User Directory
        </h2>
        
        <div className="overflow-x-auto border border-neutral-800/80 rounded-lg">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-neutral-900/60 text-neutral-400 border-b border-neutral-800 pb-2 uppercase tracking-wide text-[10px] font-bold">
                <th className="p-3">User ID</th>
                <th className="p-3">Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Active Authority Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {loading ? (
                <tr>
                  <td className="p-4 text-neutral-500" colSpan={4}>Loading user directory...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td className="p-4 text-neutral-500" colSpan={4}>No users available.</td>
                </tr>
              ) : users.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-900/20 transition">
                  <td className="p-3 font-mono text-[10px] text-brand-400 font-bold">{u.id}</td>
                  <td className="p-3 font-medium text-neutral-200">{u.name}</td>
                  <td className="p-3 text-neutral-400">{u.email}</td>
                  <td className="p-3">
                    <span className="bg-neutral-900 text-white border border-neutral-800 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 w-fit">
                      <UserCheck className="w-3.5 h-3.5 text-brand-500" /> {u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
