import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';
import { navItems } from '@/layout/nav';

describe('app shell (authenticated)', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('renders all 9 nav links', async () => {
    renderWithProviders({ path: '/' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    expect(navItems).toHaveLength(9);
    for (const item of navItems) {
      const link = within(nav).getByRole('link', { name: new RegExp(item.label) });
      expect(nav).toContainElement(link);
      expect(link).toHaveAttribute('href', item.path);
    }
  });

  it('shows the suppliers page after navigating', async () => {
    renderWithProviders({ path: '/' });
    await userEvent.click(await screen.findByRole('link', { name: /Supplier Intelligence/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Supplier Intelligence' })).toBeInTheDocument();
  });

  it('is light only: no theme toggle and no dark class on <html>', async () => {
    document.documentElement.classList.add('dark');
    renderWithProviders({ path: '/' });
    await screen.findByRole('button', { name: 'Toggle menu' });
    expect(screen.queryByRole('button', { name: /Dark mode|Light mode/ })).not.toBeInTheDocument();
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
  });

  it('mobile nav opens in a sheet, Escape closes it, and a skip link targets main', async () => {
    renderWithProviders({ path: '/' });
    const toggle = await screen.findByRole('button', { name: 'Toggle menu' });
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')).toBeInTheDocument();
    expect(screen.getByLabelText('Sidebar')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(await screen.findByRole('navigation', { name: 'Mobile' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('navigation', { name: 'Mobile' })).not.toBeInTheDocument();
  });

  it('opens the command palette with Ctrl+K and jumps to a screen', async () => {
    const { router } = renderWithProviders({ path: '/' });
    await screen.findByRole('navigation', { name: 'Main' });
    await userEvent.keyboard('{Control>}k{/Control}');
    const input = await screen.findByPlaceholderText(/Search screens/);
    await userEvent.type(input, 'audit');
    await userEvent.click(await screen.findByRole('option', { name: /Audit Center/ }));
    expect(router.state.location.pathname).toBe('/audit');
  });

  it('groups the sidebar into Monitor / Decide / Govern', async () => {
    renderWithProviders({ path: '/' });
    const nav = await screen.findByRole('navigation', { name: 'Main' });
    for (const g of ['Monitor', 'Decide', 'Govern']) expect(nav).toHaveTextContent(g);
  });

  it('shows NotFound for unknown path', async () => {
    renderWithProviders({ path: '/nope' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});
