import { ErrorState } from "@/components/ui";
import { describeError } from "./errors";

/** Error panel for admin screens: 403 gets an access message with no Retry, 400 is not retryable. */
export function AdminError({
  error,
  refetch,
  forbidden = "Only admins and procurement managers can read the audit trail.",
}: {
  error: unknown;
  refetch: () => unknown;
  forbidden?: string;
}) {
  const v = describeError(error, forbidden);
  return (
    <ErrorState
      title={v.title}
      message={v.message}
      correlationId={v.correlationId}
      onRetry={v.retryable ? () => void refetch() : undefined}
    />
  );
}
