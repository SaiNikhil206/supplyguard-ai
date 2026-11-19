import clsx from 'clsx';

export interface MoneyValue {
  amount: string | number;
  currency: string;
}

const LOCALES: Record<string, string> = { INR: 'en-IN' };

/**
 * Format a money amount. Accepts decimal strings ("420000.00") as returned by the API.
 * INR uses Indian digit grouping: 420000.00 -> ₹4,20,000.00. Invalid amounts give an em dash.
 */
export function formatMoney({ amount, currency }: MoneyValue): string {
  const n = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(n)) return '—';
  const code = currency.toUpperCase();
  return new Intl.NumberFormat(LOCALES[code] ?? 'en-US', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export interface MoneyProps extends MoneyValue {
  className?: string;
}

export function Money({ amount, currency, className }: MoneyProps) {
  return <span className={clsx('tabular-nums', className)}>{formatMoney({ amount, currency })}</span>;
}
