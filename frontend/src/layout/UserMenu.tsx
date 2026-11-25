import { ChevronsUpDown, LogOut, Moon, Sun } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui';
import { UserBadge } from './UserBadge';
import { roleLabel } from './roleLabel';
import { useAuth } from '@/auth/AuthProvider';
import { useTheme } from '@/theme/ThemeProvider';

export function UserMenu() {
  const { me, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const role = me ? roleLabel(me.role) : undefined;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="User menu"
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <UserBadge name={me?.user.full_name} tenant={me?.tenant.name} role={role} />
        <ChevronsUpDown aria-hidden="true" className="h-3.5 w-3.5 text-muted" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="text-sm font-semibold">{me?.user.full_name ?? 'Guest'}</div>
          <div className="text-xs text-muted">{me?.user.email}</div>
          <div className="mt-1 text-xs text-muted">{[me?.tenant.name, role].filter(Boolean).join(' · ')}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleTheme}>
          {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
          {theme === 'dark' ? 'Light theme' : 'Dark theme'}
        </DropdownMenuItem>
        <DropdownMenuItem destructive onSelect={signOut}>
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
