import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import clsx from 'clsx';
import { navItems } from './nav';
import { UserBadge } from './UserBadge';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

const roleLabel = (r: string) =>
  r
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

export function AppShell() {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { me, signOut, hasRole } = useAuth();
  const asideRef = useRef<HTMLElement>(null);

  // Below md a closed sidebar is off-screen: make it inert so links leave the tab order.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const apply = () => {
      if (asideRef.current) (asideRef.current as HTMLElement & { inert: boolean }).inert = !open && !mq.matches;
    };
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="flex min-h-screen bg-bg text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-fg"
      >
        Skip to main content
      </a>
      <aside
        ref={asideRef}
        aria-label="Sidebar"
        className={clsx(
          'fixed inset-y-0 left-0 z-30 w-64 transform border-r border-border bg-surface transition-transform md:static md:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center gap-2 border-b border-border px-4 text-lg font-semibold">
          <span className="text-primary">▣</span> SupplyGuard AI
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 p-3">
          {navItems.filter((item) => !item.roles || hasRole(...item.roles)).map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium',
                  isActive ? 'bg-primary text-primary-fg' : 'text-muted hover:bg-surface-2 hover:text-text',
                )
              }
            >
              <span aria-hidden="true" className="w-4 text-center">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      {open && (
        <div className="fixed inset-0 z-20 bg-black/40 md:hidden" onClick={() => setOpen(false)} aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
          <button
            type="button"
            className="rounded-md border border-border px-3 py-1 text-sm md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            ☰ Menu
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-md border border-border px-3 py-1 text-sm hover:bg-surface-2"
            >
              {theme === 'dark' ? '☀ Light' : '☾ Dark'}
            </button>
            <UserBadge name={me?.user.full_name} tenant={me?.tenant.name} role={me ? roleLabel(me.role) : undefined} />
            <button
              type="button"
              onClick={signOut}
              className="rounded-md border border-border px-3 py-1 text-sm hover:bg-surface-2"
            >
              Sign out
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 p-6 focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
