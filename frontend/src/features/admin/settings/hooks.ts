import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUser,
  getSettings,
  listUsers,
  patchSettings,
} from "@/api/admin/settings";

export const settingsKeys = {
  settings: ["admin", "settings"] as const,
  users: ["admin", "users"] as const,
};

export const useSettings = () =>
  useQuery({ queryKey: settingsKeys.settings, queryFn: getSettings });

export function useSaveSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: patchSettings,
    onSuccess: (data) => qc.setQueryData(settingsKeys.settings, data),
  });
}

export const useTenantUsers = () =>
  useQuery({ queryKey: settingsKeys.users, queryFn: listUsers });

export function useAddUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.users }),
  });
}

/** Flatten ApiError.details ({field: string[]}) to {field: first message}. */
export function fieldErrors(
  details: Record<string, unknown> | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(details ?? {})) {
    out[k] = Array.isArray(v) ? String(v[0]) : String(v);
  }
  return out;
}
