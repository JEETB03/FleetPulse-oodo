import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';

export interface FleetUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type PermissionLevel = 'Read' | 'Write' | 'No Access';

export interface PermissionMatrixRow {
  module: string;
  admin: PermissionLevel;
  manager: PermissionLevel;
  dispatcher: PermissionLevel;
  safety: PermissionLevel;
  finance: PermissionLevel;
  driver: PermissionLevel;
}

const DEFAULT_PERMISSION_MATRIX: PermissionMatrixRow[] = [
  { module: 'vehicles', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Read', finance: 'Read', driver: 'Read' },
  { module: 'drivers', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Write', finance: 'Read', driver: 'Read' },
  { module: 'dispatch', admin: 'Write', manager: 'Write', dispatcher: 'Write', safety: 'Read', finance: 'Read', driver: 'Read' },
  { module: 'maintenance', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Read', finance: 'Read', driver: 'Read' },
  { module: 'fuel_expense', admin: 'Write', manager: 'Write', dispatcher: 'Read', safety: 'Read', finance: 'Write', driver: 'Read' },
  { module: 'reports', admin: 'Read', manager: 'Read', dispatcher: 'No Access', safety: 'Read', finance: 'Read', driver: 'No Access' },
  { module: 'settings', admin: 'Write', manager: 'No Access', dispatcher: 'No Access', safety: 'No Access', finance: 'No Access', driver: 'No Access' },
];

const ROLE_TO_MATRIX_KEY: Record<string, keyof PermissionMatrixRow> = {
  'Admin': 'admin',
  'Fleet Manager': 'manager',
  'Dispatcher': 'dispatcher',
  'Safety Officer': 'safety',
  'Finance Analyst': 'finance',
  'Driver': 'driver',
};

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
  const [user] = useState<FleetUser | null>(() => getStoredUser());
  const [permissionMatrix, setPermissionMatrix] = useState<PermissionMatrixRow[]>(DEFAULT_PERMISSION_MATRIX);
  const [permissionsReady, setPermissionsReady] = useState(false);

  useEffect(() => {
    if (!user) {
      setPermissionsReady(true);
      return;
    }

    let cancelled = false;

    api.get<PermissionMatrixRow[]>('/settings/permissions')
      .then((rows) => {
        if (!cancelled) {
          setPermissionMatrix(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPermissionMatrix(DEFAULT_PERMISSION_MATRIX);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPermissionsReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const getAccess = (module: string, role: string): PermissionLevel => {
    const row = permissionMatrix.find((entry) => entry.module === module);
    const roleKey = ROLE_TO_MATRIX_KEY[role];
    if (!row || !roleKey) return 'No Access';
    return (row[roleKey] as PermissionLevel) || 'No Access';
  };

  const permissions = useMemo(() => {
    if (!user) {
      return { canWriteVehicles: false, canWriteDrivers: false, canWriteDispatch: false, canWriteMaintenance: false, canWriteFuel: false, canReadReports: false, isAdmin: false };
    }

    const role = user.role;
    const can = (module: string) => getAccess(module, role);

    return {
      canWriteVehicles: can('vehicles') === 'Write',
      canWriteDrivers: can('drivers') === 'Write',
      canWriteDispatch: can('dispatch') === 'Write',
      canWriteMaintenance: can('maintenance') === 'Write',
      canWriteFuel: can('fuel_expense') === 'Write',
      canReadReports: can('reports') !== 'No Access',
      isAdmin: role === 'Admin',
    };
  }, [user, permissionMatrix]);

  return { user, permissionsReady, ...permissions };
}
