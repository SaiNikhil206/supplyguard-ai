import { apiFetch } from '@/api/client';
import type { Paginated, Role } from '@/api/types';

/**
 * REAL shapes (backend/apps/accounts SettingsView, UserListCreateView; apps/tenants/settings_schema.py).
 * Settings = the tenant's `settings` JSON: risk_thresholds {medium < high < critical, each 0..100;
 * exposure_full_scale optional, GET shows the default 500000}, max_cost_increase_pct (0..1000),
 * require_qualified_alternates (bool). Unknown keys are a 400. ADMIN only.
 * No approval/polling settings and no currency exist on the backend.
 */
export interface TenantSettings {
  risk_thresholds: {
    medium: number;
    high: number;
    critical: number;
    exposure_full_scale?: number;
  };
  max_cost_increase_pct: number;
  require_qualified_alternates: boolean;
}

/** PATCH body: any subset; risk_thresholds is merged key by key by the backend. */
export interface SettingsPatch {
  risk_thresholds?: Partial<TenantSettings['risk_thresholds']>;
  max_cost_increase_pct?: number;
  require_qualified_alternates?: boolean;
}

/** GET /users row. `id` is the API id (e.g. 'USR-1'). */
export interface TenantUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: Exclude<Role, 'SYSTEM'>;
  is_active: boolean;
}

/** POST /users body: the backend requires a password (write-only, validated by Django). */
export interface NewUser {
  username: string;
  name: string;
  email: string;
  role: Exclude<Role, 'SYSTEM'>;
  password: string;
}

export const USER_ROLES: NewUser['role'][] = ['ADMIN', 'PROCUREMENT_MANAGER', 'OPS_MANAGER', 'VIEWER'];

export const getSettings = () => apiFetch<TenantSettings>('/settings');
export const patchSettings = (patch: SettingsPatch) =>
  apiFetch<TenantSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
/** First page only (25 users, DRF PageNumberPagination, ordered by id). */
export const listUsers = () => apiFetch<Paginated<TenantUser>>('/users');
export const createUser = (u: NewUser) =>
  apiFetch<TenantUser>('/users', { method: 'POST', body: JSON.stringify(u) });
