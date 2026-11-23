import type { BadgeTone } from '@/components/ui';
import type { ConnectionStatus } from '@/api/admin/integrations';

export const STATUS_META: Record<ConnectionStatus, { label: string; tone: BadgeTone; icon: string }> = {
  UP: { label: 'Up', tone: 'success', icon: '✓' },
  DEGRADED: { label: 'Degraded', tone: 'warning', icon: '!' },
  DOWN: { label: 'Down', tone: 'danger', icon: '✕' },
  FALLBACK: { label: 'Fallback', tone: 'info', icon: '↺' },
};
