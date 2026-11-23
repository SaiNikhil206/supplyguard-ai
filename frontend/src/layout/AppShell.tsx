import { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { FlaskConical, Menu, Moon, PanelLeftClose, PanelLeftOpen, ShieldCheck, Sun } from 'lucide-react';
import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetTitle, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import { cn } from '@/lib/utils';
import { config } from '@/config';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';
import { navItems } from './nav';
import { SidebarNav } from './SidebarNav';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from './CommandPalette';
import { UserMenu } from './UserMenu';
import { PageSkeleton } from './PageSkeleton';

const COLLAPSE_KEY = 'sg.sidebar.collapsed';

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1';
  } catch {
    return false;
  }
}

function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className={cn('flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4', collapsed && 'justify-center px-0')}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <ShieldCheck aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
      </span>
      <span className={cn('text-sm font-semibold tracking-tight text-foreground', collapsed && 'sr-only')}>SupplyGuard AI</span>
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const { theme, toggleTheme } = useTheme();
  const { hasRole } = useAuth();
  const items = navItems.filter((item) => !item.roles || hasRole(...item.roles));

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      {/* Desktop sidebar: 240px, collapses to 56px */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out lg:flex',
          collapsed ? 'w-14' : 'w-60',
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav items={items} collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className={cn('w-full justify-start text-sidebar-fg', collapsed && 'justify-center px-0')}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            ) : (
              <PanelLeftClose aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
            )}
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Navigation sheet below lg */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <Brand />
          <div className="flex-1 overflow-y-auto">
            <SidebarNav items={items} label="Mobile" onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card px-4 sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="-ml-2 lg:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <Menu aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
          </Button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            {config.apiMock && (
              <Badge tone="warning" className="hidden md:inline-flex" title="All figures are generated demo data">
                <FlaskConical aria-hidden="true" />
                Illustrative synthetic data
              </Badge>
            )}
            <CommandPalette />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  aria-label={theme === 'dark' ? 'Light mode' : 'Dark mode'}
                >
                  {theme === 'dark' ? (
                    <Sun aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <Moon aria-hidden="true" className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{theme === 'dark' ? 'Switch to light' : 'Switch to dark'}</TooltipContent>
            </Tooltip>
            <UserMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 focus:outline-none sm:px-6">
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
