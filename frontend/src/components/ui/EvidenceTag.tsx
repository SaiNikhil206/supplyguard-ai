import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type EvidenceKind = 'FACT' | 'ESTIMATE' | 'ASSUMPTION' | 'MISSING_DATA';

// Each kind differs in text label, glyph AND border style - never colour alone.
const META: Record<EvidenceKind, { label: string; glyph: string; cls: string; hint: string }> = {
  FACT: {
    label: 'Fact',
    glyph: '✓',
    cls: 'border-solid bg-success/10 text-success border-success/40',
    hint: 'Verified from source data',
  },
  ESTIMATE: {
    label: 'Estimate',
    glyph: '≈',
    cls: 'border-dashed bg-info/10 text-info border-info/50',
    hint: 'Calculated or predicted',
  },
  ASSUMPTION: {
    label: 'Assumption',
    glyph: '?',
    cls: 'border-dotted bg-warning/10 text-warning border-warning/60',
    hint: 'Assumed, not verified',
  },
  MISSING_DATA: {
    label: 'Missing data',
    glyph: '∅',
    cls: 'border-double border-4 bg-transparent text-danger border-danger/60',
    hint: 'Data not available',
  },
};

export interface EvidenceTagProps extends HTMLAttributes<HTMLSpanElement> {
  kind: EvidenceKind;
}

export function EvidenceTag({ kind, className, ...rest }: EvidenceTagProps) {
  const m = META[kind];
  return (
    <span
      data-evidence={kind}
      title={m.hint}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-semibold',
        m.cls,
        className,
      )}
      {...rest}
    >
      <span aria-hidden="true">{m.glyph}</span>
      {m.label}
    </span>
  );
}
