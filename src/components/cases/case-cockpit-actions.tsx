"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Archive,
  CalendarPlus,
  ChevronDown,
  Loader2,
  PenSquare,
  Scale,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CockpitPrimaryAction } from "@/lib/cases/case-cockpit-primary-action";
import type { ProceduralReadiness } from "@/lib/cases/brain-types";

type Props = {
  caseId: string;
  primary: CockpitPrimaryAction;
  readiness?: ProceduralReadiness | null;
  archived?: boolean;
};

export function CaseCockpitActions({ caseId, primary, readiness, archived = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<"draft" | "review" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [forceDraft, setForceDraft] = useState(false);

  const draftBlocked = readiness?.status === "insuficiente" && !forceDraft;
  const blockedReason = readiness
    ? `Caso ainda insuficiente para gerar peça (score ${readiness.score}%). ${
        readiness.nextBestAction || "Complete as pendências críticas primeiro."
      }`
    : "";

  async function post(kind: "draft" | "review") {
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

  async function archiveCase() {
    await fetch(`/api/cases/${caseId}/archive`, { method: "POST" });
    router.refresh();
  }

  const primaryBtn =
    primary.kind === "link" ? (
      <Button
        size="sm"
        asChild
        className="w-full border-[0.5px] border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95 sm:w-auto"
        style={{
          background: "var(--brand-primary)",
          boxShadow: "var(--shadow-violet)",
        }}
      >
        <Link href={primary.href} title={primary.description}>
          {primary.label}
        </Link>
      </Button>
    ) : primary.kind === "post-draft" ? (
      <Button
        size="sm"
        title={primary.description}
        onClick={() => post("draft")}
        disabled={loading !== null || draftBlocked}
        className="w-full border-[0.5px] border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95 sm:w-auto"
        style={{
          background: "var(--brand-primary)",
          boxShadow: "var(--shadow-violet)",
        }}
      >
        {loading === "draft" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <PenSquare className="mr-1 size-3.5" />}
        {primary.label}
      </Button>
    ) : (
      <Button
        size="sm"
        title={primary.description}
        onClick={() => post("review")}
        disabled={loading !== null}
        className="w-full border-[0.5px] border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95 sm:w-auto"
        style={{
          background: "var(--brand-primary)",
          boxShadow: "var(--shadow-violet)",
        }}
      >
        {loading === "review" ? <Loader2 className="mr-1 size-3.5 animate-spin" /> : <ShieldCheck className="mr-1 size-3.5" />}
        {primary.label}
      </Button>
    );

  const showDraftInMenu = primary.kind !== "post-draft";
  const showReviewInMenu = primary.kind !== "post-review";

  return (
    <TooltipProvider delayDuration={120}>
      <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:items-end">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {primary.kind === "post-draft" && draftBlocked ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="w-full sm:w-auto">{primaryBtn}</span>
              </TooltipTrigger>
              <TooltipContent side="top">{blockedReason}</TooltipContent>
            </Tooltip>
          ) : (
            primaryBtn
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="w-full border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] sm:w-auto"
                aria-label="Mais ações do caso"
              >
                Mais ações
                <ChevronDown className="ml-1 size-3.5 opacity-70" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-caption font-normal text-[color:var(--text-muted)]">
                Atalhos
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {showDraftInMenu ? (
                <DropdownMenuItem
                  disabled={loading !== null || draftBlocked}
                  onClick={() => {
                    if (!draftBlocked) void post("draft");
                  }}
                  className="cursor-pointer"
                >
                  <PenSquare className="mr-2 size-4" />
                  Gerar peça
                </DropdownMenuItem>
              ) : null}
              {showReviewInMenu ? (
                <DropdownMenuItem
                  disabled={loading !== null}
                  onClick={() => void post("review")}
                  className="cursor-pointer"
                >
                  <ShieldCheck className="mr-2 size-4" />
                  Revisar peça
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem asChild>
                <Link href={`/cases/${caseId}/pesquisa-juridica`} className="cursor-pointer">
                  <Search className="mr-2 size-4" />
                  Pesquisar fundamentos
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/processos?returnCase=${caseId}`} className="cursor-pointer">
                  <Scale className="mr-2 size-4" />
                  Vincular processo
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/agenda?caseId=${caseId}`} className="cursor-pointer">
                  <CalendarPlus className="mr-2 size-4" />
                  Adicionar evento
                </Link>
              </DropdownMenuItem>
              {!archived ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      void archiveCase();
                    }}
                    className="cursor-pointer"
                  >
                    <Archive className="mr-2 size-4" />
                    Arquivar caso
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {primary.kind === "post-draft" && draftBlocked ? (
          <button
            type="button"
            onClick={() => setForceDraft(true)}
            className="text-left text-[11px] text-[color:var(--text-muted)] underline-offset-2 hover:underline sm:text-right"
          >
            Gerar mesmo assim (com lacunas explícitas)
          </button>
        ) : null}
        {err ? <span className="text-[11px] text-[color:var(--danger-text)] sm:text-right">{err}</span> : null}
      </div>
    </TooltipProvider>
  );
}
