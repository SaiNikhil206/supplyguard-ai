import { forwardRef, type HTMLAttributes } from 'react';
import clsx from 'clsx';

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={clsx('rounded-lg border border-border bg-surface text-text shadow-sm', className)} {...rest} />;
});

export function CardHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('flex items-center justify-between gap-2 border-b border-border px-4 py-3', className)} {...rest} />;
}

export function CardTitle({ className, ...rest }: HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={clsx('text-sm font-semibold text-text', className)} {...rest} />;
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('p-4', className)} {...rest} />;
}
