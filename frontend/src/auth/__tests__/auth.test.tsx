import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { server } from '@/mocks/server';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';
import { getAccessToken, setTokens } from '@/api/tokens';

async function signIn(username: string, password: string) {
  await userEvent.type(await screen.findByLabelText('Username'), username);
  await userEvent.type(screen.getByLabelText('Password'), password);
  await userEvent.click(screen.getByRole('button', { name: /Sign in/ }));
}

describe('auth flow', () => {
  it('redirects unauthenticated /suppliers to login', async () => {
    const { router } = renderWithProviders({ path: '/suppliers' });
    expect(await screen.findByRole('button', { name: /Sign in/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('logs in and returns to the originally requested page with user badge', async () => {
    const { router } = renderWithProviders({ path: '/suppliers' });
    await signIn('manager', 'demo123');
    expect(await screen.findByRole('heading', { level: 1, name: 'Supplier Intelligence' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/suppliers');
    const badge = screen.getByTestId('user-badge');
    expect(badge).toHaveTextContent('Pranav Procurement');
    expect(badge).toHaveTextContent('Acme Manufacturing');
    expect(badge).toHaveTextContent('Procurement Manager');
  });

  it('shows an error for a wrong password', async () => {
    const { router } = renderWithProviders({ path: '/login' });
    await signIn('admin', 'wrong');
    expect(await screen.findByText('Invalid username or password')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('redirects an authenticated user away from /login', async () => {
    await loginAs('viewer');
    const { router } = renderWithProviders({ path: '/login' });
    await screen.findByTestId('user-badge');
    expect(router.state.location.pathname).toBe('/');
  });

  it('sign out returns to login and protected pages are unreachable', async () => {
    await loginAs('admin');
    const { router } = renderWithProviders({ path: '/' });
    await userEvent.click(await screen.findByRole('button', { name: 'User menu' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(await screen.findByRole('button', { name: /Sign in/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
    expect(getAccessToken()).toBeNull();
    await router.navigate('/suppliers');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('logs out to login when token refresh fails', async () => {
    await loginAs('admin');
    // Expire the access token so the next call 401s, and make refresh fail.
    setTokens({ access: 'expired-token' });
    server.use(
      http.post('*/api/v1/auth/refresh', () =>
        Response.json({ error: { code: 'UNAUTHENTICATED', message: 'Token is invalid or expired.' } }, { status: 401 }),
      ),
    );
    const { router } = renderWithProviders({ path: '/suppliers' });
    expect(await screen.findByRole('button', { name: /Sign in/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/login');
  });

  it('shows the demo-user hint in mock mode', async () => {
    renderWithProviders({ path: '/login' });
    expect(await screen.findByTestId('demo-hint')).toHaveTextContent('manager');
  });
});
