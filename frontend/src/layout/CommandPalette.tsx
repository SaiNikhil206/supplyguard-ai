import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Factory, ShieldAlert, Search } from 'lucide-react';
import {
  Badge,
  Button,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui';
import { useRiskCases, useSuppliers } from '@/api/queries';
import { useAuth } from '@/auth/AuthProvider';
import { navItems } from './nav';

/** Items that need API data; only mounted while the palette is open so closed means no requests. */
function DataGroups({ go }: { go: (to: string) => void }) {
  const suppliers = useSuppliers({ page_size: 50 });
  const cases = useRiskCases({ page_size: 50 });
  return (
    <>
      {cases.data && cases.data.results.length > 0 && (
        <CommandGroup heading="Risk cases">
          {cases.data.results.map((c) => (
            <CommandItem key={c.id} value={`case ${c.title} ${c.supplier_name} ${c.id}`} onSelect={() => go(`/risk/${c.id}`)}>
              <ShieldAlert aria-hidden="true" />
              <span className="truncate">{c.title}</span>
              <Badge className="ml-auto">{c.supplier_name}</Badge>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
      {suppliers.data && suppliers.data.results.length > 0 && (
        <CommandGroup heading="Suppliers">
          {suppliers.data.results.map((s) => (
            <CommandItem key={s.id} value={`supplier ${s.name} ${s.country} ${s.id}`} onSelect={() => go(`/suppliers/${s.id}`)}>
              <Factory aria-hidden="true" />
              <span className="truncate">{s.name}</span>
              <span className="ml-auto text-xs text-muted">{s.country}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      )}
    </>
  );
}

/** Global search / jump-to, opened with Ctrl/Cmd+K or the top-bar button. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { hasRole } = useAuth();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  return (
    <>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Open command palette"
        aria-keyshortcuts="Control+K Meta+K"
        className="w-9 px-0 text-muted sm:w-64 sm:justify-start sm:px-3"
      >
        <Search aria-hidden="true" className="h-4 w-4" />
        <span className="hidden flex-1 text-left font-normal sm:inline">Search...</span>
        <kbd className="hidden rounded border border-border bg-surface-2 px-1.5 text-[10px] font-medium sm:inline">Ctrl K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a screen, risk case or supplier">
        <CommandInput placeholder="Search screens, cases and suppliers..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Go to">
            {navItems
              .filter((i) => !i.roles || hasRole(...i.roles))
              .map((i) => (
                <CommandItem key={i.path} value={`go ${i.label}`} onSelect={() => go(i.path)}>
                  <i.icon aria-hidden="true" />
                  {i.label}
                  <CommandShortcut>{i.group}</CommandShortcut>
                </CommandItem>
              ))}
          </CommandGroup>
          {open && <DataGroups go={go} />}
        </CommandList>
      </CommandDialog>
    </>
  );
}
