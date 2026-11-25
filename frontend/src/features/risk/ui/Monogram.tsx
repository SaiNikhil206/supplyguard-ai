import { cn } from '@/lib/utils';
import { initials } from './meta';

export function Monogram({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-violet-500/20 text-xs font-semibold text-primary ring-1 ring-primary/15',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
