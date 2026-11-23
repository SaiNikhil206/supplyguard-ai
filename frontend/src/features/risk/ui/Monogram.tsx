import { cn } from '@/lib/utils';
import { initials } from './meta';

/** Neutral supplier monogram (slate-100 / slate-700) - one style everywhere. */
export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-xs font-semibold text-foreground/80 ring-1 ring-inset ring-border',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
