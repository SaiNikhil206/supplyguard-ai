import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  Button,
  ErrorState,
  EvidenceTag,
  Field,
  Input,
  KpiTile,
  Money,
  SeverityBadge,
  StatusBadge,
  formatMoney,
  type EvidenceKind,
  type RiskCaseStatus,
} from '..';

describe('Button', () => {
  it('loading disables and shows spinner', () => {
    render(<Button loading>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });
  it('fires onClick when idle', async () => {
    const fn = vi.fn();
    render(<Button onClick={fn}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(fn).toHaveBeenCalledOnce();
  });
});

describe('badges', () => {
  it.each([
    ['LOW', 'Low'],
    ['MEDIUM', 'Medium'],
    ['HIGH', 'High'],
    ['CRITICAL', 'Critical'],
  ] as const)('SeverityBadge %s', (sev, label) => {
    render(<SeverityBadge severity={sev} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it.each<[RiskCaseStatus, string]>([
    ['RECEIVED', 'Received'],
    ['ANALYZING', 'Analyzing'],
    ['RECOMMENDATION_READY', 'Recommendation ready'],
    ['PENDING_APPROVAL', 'Pending approval'],
    ['APPROVED', 'Approved'],
    ['EXECUTING', 'Executing'],
    ['RECOVERED', 'Recovered'],
    ['CLOSED', 'Closed'],
    ['REJECTED', 'Rejected'],
    ['EXECUTION_FAILED', 'Execution failed'],
  ])('StatusBadge %s', (status, label) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('KpiTile', () => {
  it('shows value and delta', () => {
    render(<KpiTile label="At risk" value="12" delta={{ value: '+3', direction: 'up', tone: 'bad' }} hint="vs last week" />);
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByText(/increase, unfavourable/)).toBeInTheDocument();
    expect(screen.getByText('vs last week')).toBeInTheDocument();
  });
  it('shows skeleton when loading', () => {
    render(<KpiTile label="At risk" value="12" loading />);
    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument();
    expect(screen.queryByText('12')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('calls onRetry and shows correlation id', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Boom" correlationId="abc-123" onRetry={onRetry} />);
    expect(screen.getByText(/abc-123/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Field', () => {
  it('links label, error and hint to the input', () => {
    render(
      <Field label="Email" error="Required" hint="Work email">
        <Input />
      </Field>,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    expect(describedBy).toContain(screen.getByText('Required').id);
    expect(describedBy).toContain(screen.getByText('Work email').id);
  });
});

describe('formatMoney', () => {
  it('formats INR with Indian grouping', () => {
    expect(formatMoney({ amount: '420000.00', currency: 'INR' })).toBe('₹4,20,000.00');
  });
  it('formats USD', () => {
    expect(formatMoney({ amount: '1234.5', currency: 'USD' })).toBe('$1,234.50');
  });
  it('handles invalid amount', () => {
    expect(formatMoney({ amount: 'abc', currency: 'USD' })).toBe('—');
  });
  it('Money renders', () => {
    render(<Money amount="420000.00" currency="INR" />);
    expect(screen.getByText('₹4,20,000.00')).toBeInTheDocument();
  });
});

describe('EvidenceTag', () => {
  it.each<[EvidenceKind, string]>([
    ['FACT', 'Fact'],
    ['ESTIMATE', 'Estimate'],
    ['ASSUMPTION', 'Assumption'],
    ['MISSING_DATA', 'Missing data'],
  ])('%s label', (kind, label) => {
    render(<EvidenceTag kind={kind} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
