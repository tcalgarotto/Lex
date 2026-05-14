"use client";

import { useCallback, useEffect, useState } from "react";

export type WorkspaceStorageQuotaPayload = {
  usedBytes: number;
  quotaBytes: number;
  remainingBytes: number;
  percentUsed: number;
  maxFileSizeBytes: number;
  planName: string;
};

export function useWorkspaceStorageQuota() {
  const [quota, setQuota] = useState<WorkspaceStorageQuotaPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/storage/quota", { method: "GET", cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const j = (await res.json()) as WorkspaceStorageQuotaPayload;
      setQuota(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setQuota(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { quota, loading, error, refresh };
}
