export interface UserBadgeProps {
  name?: string;
  tenant?: string;
  role?: string;
}

/** Placeholder; the auth subtask wires this to the logged-in user. */
export function UserBadge({ name, tenant, role }: UserBadgeProps) {
  const initial = (name ?? '?').charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2" data-testid="user-badge">
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-fg">
        {initial}
      </span>
      <div className="hidden text-left leading-tight sm:block">
        <div className="text-sm font-medium">{name ?? 'Guest'}</div>
        <div className="text-xs text-muted">
          {[tenant, role].filter(Boolean).join(' · ') || 'Not signed in'}
        </div>
      </div>
    </div>
  );
}
