import {
  cloneElement,
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactElement,
  type SelectHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';

const control =
  'block h-9 w-full rounded-md border bg-card px-3 py-1.5 text-sm text-foreground transition-colors duration-150 placeholder:text-muted ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(control, invalid ? 'border-danger' : 'border-input', className)}
      {...rest}
    />
  );
});

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

/** Native <select> (keeps keyboard + userEvent.selectOptions behaviour) with a themed chevron. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, className, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(control, 'sg-select', invalid ? 'border-danger' : 'border-input', className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  /** Single Input/Select element; id, aria-describedby and invalid are injected. */
  children: ReactElement<{ id?: string; 'aria-describedby'?: string; invalid?: boolean }>;
  className?: string;
}

export function Field({ label, error, hint, children, className }: FieldProps) {
  const autoId = useId();
  const id = children.props.id ?? autoId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={id} className="block text-sm font-medium leading-none text-foreground">
        {label}
      </label>
      {cloneElement(children, { id, 'aria-describedby': describedBy, invalid: !!error || children.props.invalid })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
