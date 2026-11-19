import { useState } from 'react';
import clsx from 'clsx';
import { ErrorState, Spinner } from '@/components/ui';
import { useSettings } from '@/features/admin/settings/hooks';
import { ThresholdsForm } from '@/features/admin/settings/ThresholdsForm';
import { ApprovalForm } from '@/features/admin/settings/ApprovalForm';
import { UsersPanel } from '@/features/admin/settings/UsersPanel';

const TABS = [
  { id: 'thresholds', label: 'Risk thresholds' },
  { id: 'approval', label: 'Approval' },
  { id: 'users', label: 'Users & roles' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function TenantSettings() {
  const [tab, setTab] = useState<TabId>('thresholds');
  const settings = useSettings();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Tenant Settings</h1>
      <div role="tablist" aria-label="Settings sections" className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={clsx(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium',
              tab === t.id ? 'border-primary text-text' : 'border-transparent text-muted hover:text-text',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="pt-2">
        {tab === 'users' ? (
          <UsersPanel />
        ) : settings.isLoading ? (
          <Spinner label="Loading settings" />
        ) : settings.isError || !settings.data ? (
          <ErrorState
            message={settings.error instanceof Error ? settings.error.message : 'Could not load settings.'}
            onRetry={() => settings.refetch()}
          />
        ) : tab === 'thresholds' ? (
          <ThresholdsForm settings={settings.data} />
        ) : (
          <ApprovalForm settings={settings.data} />
        )}
      </div>
    </section>
  );
}
