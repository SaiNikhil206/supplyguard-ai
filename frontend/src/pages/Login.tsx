import { LogoMark } from '@/components/Logo';
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Sparkles, UserCheck } from 'lucide-react';
import { Button, Card, CardBody, Field, Input } from '@/components/ui';
import { ApiError } from '@/api/client';
import { config } from '@/config';
import { useAuth } from '@/auth/AuthProvider';

const DEMO_USERS = [
  { username: 'admin', role: 'ADMIN' },
  { username: 'manager', role: 'PROCUREMENT_MANAGER' },
  { username: 'viewer', role: 'VIEWER' },
];

const VALUE_POINTS = [
  { icon: Activity, title: 'See disruptions early', text: 'Live supplier signals mapped to the purchase orders they put at risk.' },
  { icon: Sparkles, title: 'Evidence-backed AI', text: 'Every recommendation shows its facts, estimates and what data is missing.' },
  { icon: UserCheck, title: 'Human-approved recovery', text: 'No ERP change happens without a recorded approval and a full audit trail.' },
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
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-2">
      <aside
        className="relative hidden flex-col justify-between overflow-hidden bg-[hsl(40_4%_10%)] p-12 text-white lg:flex"
      >
        <div className="relative flex items-center gap-2.5 text-lg font-semibold">
          <LogoMark className="h-9 w-9 text-white" />
          SupplyGuard AI
        </div>
        <div className="relative max-w-md space-y-8">
          <p className="text-3xl font-semibold leading-tight tracking-tight">
            Spot supplier disruptions before they stop your line.
          </p>
          <ul className="space-y-5">
            {VALUE_POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
                  <Icon aria-hidden="true" className="h-4 w-4" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{title}</div>
                  <div className="text-sm text-primary">{text}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-primary">Boomi World 2027 Hackathon</p>
      </aside>

      <main className="flex items-center justify-center p-6">
        <Card className="w-full max-w-sm shadow-lift">
          <CardBody className="space-y-5 p-7">
            <div className="space-y-1.5">
              <h1 className="flex items-center gap-2 text-2xl font-semibold">
                <LogoMark className="h-7 w-7 text-primary lg:hidden" />
                SupplyGuard AI
              </h1>
              <p className="text-sm text-muted">Sign in to your workspace</p>
            </div>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
                <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" loading={submitting}>
                Sign in
              </Button>
            </form>
            {config.apiMock && (
              <div data-testid="demo-hint" className="rounded-md border border-border bg-surface-2 p-3 text-xs text-muted">
                <p className="font-medium text-foreground">Demo users (password demo123)</p>
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
      </main>
    </div>
  );
}
