import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import { navGroups, navItems, type NavItem } from './nav';

export interface SidebarNavProps {
  items?: NavItem[];
  collapsed?: boolean;
  label?: string;
  onNavigate?: () => void;
}

/** Grouped nav links. `collapsed` shows icons only, with tooltips. */
export function SidebarNav({ items = navItems, collapsed = false, label = 'Main', onNavigate }: SidebarNavProps) {
  return (
    <nav aria-label={label} className="flex flex-col gap-5 px-2 py-3">
      {navGroups.map((group) => {
        const groupItems = items.filter((i) => i.group === group);
        if (groupItems.length === 0) return null;
        return (
          <div key={group} className="flex flex-col gap-1">
            <div
              className={cn(
                'px-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-sidebar-muted',
                collapsed && 'sr-only',
              )}
            >
              {group}
            </div>
            {groupItems.map((item) => {
              const Icon = item.icon;
              const link = (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'group flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors duration-150',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      collapsed && 'justify-center px-0',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-sidebar-fg hover:bg-surface-2 hover:text-foreground',
                    )
                  }
                >
                  <Icon aria-hidden="true" className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className={cn(collapsed && 'sr-only')}>{item.label}</span>
                </NavLink>
              );
              if (!collapsed) return link;
              return (
                <Tooltip key={item.path}>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}
