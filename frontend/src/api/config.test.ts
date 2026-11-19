import { describe, expect, it } from 'vitest';
import { parseApiMock } from '@/config';

describe('parseApiMock', () => {
  it('unset falls back to the default (DEV)', () => {
    expect(parseApiMock(undefined, true)).toBe(true);
    expect(parseApiMock(undefined, false)).toBe(false);
    expect(parseApiMock('', false)).toBe(false);
  });
  it('explicit true/false wins over the default', () => {
    expect(parseApiMock('true', false)).toBe(true);
    expect(parseApiMock('false', true)).toBe(false);
  });
});
