/**
 * P0 — Estratégia e Peças (drafting + review + export).
 * Drafting-guard ativo; jurisprudência candidata não promovida sem confirmação humana.
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/features/CASE_DRAFTING_TAB.md
 */

import { generateText } from "ai";
import { CasePartyRole } from "@prisma/client";
import { getLanguageModelForLexTask, getProviderOptionsForLexTask } from "@/lib/ai/llm";
import { prisma } from "@/lib/prisma";
import {
  getCaseBrainSnapshot,
  listPinnedFoundations,
  listPinnedJurisprudenceCandidates,
} from "@/lib/cases/drafting/case-brain-shim";
import { runDraftingGuard } from "@/lib/cases/drafting/drafting-guard";
import type {
  DraftFoundationUse,
  DraftResult,
  GenerateDraftOptions,
} from "@/lib/cases/drafting/drafting-types";

export async function generateDraft(
  caseId: string,
  workspaceId: string,
  options?: GenerateDraftOptions,
): Promise<DraftResult> {
  const snap = await getCaseBrainSnapshot(workspaceId, caseId);
  if (!snap) {
    throw Object.assign(new Error("Caso não encontrado neste workspace."), { status: 404 });
  }

  const caseMeta = await prisma.case.findFirst({
    where: { id: caseId, workspaceId },
    select: { metadataJson: true },
  });
  const meta = (caseMeta?.metadataJson ?? {}) as Record<string, unknown>;
  const draftingStrategyExists = Boolean(meta["draftingStrategy"]);
  const draftingStrategyApproved = Boolean(meta["draftingStrategyApproved"]);

  const pinnedFoundations = await listPinnedFoundations(workspaceId, caseId);
  const jurisprudenceCandidates = await listPinnedJurisprudenceCandidates(workspaceId, caseId);

  const guard = runDraftingGuard({
    snapshot: snap,
    pinnedFoundations,
    jurisprudenceCandidates,
    confirmUnverifiedFoundations: options?.confirmUnverifiedFoundations === true,
    draftingStrategyExists,
    draftingStrategyApproved,
  });
  if (!guard.ok) {
    return { status: "blocked", reasons: guard.reasons };
  }

  const foundationsUsed: DraftFoundationUse[] = pinnedFoundations.map((p) => ({
    ref: p.id,
    origin:
      p.verificationStatus === "VERIFIED_BY_INTERNAL_RAG" ||
      p.verificationStatus === "VERIFIED_BY_OFFICIAL_SOURCE" ||
      p.verificationStatus === "USER_VERIFIED"
        ? "verified"
        : "pinned",
    label: p.citation,
  }));

  const parties = snap.brain
    ? snap.brain.parties.map((p) => `- (${p.role}) ${p.name}`).join("\n")
    : snap.parties.map((p) => `- (${p.role}) ${p.name}`).join("\n");

  const authorLine =
    snap.parties.find((p) => p.role === CasePartyRole.AUTHOR)?.name ??
    snap.brain?.parties.find((p) => p.role === "assisted_party")?.name ??
    "(autor a revisar)";

  const facts = snap.brain
    ? snap.brain.facts.map((f) => `- ${f.text}`).join("\n")
    : snap.facts.map((f) => `- ${f.text}`).join("\n");

  const requests = snap.brain
    ? snap.brain.requests.map((r) => `- (${r.kind}) ${r.text}`).join("\n")
    : snap.requests.map((r) => `- (${r.kind}) ${r.text}`).join("\n");

  const pinText = pinnedFoundations
    .map((p) => {
      const originLabel =
        p.verificationStatus === "USER_PINNED" ? "pin do workspace" : `status: ${p.verificationStatus}`;
      return `### ${p.title}\nCitação: ${p.citation}\nTrecho autorizado:\n> ${p.excerpt}\n(origem: ${originLabel})\n`;
    })
    .join("\n");

  const jurisNotes = jurisprudenceCandidates.map((j) => {
    const tag =
      j.verificationStatus === "AI_RECOMMENDED_UNVERIFIED"
        ? "(candidata — confirmar fonte oficial)"
        : "";
    const proc = j.processNumber ? `Processo ${j.processNumber}` : "Sem número de processo informado";
    return `- ${j.title} — ${j.court} — ${proc} ${tag}`.trim();
  });

  const strategyBlock =
    draftingStrategyExists && meta["draftingStrategy"]
      ? JSON.stringify(meta["draftingStrategy"]).slice(0, 14_000)
      : "(sem estratégia salva)";

  const prompt = `Elabore uma minuta processual em Markdown (pt-BR), com seções:
# Endereçamento
# Qualificação das partes
# Dos fatos
# Do direito
# Dos pedidos
# Das provas
# Valor da causa (se aplicável; se faltar dado, escrever lacuna explícita curta)
# Lacunas para revisão (bullet com o que falta confirmar)

Regras obrigatórias:
- Use somente fatos, partes, pedidos e fundamentos fornecidos abaixo.
- Nos trechos de direito, cite explicitamente os fundamentos pinados pelo rótulo/citação fornecidos.
- Para julgados mencionados, se constar a nota "(candidata — confirmar fonte oficial)", mantenha essa frase ao lado da referência. Nunca trate julgado candidato como decisão já verificada.
- Não invente números de processo nem normas fora dos trechos pinados.

Partes:
${parties}

Fatos:
${facts}

Pedidos:
${requests}

Fundamentos pinados (única fonte normativa):
${pinText}

Julgados de apoio (candidatos — linguagem cautelosa):
${jurisNotes.length ? jurisNotes.join("\n") : "(nenhum)"}

Estratégia processual aprovada / consolidada no caso (siga a linha; não contradiga sem marcar lacuna):
${strategyBlock}

Nome sugerido da parte autora: ${authorLine}
`;

  const { text } = await generateText({
    model: getLanguageModelForLexTask("draft_generation"),
    providerOptions: getProviderOptionsForLexTask("draft_generation"),
    temperature: 0.2,
    maxOutputTokens: 6000,
    prompt,
  });

  const inlineNotes: string[] = [];
  if (jurisprudenceCandidates.some((j) => !j.processNumber)) {
    inlineNotes.push(
      "Há julgado candidato sem número de processo: confira no tribunal antes de protocolar.",
    );
  }
  if (jurisprudenceCandidates.some((j) => j.verificationStatus === "AI_RECOMMENDED_UNVERIFIED")) {
    inlineNotes.push(
      "Julgados com indicação automática permanecem como candidatos até confirmação humana explícita.",
    );
  }

  return {
    status: "ok",
    content: text.trim(),
    foundationsUsed,
    inlineNotes,
  };
}
