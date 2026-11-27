import { simulatedEventId, type SimulateResult } from '@/api/types';

describe('simulatedEventId', () => {
  it('uses top-level event_id when present', () => {
    const r: SimulateResult = { scenario: 's', event_id: 'EVT-1', sent: [] };
    expect(simulatedEventId(r)).toBe('EVT-1');
  });
  it('falls back to sent[0] for the real backend shape', () => {
    const r: SimulateResult = {
      scenario: 's',
      sent: [{ http_status: 202, event_id: 'EVT-9', correlation_id: 'c', status: 'RECEIVED', risk_case_id: null }],
    };
    expect(simulatedEventId(r)).toBe('EVT-9');
  });
  it('is undefined when nothing was sent', () => {
    expect(simulatedEventId({ scenario: 's', sent: [] })).toBeUndefined();
  });
});
