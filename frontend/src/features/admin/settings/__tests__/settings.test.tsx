import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';
import { resetAdminSettingsMock } from '@/mocks/admin/settings';

beforeEach(() => resetAdminSettingsMock());

async function setNumber(label: RegExp, value: string) {
  const el = await screen.findByLabelText(label);
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

describe('Tenant Settings (admin)', () => {
  beforeEach(async () => {
    await loginAs('admin');
  });

  it('loads and saves thresholds', async () => {
    renderWithProviders({ path: '/settings' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Tenant Settings' })).toBeInTheDocument();
    expect(await screen.findByLabelText(/Critical score/)).toHaveValue(80);
    const save = screen.getByRole('button', { name: 'Save thresholds' });
    expect(save).toBeDisabled();
    await setNumber(/Critical score/, '90');
    expect(save).toBeEnabled();
    await userEvent.click(save);
    expect(await screen.findByText('Settings saved.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Critical score/)).toHaveValue(90);
  });

  it('shows field errors for a bad threshold order', async () => {
    renderWithProviders({ path: '/settings' });
    await setNumber(/Critical score/, '50');
    await userEvent.click(screen.getByRole('button', { name: 'Save thresholds' }));
    expect(await screen.findByText('Must be greater than the high threshold.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Critical score/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('adds a user and appends a row', async () => {
    renderWithProviders({ path: '/settings' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Users & roles' }));
    await screen.findByText('Olivia Ops');
    const role = screen.getByLabelText('Role');
    expect(within(role).queryByRole('option', { name: /system/i })).toBeNull();
    await userEvent.type(screen.getByLabelText('Username'), 'newbie');
    await userEvent.type(screen.getByLabelText('Full name'), 'Nina Newbie');
    await userEvent.type(screen.getByLabelText('Email'), 'nina@acme.example');
    await userEvent.selectOptions(role, 'OPS_MANAGER');
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(await screen.findByText('Nina Newbie')).toBeInTheDocument();
  });

  it('shows the conflict for a duplicate username', async () => {
    renderWithProviders({ path: '/settings' });
    await userEvent.click(await screen.findByRole('tab', { name: 'Users & roles' }));
    await screen.findByText('Olivia Ops');
    await userEvent.type(screen.getByLabelText('Username'), 'admin');
    await userEvent.type(screen.getByLabelText('Full name'), 'Dup');
    await userEvent.type(screen.getByLabelText('Email'), 'dup@acme.example');
    await userEvent.click(screen.getByRole('button', { name: 'Add user' }));
    expect(await screen.findByText('A user with this username already exists.')).toBeInTheDocument();
  });
});

describe('Tenant Settings (non-admin)', () => {
  beforeEach(async () => {
    await loginAs('viewer');
  });

  it('blocks a viewer from /settings', async () => {
    renderWithProviders({ path: '/settings' });
    expect(await screen.findByText('You do not have access')).toBeInTheDocument();
  });

  it('hides the nav item', async () => {
    renderWithProviders({ path: '/' });
    await screen.findByRole('navigation', { name: 'Main' });
    expect(screen.queryByRole('link', { name: /Tenant Settings/ })).toBeNull();
  });
});
