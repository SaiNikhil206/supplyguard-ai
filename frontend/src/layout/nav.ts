import type { Role } from '@/api/types';

export interface NavItem {
  path: string;
  label: string;
  icon: string; // simple glyph
  /** When set, the item is only shown to these roles. */
  roles?: Role[];
}

export const navItems: NavItem[] = [
  { path: '/', label: 'Executive Overview', icon: '◩' },
  { path: '/suppliers', label: 'Supplier Intelligence', icon: '⚙' },
  { path: '/risk', label: 'Risk Command Center', icon: '⚠' },
  { path: '/recommendations', label: 'AI Recommendations', icon: '✦' },
  { path: '/approvals', label: 'Approval Center', icon: '✔' },
  { path: '/what-if', label: 'What-if Simulator', icon: '⇄' },
  { path: '/integrations', label: 'Integration Center', icon: '⛓' },
  { path: '/audit', label: 'Audit Center', icon: '☰' },
  { path: '/settings', label: 'Tenant Settings', icon: '⚒', roles: ['ADMIN'] },
];
