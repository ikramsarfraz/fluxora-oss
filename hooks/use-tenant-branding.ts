"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { invalidateSetupChecklistQuery } from "@/lib/query/invalidate-setup-checklist";
import { queryKeys } from "@/lib/query/keys";

async function fetchLogoUrl(): Promise<string | null> {
  const res = await fetch("/api/tenant/branding/logo-url");
  if (!res.ok) return null;
  const data = (await res.json()) as { url?: string | null };
  return data.url ?? null;
}

export function useTenantLogoUrl() {
  return useQuery({
    queryKey: queryKeys.tenant.logoUrl,
    queryFn: fetchLogoUrl,
    staleTime: 1000 * 60 * 50, // re-fetch 10 min before the signed URL expires
    retry: false,
  });
}

export function useUploadTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/tenant/branding/logo", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Upload failed.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.logoUrl });
      invalidateSetupChecklistQuery(queryClient);
    },
  });
}

export function useRemoveTenantLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/tenant/branding/logo", {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Remove failed.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tenant.logoUrl });
      invalidateSetupChecklistQuery(queryClient);
    },
  });
}
