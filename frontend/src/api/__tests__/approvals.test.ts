import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/mocks/server';
import { ApiError } from '../client';
import { RETRY_UNAVAILABLE, retryExecution } from '../approvals';

describe('retryExecution', () => {
  it('turns a missing backend route (404) into a clear message', async () => {
    server.use(http.post('*/executions/:id/retry', () => HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'Not found.' } }, { status: 404 })));
    await expect(retryExecution('EXE-1')).rejects.toMatchObject({ message: RETRY_UNAVAILABLE, status: 404 });
    await expect(retryExecution('EXE-1')).rejects.toBeInstanceOf(ApiError);
  });
});
