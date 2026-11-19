import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import clsx from 'clsx';

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={clsx('w-full border-collapse text-left text-sm text-text', className)} {...rest} />
    </div>
  );
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={clsx('bg-surface-2', className)} {...rest} />;
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={clsx('divide-y divide-border', className)} {...rest} />;
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={clsx('hover:bg-surface-2/60', className)} {...rest} />;
}

export function TH({ className, scope = 'col', ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope={scope}
      className={clsx('px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted', className)}
      {...rest}
    />
  );
}

export function TD({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={clsx('px-3 py-2 align-middle', className)} {...rest} />;
}

export interface TableEmptyRowProps {
  colSpan: number;
  children?: ReactNode;
}

/** Full-width row for empty tables. */
export function TableEmptyRow({ colSpan, children = 'No data' }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}
