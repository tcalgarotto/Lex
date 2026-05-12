"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CaseBootstrapPayload } from "@/lib/cases/case-bootstrap";

type CaseBootstrapContextValue = {
  caseId: string;
  payload: CaseBootstrapPayload;
  /** Incrementa após `refetch` para filhos sincronizarem estado local. */
  version: number;
  refetch: () => Promise<void>;
};

const CaseBootstrapContext = createContext<CaseBootstrapContextValue | null>(null);

export function CaseBootstrapProvider({
  caseId,
  initial,
  children,
}: {
  caseId: string;
  initial: CaseBootstrapPayload;
  children: ReactNode;
}) {
  const [payload, setPayload] = useState<CaseBootstrapPayload>(initial);
  const [version, setVersion] = useState(0);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/cases/${caseId}/bootstrap`);
    if (!res.ok) return;
    const next = (await res.json()) as CaseBootstrapPayload;
    setPayload(next);
    setVersion((v) => v + 1);
  }, [caseId]);

  const value = useMemo(
    () => ({ caseId, payload, version, refetch }),
    [caseId, payload, version, refetch],
  );

  return <CaseBootstrapContext.Provider value={value}>{children}</CaseBootstrapContext.Provider>;
}

export function useOptionalCaseBootstrap() {
  return useContext(CaseBootstrapContext);
}
