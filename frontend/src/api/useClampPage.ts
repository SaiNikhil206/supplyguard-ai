import { useEffect } from 'react';
import { ApiError } from './client';

/**
 * DRF answers 404 for a page past the end. When that happens on page > 1, ask for the total
 * (`fetchCount`, normally page 1 of the same filters) and move to the last real page.
 */
export function useClampPage({
  error,
  page,
  pageSize,
  fetchCount,
  onClamp,
}: {
  error: unknown;
  page: number;
  pageSize: number;
  fetchCount: () => Promise<number>;
  onClamp: (page: number) => void;
}) {
  const outOfRange = error instanceof ApiError && error.status === 404 && page > 1;
  useEffect(() => {
    if (!outOfRange) return;
    let live = true;
    fetchCount()
      .then((count) => live && onClamp(Math.min(page - 1, Math.max(1, Math.ceil(count / pageSize)))))
      .catch(() => live && onClamp(1));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfRange, page]);
  return outOfRange;
}
