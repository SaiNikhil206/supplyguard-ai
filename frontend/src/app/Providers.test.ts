import { describe, expect, it } from 'vitest';
import { ApiError } from '@/api/client';
import { shouldRetry } from './Providers';

const err = (status: number) => new ApiError({ code: 'DOWNSTREAM_ERROR', message: 'x', status });

describe('query retry predicate', () => {
  it('does not retry 4xx', () => expect(shouldRetry(0, err(404))).toBe(false));
  it('retries a 5xx once', () => expect(shouldRetry(0, err(503))).toBe(true));
  it('stops after one retry', () => expect(shouldRetry(1, err(503))).toBe(false));
});
