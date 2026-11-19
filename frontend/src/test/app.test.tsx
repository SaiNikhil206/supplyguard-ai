import { screen } from '@testing-library/react';
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
      const link = screen.getByRole('link', { name: new RegExp(item.label) });
      expect(nav).toContainElement(link);
      expect(link).toHaveAttribute('href', item.path);
    }
  });

  it('shows the suppliers page after navigating', async () => {
    renderWithProviders({ path: '/' });
    await userEvent.click(await screen.findByRole('link', { name: /Supplier Intelligence/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Supplier Intelligence' })).toBeInTheDocument();
  });

  it('toggles dark class on <html>', async () => {
    renderWithProviders({ path: '/' });
    const btn = await screen.findByRole('button', { name: /Dark|Light/ });
    expect(document.documentElement).not.toHaveClass('dark');
    await userEvent.click(btn);
    expect(document.documentElement).toHaveClass('dark');
    await userEvent.click(btn);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('Escape closes the mobile menu and a skip link targets main', async () => {
    renderWithProviders({ path: '/' });
    const toggle = await screen.findByRole('button', { name: 'Toggle menu' });
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute('href', '#main');
    expect(document.getElementById('main')).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows NotFound for unknown path', async () => {
    renderWithProviders({ path: '/nope' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});
