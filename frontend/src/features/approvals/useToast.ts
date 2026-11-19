import { useCallback, useEffect, useRef, useState } from 'react';

export interface ToastMessage {
  message: string;
  tone: 'success' | 'error';
}

/** Minimal local toast: one message, auto-dismissed after `ms`. */
export function useToast(ms = 5000) {
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const notify = useCallback(
    (message: string, tone: ToastMessage['tone']) => {
      setToast({ message, tone });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), ms);
    },
    [ms],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { toast, notify, dismiss: () => setToast(null) };
}
