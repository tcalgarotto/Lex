import type { FundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import { parseFundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";

/** Caso criado/atualizado pelo fluxo `/cases/new` + `POST /api/cases/fundamental-intake`. */
export function usesFundamentalIntakeFlow(metadata: unknown): boolean {
  const m = (metadata ?? {}) as Record<string, unknown>;
  if (m["intakeFormSource"] === "intake_form") return true;
  if (m["intakeStructuredAt"]) return true;
  if (m["intakeForm"] && typeof m["intakeForm"] === "object") return true;
  return false;
}

export function isFundamentalIntakeStructured(metadata: unknown): boolean {
  const m = (metadata ?? {}) as Record<string, unknown>;
  return Boolean(m["intakeStructuredAt"]);
}

/** Formulário persistido em `metadataJson.intakeForm`, validado com o schema atual. */
export function parseFundamentalIntakeFromMetadata(metadata: unknown): FundamentalIntakeForm | null {
  const m = (metadata ?? {}) as Record<string, unknown>;
  const raw = m["intakeForm"];
  if (!raw || typeof raw !== "object") return null;
  const p = parseFundamentalIntakeForm(raw);
  return p.success ? p.data : null;
}
