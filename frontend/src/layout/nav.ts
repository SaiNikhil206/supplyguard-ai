import {
  LayoutDashboard,
  Factory,
  ShieldAlert,
  Sparkles,
  CircleCheckBig,
  GitCompareArrows,
  Plug,
  ScrollText,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/api/types';

export type NavGroup = 'Monitor' | 'Decide' | 'Govern';

export interface NavItem {
  path: string;
  label: string;
  /** Short label for breadcrumbs. */
  short: string;
  icon: LucideIcon;
  group: NavGroup;
  /** When set, the item is only shown to these roles. */
  roles?: Role[];
}

export const navGroups: NavGroup[] = ['Monitor', 'Decide', 'Govern'];

export const navItems: NavItem[] = [
  { path: '/', label: 'Executive Overview', short: 'Overview', icon: LayoutDashboard, group: 'Monitor' },
  { path: '/suppliers', label: 'Supplier Intelligence', short: 'Suppliers', icon: Factory, group: 'Monitor' },
  { path: '/risk', label: 'Risk Command Center', short: 'Risk', icon: ShieldAlert, group: 'Monitor' },
  { path: '/recommendations', label: 'AI Recommendations', short: 'Recommendations', icon: Sparkles, group: 'Decide' },
  { path: '/approvals', label: 'Approval Center', short: 'Approvals', icon: CircleCheckBig, group: 'Decide' },
  { path: '/what-if', label: 'What-if Simulator', short: 'What-if', icon: GitCompareArrows, group: 'Decide' },
  { path: '/integrations', label: 'Integration Center', short: 'Integrations', icon: Plug, group: 'Govern' },
  { path: '/audit', label: 'Audit Center', short: 'Audit', icon: ScrollText, group: 'Govern' },
  { path: '/settings', label: 'Tenant Settings', short: 'Settings', icon: Settings, group: 'Govern', roles: ['ADMIN'] },
];
