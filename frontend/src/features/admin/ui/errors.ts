import { ApiError } from "@/api/client";

export interface ErrorView {
  title: string;
  message: string;
  correlationId?: string;
  /** Retrying a 403 or a 400 cannot help. */
  retryable: boolean;
}

/** Flatten DRF details ({field: [msgs]} or nested {a: {b: [msgs]}}) to {"a.b": first message}. */
export function flattenDetails(
  details: Record<string, unknown> | undefined,
  prefix = "",
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) out[key] = String(v[0]);
    else if (v && typeof v === "object")
      Object.assign(out, flattenDetails(v as Record<string, unknown>, key));
    else if (v !== undefined && v !== null) out[key] = String(v);
  }
  return out;
}

/** Map an API error to what an admin screen shows. `forbidden` names who may use the screen. */
export function describeError(err: unknown, forbidden: string): ErrorView {
  if (err instanceof ApiError) {
    const cid = err.correlationId ?? undefined;
    if (err.status === 403) {
      return {
        title: "You do not have access",
        message: forbidden,
        correlationId: cid,
        retryable: false,
      };
    }
    if (err.status === 400) {
      const first = Object.entries(flattenDetails(err.details))[0];
      return {
        title: "Invalid request",
        message: first ? `${first[0]}: ${first[1]}` : err.message,
        correlationId: cid,
        retryable: false,
      };
    }
    return {
      title: "Something went wrong",
      message: err.message,
      correlationId: cid,
      retryable: true,
    };
  }
  return {
    title: "Something went wrong",
    message: err instanceof Error ? err.message : "Unexpected error.",
    retryable: true,
  };
}
