import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Menu, PanelLeftClose, PanelLeftOpen, FlaskConical } from 'lucide-react';
import { Badge, Button, Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui';
import { LogoMark, Wordmark } from '@/components/Logo';
import { cn } from '@/lib/utils';
import { config } from '@/config';
import { useAuth } from '@/auth/AuthProvider';
import { navItems } from './nav';
import { SidebarNav } from './SidebarNav';
import { Breadcrumbs } from './Breadcrumbs';
import { CommandPalette } from './CommandPalette';
import { UserMenu } from './UserMenu';

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
    <div className={cn('flex h-14 items-center gap-2.5 px-5 text-foreground', collapsed && 'justify-center px-0')}>
      <LogoMark className="text-primary" />
      <Wordmark className={cn(collapsed && 'sr-only')} />
    </div>
  );
}

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(readCollapsed);
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

      {/* Desktop sidebar */}
      <aside
        aria-label="Sidebar"
        className={cn(
          'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex',
          collapsed ? 'w-[4.5rem]' : 'w-64',
        )}
      >
        <Brand collapsed={collapsed} />
        <div className="flex-1 overflow-y-auto">
          <SidebarNav items={items} collapsed={collapsed} />
        </div>
        <div className="border-t border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-pressed={collapsed}
            className={cn('w-full justify-start text-sidebar-fg hover:bg-primary/10 hover:text-primary', collapsed && 'justify-center px-0')}
          >
            {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile nav */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-72 gap-0 border-border bg-sidebar p-0 text-sidebar-fg [&>button]:text-sidebar-fg">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main navigation menu</SheetDescription>
          <Brand />
          <div className="flex-1 overflow-y-auto">
            <SidebarNav items={items} label="Mobile" onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-card/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 md:hidden"
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <Menu aria-hidden="true" className="h-5 w-5" />
          </Button>
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            {config.apiMock && (
              <Badge tone="warning" className="hidden sm:inline-flex" title="All figures are generated demo data">
                <FlaskConical aria-hidden="true" />
                Illustrative synthetic data
              </Badge>
            )}
            <CommandPalette />
            <UserMenu />
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-4 focus:outline-none sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
