import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

/** DataTable feel: muted header, h-12 rows, hairline separators. Scrolls horizontally inside its card. */
export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full caption-bottom border-collapse text-left text-sm text-foreground', className)} {...rest} />
    </div>
  );
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-border bg-surface-2/50', className)} {...rest} />;
}

export function TBody({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...rest} />;
}

export function TR({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('h-12 transition-colors duration-150 hover:bg-surface-2/40', className)} {...rest} />;
}

export type SortDirection = 'asc' | 'desc' | 'none';

export interface THProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** When set, shows a sort icon and aria-sort. Wrap the label in a button yourself to make it interactive. */
  sort?: SortDirection;
}

export function TH({ className, scope = 'col', sort, children, ...rest }: THProps) {
  const Icon = sort === 'asc' ? ArrowUp : sort === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <th
      scope={scope}
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
      className={cn('h-10 whitespace-nowrap px-4 text-xs font-medium text-muted', className)}
      {...rest}
    >
      {sort ? (
        <span className="inline-flex items-center gap-1">
          {children}
          <Icon aria-hidden="true" className="h-3 w-3" strokeWidth={1.75} />
        </span>
      ) : (
        children
      )}
    </th>
  );
}

export function TD({ className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn('px-4 py-3 align-middle', className)} {...rest} />;
}

export interface TableEmptyRowProps {
  colSpan: number;
  children?: ReactNode;
}

/** Full-width row for empty tables. */
export function TableEmptyRow({ colSpan, children = 'No data' }: TableEmptyRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-muted">
        {children}
      </td>
    </tr>
  );
}

export interface TablePaginationProps {
  /** 1-based page. */
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}

/** Footer pagination: "1-10 of 52" with previous/next buttons. */
export function TablePagination({ page, pageSize, total, onPageChange, className }: TablePaginationProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className={cn('flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted', className)}>
      <span className="tabular-nums" aria-live="polite">
        {from}-{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        <Button variant="secondary" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        </Button>
        <span className="px-2 tabular-nums">
          Page {page} of {pages}
        </span>
        <Button variant="secondary" size="sm" aria-label="Next page" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
