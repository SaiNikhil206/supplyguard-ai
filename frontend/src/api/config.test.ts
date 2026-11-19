import { describe, expect, it } from 'vitest';
import { parseApiMock } from '@/config';

describe('parseApiMock', () => {
  it('defaults to mock on', () => {
    expect(parseApiMock(undefined)).toBe(true);
    expect(parseApiMock('true')).toBe(true);
    expect(parseApiMock('')).toBe(true);
  });
  it('only the string "false" hits the real backend', () => {
    expect(parseApiMock('false')).toBe(false);
  });
});
