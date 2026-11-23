import clsx from 'clsx';
import type { ToastMessage } from './useToast';

export function Toast({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  return (
    <div aria-live="polite" role="status" className="fixed bottom-4 right-4 z-50">
      {toast && (
        <div
          className={clsx(
            'flex items-center gap-3 rounded-md border px-4 py-3 text-sm shadow-lg',
            toast.tone === 'success' ? 'border-success/40 bg-surface text-success' : 'border-danger/40 bg-surface text-danger',
          )}
        >
          <span>{toast.message}</span>
          <button type="button" onClick={onDismiss} aria-label="Dismiss notification" className="text-muted hover:text-text">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
