import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface GradientRingProps {
  children: ReactNode;
  /** Ring colour classes; defaults to a neutral 1px border. */
  gradient?: string;
  /** Border radius class; defaults to rounded-2xl. */
  radius?: string;
  className?: string;
}

/** 1px neutral ring wrapper for important cards / avatars. */
export function GradientRing({
  children,
  gradient = 'bg-border',
  radius = 'rounded-2xl',
  className,
}: GradientRingProps) {
  return <div className={cn('p-px', radius, gradient, className)}>{children}</div>;
}
