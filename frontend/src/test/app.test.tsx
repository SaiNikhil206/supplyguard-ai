import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { navItems } from '@/layout/nav';

describe('app shell', () => {
  it('renders all 9 nav links', () => {
    renderWithProviders({ path: '/' });
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(navItems).toHaveLength(9);
    for (const item of navItems) {
      const link = screen.getByRole('link', { name: new RegExp(item.label) });
      expect(nav).toContainElement(link);
      expect(link).toHaveAttribute('href', item.path);
    }
  });

  it('shows the suppliers page after navigating', async () => {
    renderWithProviders({ path: '/' });
    await userEvent.click(screen.getByRole('link', { name: /Supplier Intelligence/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Supplier Intelligence' })).toBeInTheDocument();
  });

  it('toggles dark class on <html>', async () => {
    renderWithProviders({ path: '/' });
    const btn = screen.getByRole('button', { name: 'Toggle theme' });
    expect(document.documentElement).not.toHaveClass('dark');
    await userEvent.click(btn);
    expect(document.documentElement).toHaveClass('dark');
    await userEvent.click(btn);
    expect(document.documentElement).not.toHaveClass('dark');
  });

  it('shows NotFound for unknown path', () => {
    renderWithProviders({ path: '/nope' });
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });
});
