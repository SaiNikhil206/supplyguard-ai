import { apiFetch } from '@/api/client';
import type { Money, Role } from '@/api/types';

/** PROVISIONAL shapes (docs/CONTRACTS.md is silent on /settings and /users bodies). */
export interface TenantSettings {
  risk_thresholds: {
    critical_score: number;
    high_score: number;
    medium_score: number;
    exposure_alert: Money;
  };
  approval: { require_comment_on_reject: boolean; auto_escalate_hours: number };
  polling_seconds: number;
}

export interface TenantUser {
  id: string;
  username: string;
  full_name: string;
  email: string;
  role: Role;
  active: boolean;
}

export interface NewUser {
  username: string;
  full_name: string;
  email: string;
  role: Exclude<Role, 'SYSTEM'>;
}

export const USER_ROLES: NewUser['role'][] = ['ADMIN', 'PROCUREMENT_MANAGER', 'OPS_MANAGER', 'VIEWER'];

export const getSettings = () => apiFetch<TenantSettings>('/settings');
export const patchSettings = (patch: Partial<TenantSettings>) =>
  apiFetch<TenantSettings>('/settings', { method: 'PATCH', body: JSON.stringify(patch) });
export const listUsers = () => apiFetch<TenantUser[]>('/users');
export const createUser = (u: NewUser) =>
  apiFetch<TenantUser>('/users', { method: 'POST', body: JSON.stringify(u) });
