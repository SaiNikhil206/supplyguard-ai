import { Avatar, AvatarFallback } from '@/components/ui';

export interface UserBadgeProps {
  name?: string;
  tenant?: string;
  role?: string;
}

/** Avatar + name / tenant / role. Used as the user-menu trigger content. */
export function UserBadge({ name, tenant, role }: UserBadgeProps) {
  const initials =
    (name ?? '?')
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '?';
  return (
    <div className="flex items-center gap-2.5" data-testid="user-badge">
      <Avatar>
        <AvatarFallback aria-hidden="true">{initials}</AvatarFallback>
      </Avatar>
      <div className="hidden text-left leading-tight lg:block">
        <div className="text-sm font-medium text-foreground">{name ?? 'Guest'}</div>
        <div className="text-xs text-muted">{[tenant, role].filter(Boolean).join(' · ') || 'Not signed in'}</div>
      </div>
    </div>
  );
}
