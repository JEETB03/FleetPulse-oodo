import { useMemo } from 'react';

export interface FleetUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function getStoredUser(): FleetUser | null {
  const raw = localStorage.getItem('fleetpulse_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function useCurrentUser() {
  const user = useMemo(() => getStoredUser(), []);

  const permissions = useMemo(() => {
    if (!user) return { canWriteVehicles: false, canWriteDrivers: false, canWriteDispatch: false, canWriteMaintenance: false, canWriteFuel: false, canReadReports: false, isAdmin: false };
    const role = user.role;
    return {
      canWriteVehicles: role === 'Admin' || role === 'Fleet Manager',
      canWriteDrivers: role === 'Admin' || role === 'Fleet Manager' || role === 'Safety Officer',
      canWriteDispatch: role === 'Admin' || role === 'Fleet Manager' || role === 'Dispatcher',
      canWriteMaintenance: role === 'Admin' || role === 'Fleet Manager',
      canWriteFuel: role === 'Admin' || role === 'Fleet Manager' || role === 'Finance Analyst',
      canReadReports: ['Admin', 'Fleet Manager', 'Finance Analyst', 'Safety Officer'].includes(role),
      isAdmin: role === 'Admin',
    };
  }, [user]);

  return { user, ...permissions };
}
