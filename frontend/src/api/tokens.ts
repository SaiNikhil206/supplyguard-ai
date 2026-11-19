const REFRESH_KEY = 'sg.refresh';

type Listener = () => void;

let access: string | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function readRefresh(): string | null {
  try {
    return localStorage.getItem(REFRESH_KEY);
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return access;
}

export function getRefreshToken(): string | null {
  return readRefresh();
}

export function setTokens(tokens: { access: string; refresh?: string }): void {
  access = tokens.access;
  if (tokens.refresh) {
    try {
      localStorage.setItem(REFRESH_KEY, tokens.refresh);
    } catch {
      /* storage unavailable: session-only */
    }
  }
  emit();
}

export function clearTokens(): void {
  access = null;
  try {
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
  emit();
}

export function hasSession(): boolean {
  return access !== null || readRefresh() !== null;
}

/** Subscribe to token changes. Returns unsubscribe. */
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
