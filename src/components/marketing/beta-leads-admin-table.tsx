"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { BETA_LEAD_STATUS_LABEL } from "@/lib/marketing/beta-lead";

export type BetaLeadRow = {
  id: string;
  name: string;
  email: string;
  company: string;
  role: string | null;
  teamSize: string;
  mainPain: string | null;
  intent: string;
  status: string;
  source: string;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  notes: string | null;
  contactedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const STATUSES = ["NEW", "CONTACTED", "QUALIFIED", "DISCARDED"] as const;

export function BetaLeadsAdminTable({ initialLeads }: { initialLeads: BetaLeadRow[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [savingId, setSavingId] = useState<string | null>(null);

  const updateLead = useCallback(async (id: string, patch: { status?: string; notes?: string }) => {
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/beta-leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = (await res.json()) as {
        lead?: { id: string; status: string; notes: string | null; contactedAt: string | null };
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Falha ao atualizar");
        return;
      }
      if (data.lead) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id
              ? {
                  ...l,
                  status: data.lead!.status,
                  notes: data.lead!.notes,
                  contactedAt: data.lead!.contactedAt,
                }
              : l,
          ),
        );
        toast.success("Lead atualizado");
      }
    } catch {
      toast.error("Erro de conexão");
    } finally {
      setSavingId(null);
    }
  }, []);

  if (leads.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-[color:var(--border-default)] p-8 text-center text-sm text-muted-foreground">
        Nenhum lead registrado ainda.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-[color:var(--border-default)]">
      <table className="w-full min-w-[960px] text-left text-sm">
        <thead>
          <tr className="border-b border-[color:var(--border-default)] bg-[color:var(--surface-overlay)] text-muted-foreground">
            <th className="px-3 py-2 font-medium">Quando</th>
            <th className="px-3 py-2 font-medium">Contato</th>
            <th className="px-3 py-2 font-medium">Escritório</th>
            <th className="px-3 py-2 font-medium">Time</th>
            <th className="px-3 py-2 font-medium">Intenção</th>
            <th className="px-3 py-2 font-medium">UTM</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Notas</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id} className="border-b border-[color:var(--border-subtle)] align-top">
              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                {new Date(lead.createdAt).toLocaleString("pt-BR")}
              </td>
              <td className="px-3 py-2">
                <p className="font-medium text-[color:var(--text-primary)]">{lead.name}</p>
                <a href={`mailto:${lead.email}`} className="text-[color:var(--brand-text)] hover:underline">
                  {lead.email}
                </a>
                {lead.role ? <p className="text-xs text-muted-foreground">{lead.role}</p> : null}
              </td>
              <td className="px-3 py-2">{lead.company}</td>
              <td className="px-3 py-2">{lead.teamSize}</td>
              <td className="px-3 py-2 capitalize">{lead.intent === "demo" ? "Demo" : "Beta"}</td>
              <td className="max-w-[140px] px-3 py-2 text-xs text-muted-foreground">
                {[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(" · ") || "—"}
              </td>
              <td className="px-3 py-2">
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={lead.status}
                  disabled={savingId === lead.id}
                  onChange={(e) => void updateLead(lead.id, { status: e.target.value })}
                  aria-label={`Status de ${lead.name}`}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {BETA_LEAD_STATUS_LABEL[s] ?? s}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <textarea
                  className="min-h-[60px] w-full min-w-[160px] rounded-md border border-input bg-transparent px-2 py-1 text-xs"
                  defaultValue={lead.notes ?? ""}
                  disabled={savingId === lead.id}
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (next === (lead.notes ?? "").trim()) return;
                    void updateLead(lead.id, { notes: next });
                  }}
                  placeholder="Notas internas…"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

