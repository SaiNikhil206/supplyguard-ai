import { screen } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithProviders } from '@/test/renderWithProviders';

vi.mock('@/config', () => ({ config: { apiBaseUrl: '/api/v1', apiMock: false } }));

describe('login page with mocks disabled', () => {
  it('hides the demo-user hint', async () => {
    renderWithProviders({ path: '/login' });
    expect(await screen.findByRole('button', { name: /Sign in/ })).toBeInTheDocument();
    expect(screen.queryByTestId('demo-hint')).not.toBeInTheDocument();
  });
});
