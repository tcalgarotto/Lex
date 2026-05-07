/**
 * Drafting determinístico de minuta jurídica.
 *
 * Recebe o `Case` (com fatos/partes/pedidos), a estratégia sintetizada (do
 * retrieval) e os `LegalRetrievedChunk`s relevantes, e produz uma minuta em
 * Markdown estruturada com seções:
 *
 *   I. Cabeçalho (juízo / competência)
 *   II. Qualificação das partes
 *   III. Dos fatos
 *   IV. Do direito (fundamentos com citações URN-LEX)
 *   V. Dos pedidos
 *   VI. Da tutela de urgência (quando aplicável)
 *   VII. Das provas
 *   VIII. Do valor da causa (placeholder)
 *   IX. Termos e fechamento
 *
 * É 100% determinístico: nenhuma chamada a LLM na entrega base.
 * O hook para "redação refinada por LLM" é explícito e opcional.
 */

import {
  CasePartyRole,
  CaseRequestKind,
  type Case,
  type CaseFact,
  type CaseParty,
  type CaseRequest,
} from "@prisma/client";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import type { LegalRetrievedChunk } from "@/lib/retrieval/legal/types";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";

export type DraftBuildArgs = {
  case: Case;
  facts: CaseFact[];
  parties: CaseParty[];
  requests: CaseRequest[];
  chunks: LegalRetrievedChunk[];
  strategy?: StrategySynthesis;
};

export type DraftBuildResult = {
  content: string;
  groundingChunkIds: string[];
  sections: Array<{ id: string; title: string; chars: number }>;
};

/* ---------------------------- public API -------------------------------- */

export function buildDraft(args: DraftBuildArgs): DraftBuildResult {
  const sections: Array<{ id: string; title: string; body: string }> = [];

  sections.push({ id: "header", title: "I. Endereçamento", body: renderHeader(args.case) });
  sections.push({ id: "parties", title: "II. Qualificação das partes", body: renderParties(args.parties) });
  sections.push({ id: "facts", title: "III. Dos fatos", body: renderFacts(args.facts) });

  const groundingChunkIds: string[] = [];
  sections.push({
    id: "law",
    title: "IV. Do direito",
    body: renderLaw(args.chunks, args.strategy, groundingChunkIds),
  });

  sections.push({ id: "requests", title: "V. Dos pedidos", body: renderRequests(args.requests) });

  const urgency = args.requests.filter((r) => r.kind === CaseRequestKind.URGENCY);
  if (urgency.length) {
    sections.push({ id: "urgency", title: "VI. Da tutela de urgência", body: renderUrgency(urgency) });
  }

  const evidence = args.requests.filter((r) => r.kind === CaseRequestKind.EVIDENCE);
  sections.push({ id: "evidence", title: "VII. Das provas", body: renderEvidence(evidence) });

  sections.push({ id: "value", title: "VIII. Do valor da causa", body: "Atribui-se à causa o valor de R$ ____ (____)." });

  sections.push({
    id: "closing",
    title: "IX. Termos e fechamento",
    body: "Nestes termos, pede deferimento.\n\n[local], [data].\n\n[OAB] [Nome do Advogado]",
  });

  const content = sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n");

  return {
    content,
    groundingChunkIds: Array.from(new Set(groundingChunkIds)),
    sections: sections.map((s) => ({ id: s.id, title: s.title, chars: s.body.length })),
  };
}

/* ---------------------------- renderers --------------------------------- */

function renderHeader(c: Case): string {
  const tribunalLabel = c.tribunalCode ? getTribunal(c.tribunalCode)?.name ?? c.tribunalCode : "[Juízo competente]";
  const ufHint = c.uf ? ` — ${c.uf}` : "";
  const processHint = c.processNumber ? `\n\nProcesso n.º ${c.processNumber}` : "";
  return `Excelentíssimo(a) Juiz(íza) de Direito do(a) ${tribunalLabel}${ufHint}.${processHint}`;
}

function renderParties(parties: CaseParty[]): string {
  if (!parties.length) return "_Partes a qualificar._";
  const blocks: string[] = [];
  const author = parties.filter((p) => p.role === CasePartyRole.AUTHOR);
  const def = parties.filter((p) => p.role === CasePartyRole.DEFENDANT);
  const others = parties.filter((p) => p.role !== CasePartyRole.AUTHOR && p.role !== CasePartyRole.DEFENDANT);
  if (author.length) {
    blocks.push(
      `**Parte Autora**\n\n` +
        author.map((p) => `- ${p.name}${p.document ? ` — ${p.document}` : ""}`).join("\n"),
    );
  }
  if (def.length) {
    blocks.push(
      `**Parte Ré**\n\n` +
        def.map((p) => `- ${p.name}${p.document ? ` — ${p.document}` : ""}`).join("\n"),
    );
  }
  if (others.length) {
    blocks.push(
      `**Outras partes**\n\n` +
        others.map((p) => `- ${p.role}: ${p.name}`).join("\n"),
    );
  }
  return blocks.join("\n\n");
}

function renderFacts(facts: CaseFact[]): string {
  if (!facts.length) return "_Fatos a complementar._";
  return facts
    .map((f, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const dateNote = f.dates?.length ? ` _(referência temporal: ${f.dates.join(", ")})_` : "";
      return `**${num}.** ${f.text}${dateNote}`;
    })
    .join("\n\n");
}

function renderLaw(
  chunks: LegalRetrievedChunk[],
  strategy: StrategySynthesis | undefined,
  groundingOut: string[],
): string {
  const sections: string[] = [];
  if (strategy?.thesis) {
    sections.push(`**Tese central:** ${strategy.thesis}`);
  }
  if (strategy?.arguments?.length) {
    sections.push(
      `**Argumentos centrais:**\n\n` +
        strategy.arguments
          .map((a, i) => `${i + 1}. ${a.headline}${a.excerpt ? ` — _${a.excerpt}_` : ""}`)
          .join("\n"),
    );
  }

  // Selecionar até 6 chunks de maior score, preferindo distintas normas
  const seen = new Set<string>();
  const selected: LegalRetrievedChunk[] = [];
  for (const c of chunks) {
    if (selected.length >= 6) break;
    if (seen.has(c.norm.id)) continue;
    seen.add(c.norm.id);
    selected.push(c);
  }
  if (selected.length) {
    sections.push("**Fundamentação normativa:**");
    for (const c of selected) {
      groundingOut.push(c.chunkId);
      const headline = c.norm.title || c.norm.identifier || c.norm.urn;
      const articleHint = c.articleRef ? ` — ${c.articleRef}` : "";
      const previewRaw = (c.text ?? "").slice(0, 320).replace(/\s+/g, " ").trim();
      const preview = previewRaw.length === 320 ? `${previewRaw}…` : previewRaw;
      sections.push(`- _${headline}${articleHint}_ (\`${c.norm.urn}\`) — “${preview}”`);
    }
  } else {
    sections.push("_Fundamentação normativa a complementar (retrieval sem hits)._");
  }

  if (strategy?.counterArguments?.length) {
    sections.push(
      `**Riscos e contrapontos a endereçar:**\n\n` +
        strategy.counterArguments
          .map((a) => `- _${a.severity.toUpperCase()}_ — **${a.headline}**: ${a.detail}`)
          .join("\n"),
    );
  }

  return sections.join("\n\n");
}

function renderRequests(requests: CaseRequest[]): string {
  if (!requests.length) return "_Pedidos a definir._";
  const main = requests.filter((r) => r.kind === CaseRequestKind.MAIN);
  const subs = requests.filter((r) => r.kind === CaseRequestKind.SUBSIDIARY);
  const proc = requests.filter((r) => r.kind === CaseRequestKind.PROCEDURAL);
  const lines: string[] = ["Diante do exposto, requer:"];
  for (const r of main) {
    lines.push(`a) ${stripVerbHead(r.text)};`);
  }
  for (const r of subs) {
    lines.push(`b) Subsidiariamente, ${stripVerbHead(r.text)};`);
  }
  for (const r of proc) {
    lines.push(`c) ${stripVerbHead(r.text)};`);
  }
  if (lines.length === 1) {
    return "_Pedidos a definir._";
  }
  return lines.join("\n");
}

function renderUrgency(reqs: CaseRequest[]): string {
  return [
    "Presentes os requisitos do art. 300 do CPC — probabilidade do direito e perigo de dano —, requer-se:",
    ...reqs.map((r) => `- ${stripVerbHead(r.text)};`),
  ].join("\n");
}

function renderEvidence(reqs: CaseRequest[]): string {
  if (!reqs.length) {
    return "Protesta provar o alegado por todos os meios em direito admitidos, em especial documental, testemunhal e pericial, se necessário.";
  }
  return ["Protesta provar o alegado mediante:", ...reqs.map((r) => `- ${stripVerbHead(r.text)};`)].join("\n");
}

/* ---------------------------- helpers ---------------------------------- */

function stripVerbHead(text: string): string {
  return text
    .replace(/^\s*\d+[).\-]\s*/, "")
    .replace(/^\s*(requer-se|requer|pleiteia|postula|pede-se|pede|solicita|pugna|pretende)\s+/i, "")
    .trim()
    .replace(/[.;]\s*$/, "");
}
