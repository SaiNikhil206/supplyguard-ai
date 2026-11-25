import type { ReactNode } from 'react';

export interface GradientRingProps {
  children: ReactNode;
  /** Ignored (v2 removed gradient rings). Kept so existing callers compile. */
  gradient?: string;
  /** Ignored. */
  radius?: string;
  /** Ignored. */
  className?: string;
}

/** @deprecated v2 no-op: renders its children unchanged. Remove usages when restyling screens. */
export function GradientRing({ children }: GradientRingProps) {
  return <>{children}</>;
}
