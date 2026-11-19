import { describe, expect, it, vi } from 'vitest';
import { clearTokens, getAccessToken, getRefreshToken, setTokens, subscribe } from './tokens';

describe('tokens', () => {
  it('keeps access in memory and refresh in localStorage', () => {
    setTokens({ access: 'a', refresh: 'r' });
    expect(getAccessToken()).toBe('a');
    expect(localStorage.getItem('sg.refresh')).toBe('r');
    expect(localStorage.getItem('sg.access')).toBeNull();
  });
  it('notifies subscribers', () => {
    const fn = vi.fn();
    const off = subscribe(fn);
    setTokens({ access: 'a', refresh: 'r' });
    clearTokens();
    off();
    setTokens({ access: 'b' });
    expect(fn).toHaveBeenCalledTimes(2);
  });
  it('survives storage failure', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(getRefreshToken()).toBeNull();
    spy.mockRestore();
  });
});
