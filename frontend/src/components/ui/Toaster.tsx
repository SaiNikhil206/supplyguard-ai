import { Toaster as Sonner, toast } from 'sonner';
import { useTheme } from '@/theme/ThemeProvider';

/** Mounted once in Providers. Use `toast.success('Saved')`, `toast.error(...)`, `toast(...)` from the kit. */
export function Toaster() {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            'group rounded-lg border border-border bg-popover text-popover-foreground shadow-lift font-sans text-sm',
          description: '!text-muted',
          actionButton: '!bg-primary !text-primary-foreground',
          cancelButton: '!bg-surface-2 !text-foreground',
        },
      }}
    />
  );
}

// eslint-disable-next-line react-refresh/only-export-components -- re-export of the sonner helper
export { toast };
