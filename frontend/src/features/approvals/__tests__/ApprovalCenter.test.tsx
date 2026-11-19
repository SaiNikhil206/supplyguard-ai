import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { submitDecision } from '@/api/approvals';
import { renderWithProviders } from '@/test/renderWithProviders';
import { loginAs } from '@/test/loginAs';
import { DEMO_PASSWORD, users } from '@/mocks/fixtures';
import { setExecutionDelay } from '@/mocks/approvals';

const OPS = {
  id: 'USR-4',
  username: 'ops',
  full_name: 'Olivia Ops',
  email: 'ops@acme.example',
  role: 'OPS_MANAGER' as const,
  password: DEMO_PASSWORD,
};

beforeAll(() => {
  users.push(OPS);
});
afterAll(() => {
  users.splice(users.indexOf(OPS), 1);
});
beforeEach(() => setExecutionDelay(150));

const open = (path = '/approvals?case=RC-000045') => renderWithProviders({ path });
const button = (name: string | RegExp) => screen.findByRole('button', { name });

describe('Approval Center', () => {
  it('shows the pending queue and history', async () => {
    await loginAs('manager');
    open('/approvals');
    expect(await screen.findByRole('heading', { level: 1, name: 'Approval Center' })).toBeInTheDocument();
    const queue = await screen.findByRole('table', { name: 'Pending approvals' });
    expect(await within(queue).findByText('RC-000045')).toBeInTheDocument();
    expect(within(queue).getByText('Alternate supplier')).toBeInTheDocument();
    const history = screen.getByRole('table', { name: 'Decision history' });
    expect(await within(history).findByText('RC-000041')).toBeInTheDocument();
  });

  it('selects a row via ?case= and by clicking', async () => {
    await loginAs('manager');
    const { router } = open('/approvals');
    await userEvent.click(await screen.findByRole('button', { name: 'RC-000045' }));
    expect(router.state.location.search).toBe('?case=RC-000045');
    expect(await button('Approve')).toBeInTheDocument();
  });

  it('procurement manager approves, then the execution succeeds', async () => {
    await loginAs('manager');
    open();
    await userEvent.click(await button('Approve'));
    expect(await screen.findByText('Approved. Execution started.')).toBeInTheDocument();
    expect(await screen.findByTestId('execution-status')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('execution-status')).toHaveTextContent('Succeeded'), { timeout: 3000 });
    // the case left the queue
    expect(await screen.findByText('No approvals waiting')).toBeInTheDocument();
    const history = screen.getByRole('table', { name: 'Decision history' });
    expect(within(history).getAllByText('RC-000045').length).toBeGreaterThan(0);
  });

  it('blocks reject without a comment, allows it with one', async () => {
    await loginAs('manager');
    open();
    await userEvent.click(await button('Reject'));
    expect(await screen.findByText('A comment is required to reject or request changes.')).toBeInTheDocument();
    expect(screen.getByText('Pending approval')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Comment'), 'Too expensive');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(await screen.findByText('Recommendation rejected.')).toBeInTheDocument();
    expect(await screen.findByText('No approvals waiting')).toBeInTheDocument();
  });

  it.each([
    ['viewer', 'viewer'],
    ['ops', 'ops manager'],
  ])('disables the decision buttons for the %s', async (username) => {
    await loginAs(username);
    open();
    const approve = await button('Approve');
    expect(approve).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Request changes' })).toBeDisabled();
    expect(screen.getByText('Only procurement managers can approve')).toBeInTheDocument();
  });

  it('does not allow approving an unsupported option', async () => {
    await loginAs('manager');
    open();
    await userEvent.click(await screen.findByRole('radio', { name: /Split order/ }));
    expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
    expect(screen.getByText(/cannot be approved/)).toBeInTheDocument();
    expect(screen.getByText(/Alternate supplier lead time and unit price/)).toBeInTheDocument();
  });

  it('the mock rejects approving an unsupported option with 422', async () => {
    await loginAs('manager');
    await expect(submitDecision('REC-000104', { decision: 'APPROVE', comments: '' })).rejects.toMatchObject({
      status: 422,
      code: 'BUSINESS_RULE',
    });
  });

  it('shows a 409 when the recommendation was already decided elsewhere', async () => {
    await loginAs('manager');
    open();
    const approve = await button('Approve');
    await submitDecision('REC-000101', { decision: 'APPROVE', comments: '' }); // someone else got there first
    await userEvent.click(approve);
    // the form unmounts once the refetch shows the case is decided, so the error survives in the toast
    expect(await screen.findByText(/has already been decided/)).toBeInTheDocument();
  });

  it('shows a failed execution, then retries it successfully', async () => {
    await loginAs('manager');
    open();
    await userEvent.click(await screen.findByRole('radio', { name: /Inventory transfer/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(screen.getByTestId('execution-status')).toHaveTextContent('Failed'), { timeout: 3000 });
    expect(screen.getByRole('alert')).toHaveTextContent(/connection reset/);

    await userEvent.click(screen.getByRole('button', { name: 'Retry execution' }));
    await waitFor(() => expect(screen.getByTestId('execution-status')).toHaveTextContent('Succeeded'), { timeout: 3000 });
    expect(screen.queryByRole('button', { name: 'Retry execution' })).not.toBeInTheDocument();
  });

  it('shows Retry for a manager on a failed retryable execution', async () => {
    await loginAs('manager');
    open('/approvals?case=RC-000042');
    expect(await screen.findByRole('button', { name: 'Retry execution' })).toBeInTheDocument();
  });

  it('hides Retry from the viewer', async () => {
    await loginAs('viewer');
    open('/approvals?case=RC-000042');
    expect(await screen.findByTestId('execution-status')).toHaveTextContent('Failed');
    expect(screen.queryByRole('button', { name: 'Retry execution' })).not.toBeInTheDocument();
  });
});
