import type { HTMLAttributes } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Small "AI" chip (Sparkles, blue tint) that marks AI-generated content. */
export function AiChip({ className, children = 'AI', ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-accent-foreground ring-1 ring-inset ring-primary/20',
        className,
      )}
      {...rest}
    >
      <Sparkles aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
      {children}
    </span>
  );
}
