"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PenSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CaseActions({ caseId }: { caseId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<"draft" | "review" | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(kind: "draft" | "review") {
    setLoading(kind);
    setErr(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/${kind}`, { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `falha ${res.status}`);
      }
      router.refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => call("draft")}
          disabled={loading !== null}
          data-testid="case-draft-action"
        >
          {loading === "draft" ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <PenSquare className="mr-1 size-3.5" />
          )}
          Gerar minuta
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => call("review")}
          disabled={loading !== null}
          data-testid="case-review-action"
        >
          {loading === "review" ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <ShieldCheck className="mr-1 size-3.5" />
          )}
          Rodar review
        </Button>
      </div>
      {err ? <span className="text-[11px] text-rose-300">{err}</span> : null}
    </div>
  );
}
