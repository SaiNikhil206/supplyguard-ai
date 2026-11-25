import { cn } from '@/lib/utils';
import { initials } from './meta';

export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground/5 text-xs font-semibold text-muted ring-1 ring-border',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
