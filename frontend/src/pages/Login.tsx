import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button, Card, CardBody, Field, Input } from '@/components/ui';
import { ApiError } from '@/api/client';
import { config } from '@/config';
import { useAuth } from '@/auth/AuthProvider';

const DEMO_USERS = [
  { username: 'admin', role: 'ADMIN' },
  { username: 'manager', role: 'PROCUREMENT_MANAGER' },
  { username: 'viewer', role: 'VIEWER' },
];

function messageFor(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'UNAUTHENTICATED') return 'Invalid username or password';
    return e.message;
  }
  return 'Sign in failed. Please try again.';
}

interface FromState {
  from?: { pathname?: string; search?: string; hash?: string };
}

export default function Login() {
  const { status, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as FromState | null)?.from;
  const target = from?.pathname ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/';

  if (status === 'authenticated' && !submitting) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(username, password);
      navigate(target, { replace: true });
    } catch (err) {
      setError(messageFor(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-4 text-text">
      <Card className="w-full max-w-sm">
        <CardBody className="space-y-4">
          <h1 className="text-xl font-semibold">
            <span className="text-primary">▣</span> SupplyGuard AI
          </h1>
          <p className="text-sm text-muted">Sign in to your workspace</p>
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <Field label="Username">
              <Input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && (
              <p role="alert" className="text-sm font-medium text-danger">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" loading={submitting}>
              Sign in
            </Button>
          </form>
          {config.apiMock && (
            <div data-testid="demo-hint" className="rounded-md bg-surface-2 p-3 text-xs text-muted">
              <p className="font-medium text-text">Demo users (password demo123)</p>
              <ul className="mt-1 space-y-0.5">
                {DEMO_USERS.map((u) => (
                  <li key={u.username}>
                    <code>{u.username}</code> - {u.role}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
