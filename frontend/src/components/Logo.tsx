import { cn } from '@/lib/utils';

/** SupplyGuard mark: a shield outline whose centre is a connected supply node. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      fill="none"
      className={cn('h-8 w-8 shrink-0', className)}
    >
      <path
        d="M16 2.5 4.5 7v8.2c0 7 4.7 12.6 11.5 14.3 6.8-1.7 11.5-7.3 11.5-14.3V7L16 2.5Z"
        fill="currentColor"
      />
      <g stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
        <path d="M16 10.5v4M16 14.5l-4.5 4M16 14.5l4.5 4" />
      </g>
      <g fill="#fff">
        <circle cx="16" cy="9.5" r="2.2" />
        <circle cx="11" cy="19.3" r="2.2" />
        <circle cx="21" cy="19.3" r="2.2" />
      </g>
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-base font-semibold tracking-tight', className)}>
      SupplyGuard<span className="ml-1 font-medium text-muted">AI</span>
    </span>
  );
}
