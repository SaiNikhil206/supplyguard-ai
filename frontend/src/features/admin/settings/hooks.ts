import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { flattenDetails } from "@/features/admin/ui/errors";
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
  useQuery({
    queryKey: settingsKeys.users,
    queryFn: listUsers,
    select: (p) => p.results,
  });

export function useAddUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createUser,
    onSuccess: () => qc.invalidateQueries({ queryKey: settingsKeys.users }),
  });
}

/** Flatten ApiError.details (DRF, nested: {risk_thresholds: {high: [msg]}}) to {"risk_thresholds.high": msg}. */
export const fieldErrors = flattenDetails;
