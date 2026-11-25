import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface GradientRingProps {
  children: ReactNode;
  /** Tailwind gradient colour classes; defaults to the primary ring. */
  gradient?: string;
  /** Border radius class; defaults to rounded-2xl. */
  radius?: string;
  className?: string;
}

/** 1px gradient ring wrapper for important cards / avatars. */
export function GradientRing({
  children,
  gradient = 'from-primary/50 via-border to-transparent',
  radius = 'rounded-2xl',
  className,
}: GradientRingProps) {
  return <div className={cn('bg-gradient-to-br p-px', radius, gradient, className)}>{children}</div>;
}
