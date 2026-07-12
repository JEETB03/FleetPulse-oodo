import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Grid, 
  Users, 
  UserCheck
} from 'lucide-react';

interface SeedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const Settings: React.FC = () => {
  const [users, setUsers] = useState<SeedUser[]>([]);
  
  // Current logged in user for permission checks
  const [currentUser, setCurrentUser] = useState<any>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('fleetpulse_user');
    if (userStr) {
      setCurrentUser(JSON.parse(userStr));
    }
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const seedMockUsers: SeedUser[] = [
        { id: 'usr-admin', name: 'Alex Carter', email: 'admin@fleetpulse.com', role: 'Admin' },
        { id: 'usr-fm', name: 'Sarah Jenkins', email: 'manager@fleetpulse.com', role: 'Fleet Manager' },
        { id: 'usr-disp', name: 'Mike O\'Connor', email: 'dispatcher@fleetpulse.com', role: 'Dispatcher' },
        { id: 'usr-safety', name: 'Jessica Vance', email: 'safety@fleetpulse.com', role: 'Safety Officer' },
        { id: 'usr-finance', name: 'David Kim', email: 'finance@fleetpulse.com', role: 'Finance Analyst' },
        { id: 'usr-driver', name: 'Robert Taylor', email: 'driver@fleetpulse.com', role: 'Driver' },
      ];
      setUsers(seedMockUsers);
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
  const permissionsGrid = [
    { module: 'Vehicles', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Read', finance: 'Read', driver: 'Read' },
    { module: 'Drivers', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Write', finance: 'Read', driver: 'Read' },
    { module: 'Dispatch', admin: 'Write', manager: 'Write', dispatcher: 'Write', safety: 'Read', finance: 'Read', driver: 'Read' },
    { module: 'Maintenance', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Read', finance: 'Read', driver: 'Read' },
    { module: 'Fuel & Expense', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Read', finance: 'Write', driver: 'Read' },
    { module: 'Reports', admin: 'Read', manager: 'Read', dispatcher: 'No Access', safety: 'Read', finance: 'Read', driver: 'No Access' },
    { module: 'Settings', admin: 'Write', manager: 'No Access', dispatcher: 'No Access', safety: 'No Access', finance: 'No Access', driver: 'No Access' },
  ];

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
              {permissionsGrid.map((row) => (
                <tr key={row.module} className="hover:bg-neutral-900/20 transition">
                  <td className="p-3 font-semibold text-neutral-300">{row.module}</td>
                  
                  {/* Admin cell */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${row.admin === 'Write' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : 'bg-neutral-800 text-neutral-400'}`}>
                      {row.admin}
                    </span>
                  </td>
                  {/* Fleet manager cell */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${row.manager === 'Write' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : row.manager === 'Read' ? 'bg-neutral-850 text-neutral-400' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>
                      {row.manager}
                    </span>
                  </td>
                  {/* Dispatcher cell */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${row.dispatcher === 'Write' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : row.dispatcher === 'Read' ? 'bg-neutral-850 text-neutral-400' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>
                      {row.dispatcher}
                    </span>
                  </td>
                  {/* Safety cell */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${row.safety === 'Write' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : row.safety === 'Read' ? 'bg-neutral-850 text-neutral-400' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>
                      {row.safety}
                    </span>
                  </td>
                  {/* Finance cell */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${row.finance === 'Write' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : row.finance === 'Read' ? 'bg-neutral-850 text-neutral-400' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>
                      {row.finance}
                    </span>
                  </td>
                  {/* Driver cell */}
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${row.driver === 'Write' ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-800/40' : row.driver === 'Read' ? 'bg-neutral-850 text-neutral-400' : 'bg-red-950/40 text-red-400 border border-red-900/30'}`}>
                      {row.driver}
                    </span>
                  </td>
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
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-neutral-900/20 transition">
                  <td className="p-3 font-mono text-[10px] text-brand-400 font-bold">{u.id}</td>
                  <td className="p-3 font-medium text-neutral-200">{u.name}</td>
                  <td className="p-3 text-neutral-400">{u.email}</td>
                  <td className="p-3">
                    <span className="bg-neutral-900 text-neutral-300 border border-neutral-800 px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 w-fit">
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
