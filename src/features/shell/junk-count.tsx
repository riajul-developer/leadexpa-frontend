"use client";

import { useQuery } from "@tanstack/react-query";

import { useActiveClient } from "@/shared/hooks/use-active-client";
import { api, unwrap } from "@/shared/lib/api/client";
import { qualityKeys } from "@/shared/lib/query-keys";

/** Junk leads waiting for a decision (17.0.1); hidden at zero. */
export function JunkCount() {
  const client = useActiveClient();
  const { data } = useQuery({
    queryKey: qualityKeys.counts(client),
    queryFn: () =>
      unwrap(api.GET("/v1/leads/quality-counts", { params: { query: client ? { client_id: client } : {} } })),
    staleTime: 60_000,
    meta: { silent: true },
  });
  if (!data?.junk) return null;
  return (
    <span className="bg-danger-soft text-danger ms-auto rounded-full px-1.5 text-xs font-semibold">{data.junk}</span>
  );
}
