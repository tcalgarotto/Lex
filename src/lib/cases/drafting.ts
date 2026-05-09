/**
 * Drafting v2 — minuta jurídica determinística com Brain awareness (F4).
 *
 * Mudanças vs v1:
 *  - Aceita `brain` (CaseBrain) e `pinnedSources` (CaseLegalSource[]) opcionais.
 *  - `renderHeader` escolhe rito (MS / obrigação de fazer) a partir de
 *    `brain.probableMeasure.kind`.
 *  - `renderParties` consome `brain.parties` (com phone/address/relationship)
 *    e só cai em `_Partes a qualificar._` quando NADA está disponível.
 *  - `renderLaw` prioriza `pinnedSources` (todos), depois preenche com
 *    retrieval, e filtra ADCT irrelevante quando `brain.area` não pede.
 *  - `renderRequests` usa `brain.requests` quando existem; classifica
 *    `kind` (URGENCY/PROVISIONAL/MAIN/etc).
 *  - `renderUrgency` aciona `assertCitationAllowed` antes de citar
 *    art. 300 CPC ou Lei 12.016 — se a norma não está indexada, a
 *    citação migra para a seção VII. Lacunas (F4.1).
 *  - Valor da causa = lacuna explícita quando ausente (não placeholder mascarado).
 *  - Resultado inclui `lacunas[]` e `unindexedFoundations[]` para o
 *    Draft Workspace (F5) e o Review v2 (F6).
 */

import {
  CasePartyRole,
  CaseRequestKind,
  type Case,
  type CaseFact,
  type CaseLegalSource,
  type CaseParty,
  type CaseRequest,
} from "@prisma/client";
import { getTribunal } from "@/lib/corpus/tribunals/registry";
import type { ApprovedLegalFoundation } from "@/lib/retrieval/legal/approved-foundation";
import type { StrategySynthesis } from "@/lib/legal/reasoning/strategy";
import type { CaseBrain, BrainParty, BrainRequest } from "./brain-types";
import {
  decideCitationSync,
  type CitationCandidate,
} from "./drafting-guard";
import type { CorpusManifest } from "@/lib/corpus/manifest";

export type DraftBuildArgs = {
  case: Case;
  facts: CaseFact[];
  parties: CaseParty[];
  requests: CaseRequest[];
  foundations: ApprovedLegalFoundation[];
  strategy?: StrategySynthesis;
  /** F4 — quando presente, prioriza dados do brain. */
  brain?: CaseBrain | null;
  /** F4 — fontes pinadas pelo advogado (priorizadas em renderLaw). */
  pinnedSources?: CaseLegalSource[];
  /** F4 — documentos vinculados (usado em renderEvidence). */
  documents?: Array<{ originalName: string }>;
  /** F4.1 — manifest do corpus para guard de citações. */
  corpusManifest?: CorpusManifest;
};

export type DraftBuildResult = {
  content: string;
  groundingChunkIds: string[];
  sections: Array<{ id: string; title: string; chars: number }>;
  /** F4 — lacunas explícitas (dados ausentes) para painel de revisão. */
  lacunas: string[];
  /** F4.1 — fundamentos sugeridos mas não indexados. */
  unindexedFoundations: Array<{ urn?: string; label: string; suggestedUse?: string }>;
  /** F4 — quantidade de pinned sources efetivamente usadas. */
  usedPinnedSources: number;
  /** F4 — true quando o brain alimentou a peça. */
  usedBrainContext: boolean;
};

/* ---------------------------- public API -------------------------------- */

export function buildDraft(args: DraftBuildArgs): DraftBuildResult {
  const sections: Array<{ id: string; title: string; body: string }> = [];
  const lacunas: string[] = [];
  const unindexed: Array<{ urn?: string; label: string; suggestedUse?: string }> = [];
  const groundingChunkIds: string[] = [];

  sections.push({
    id: "header",
    title: "I. Endereçamento",
    body: renderHeader(args.case, args.brain ?? null, lacunas),
  });
  sections.push({
    id: "parties",
    title: "II. Qualificação das partes",
    body: renderParties(args.parties, args.brain ?? null, lacunas),
  });
  sections.push({
    id: "facts",
    title: "III. Dos fatos",
    body: renderFacts(args.facts, args.brain ?? null, lacunas),
  });

  const usedPinnedSources = (args.pinnedSources ?? []).length;
  sections.push({
    id: "law",
    title: "IV. Do direito",
    body: renderLaw(
      args.foundations,
      args.strategy,
      groundingChunkIds,
      args.pinnedSources ?? [],
      args.brain ?? null,
    ),
  });

  sections.push({
    id: "requests",
    title: "V. Dos pedidos",
    body: renderRequests(args.requests, args.brain ?? null, lacunas),
  });

  // Tutela de urgência condicional ao brain ou aos requests classificados.
  const hasUrgency =
    args.requests.some((r) => r.kind === CaseRequestKind.URGENCY) ||
    !!args.brain?.requests.some((r) => r.kind === "URGENCY");
  if (hasUrgency) {
    sections.push({
      id: "urgency",
      title: "VI. Da tutela de urgência",
      body: renderUrgency(args.brain ?? null, args.corpusManifest, unindexed),
    });
  }

  sections.push({
    id: "evidence",
    title: "VII. Das provas",
    body: renderEvidence(args.requests, args.documents ?? []),
  });

  sections.push({
    id: "value",
    title: "VIII. Do valor da causa",
    body: renderValue(args.brain ?? null, lacunas),
  });

  sections.push({
    id: "closing",
    title: "IX. Termos e fechamento",
    body: renderClosing(args.case, lacunas),
  });

  // F4.1 — Bloco de lacunas/normas não indexadas.
  if (unindexed.length > 0) {
    sections.push({
      id: "gap_law",
      title: "X. Lacunas de complementação",
      body: renderUnindexedBlock(unindexed),
    });
  }

  const content = sections.map((s) => `## ${s.title}\n\n${s.body}`).join("\n\n");

  return {
    content,
    groundingChunkIds: Array.from(new Set(groundingChunkIds)),
    sections: sections.map((s) => ({ id: s.id, title: s.title, chars: s.body.length })),
    lacunas: dedupeStrings(lacunas),
    unindexedFoundations: unindexed,
    usedPinnedSources,
    usedBrainContext: !!args.brain,
  };
}

/* ---------------------------- renderers --------------------------------- */

function renderHeader(c: Case, brain: CaseBrain | null, lacunas: string[]): string {
  const tribunalLabel = c.tribunalCode ? getTribunal(c.tribunalCode)?.name ?? c.tribunalCode : null;
  const ufHint = c.uf ? ` — ${c.uf}` : "";
  const processHint = c.processNumber ? `\n\nProcesso n.º ${c.processNumber}` : "";

  // F4: escolhe rito a partir de brain.probableMeasure
  const measureKind = brain?.probableMeasure?.kind;
  if (measureKind === "MS") {
    const authority = brain?.probableAuthority;
    if (authority?.name && authority?.entity) {
      return `Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(íza) de Direito da Vara da Fazenda Pública${ufHint}, sob cuja jurisdição se encontra a autoridade coatora **${authority.name}** (${authority.role} — ${authority.entity}).${processHint}`;
    }
    if (authority?.entity) {
      return `Excelentíssimo(a) Senhor(a) Doutor(a) Juiz(íza) de Direito da Vara da Fazenda Pública${ufHint} — autoridade coatora indicada: ${authority.entity}.${processHint}`;
    }
    lacunas.push("Identificar autoridade coatora (nome, cargo, órgão) para o cabeçalho do MS.");
    return `Excelentíssimo(a) Juiz(íza) de Direito da Vara da Fazenda Pública${ufHint}.${processHint}`;
  }
  if (measureKind === "OBRIGACAO_FAZER") {
    return `Excelentíssimo(a) Juiz(íza) de Direito da Vara da Fazenda Pública${ufHint} (ou da Vara competente em razão da matéria).${processHint}`;
  }
  if (tribunalLabel) {
    return `Excelentíssimo(a) Juiz(íza) de Direito do(a) ${tribunalLabel}${ufHint}.${processHint}`;
  }
  // Sem dados — lacuna explícita em vez de placeholder mascarado.
  lacunas.push("Definir juízo competente e tribunal (sem registro no caso).");
  return `Excelentíssimo(a) Juiz(íza) de Direito competente${ufHint}.${processHint}`;
}

function renderParties(
  parties: CaseParty[],
  brain: CaseBrain | null,
  lacunas: string[],
): string {
  const blocks: string[] = [];

  // F4: preferência ao brain (com endereço/contato/relação).
  const brainParties = brain?.parties ?? [];
  const hasAnything = parties.length > 0 || brainParties.length > 0;
  if (!hasAnything) {
    lacunas.push("Identificar partes (autora, ré, terceiros) para a qualificação.");
    return "_Partes a qualificar._";
  }

  const author = brainParties.filter((p) => p.role === "assisted_party");
  const child = brainParties.filter((p) => p.role === "child_or_dependent");
  const opposing = brainParties.filter((p) => p.role === "opposing_party");
  const authority = brainParties.filter((p) => p.role === "authority");
  const others = brainParties.filter(
    (p) =>
      p.role !== "assisted_party" &&
      p.role !== "child_or_dependent" &&
      p.role !== "opposing_party" &&
      p.role !== "authority",
  );

  if (author.length === 0 && parties.some((p) => p.role === CasePartyRole.AUTHOR)) {
    blocks.push(renderSimplePartyBlock("Parte Autora", parties.filter((p) => p.role === CasePartyRole.AUTHOR)));
  } else if (author.length > 0) {
    blocks.push(`**Parte Autora**\n\n${author.map(renderBrainPartyLine).join("\n")}`);
  }

  if (child.length > 0) {
    blocks.push(`**Beneficiário(a) / Interessado(a)**\n\n${child.map(renderBrainPartyLine).join("\n")}`);
  }

  if (opposing.length === 0 && parties.some((p) => p.role === CasePartyRole.DEFENDANT)) {
    blocks.push(renderSimplePartyBlock("Parte Ré", parties.filter((p) => p.role === CasePartyRole.DEFENDANT)));
  } else if (opposing.length > 0) {
    blocks.push(`**Parte Ré**\n\n${opposing.map(renderBrainPartyLine).join("\n")}`);
  }

  if (authority.length > 0) {
    blocks.push(`**Autoridade pública envolvida**\n\n${authority.map(renderBrainPartyLine).join("\n")}`);
  }

  if (others.length > 0) {
    blocks.push(`**Outras partes**\n\n${others.map((p) => `- ${p.role}: ${p.name}`).join("\n")}`);
  }

  if (parties.some((p) => p.role === CasePartyRole.INTERVENING) && brainParties.length === 0) {
    blocks.push(renderSimplePartyBlock("Terceiros interessados", parties.filter((p) => p.role === CasePartyRole.INTERVENING)));
  }

  return blocks.join("\n\n");
}

function renderBrainPartyLine(p: BrainParty): string {
  const docHint = p.document ? ` — ${p.document}` : "";
  const rel = p.relationship ? ` (${p.relationship})` : "";
  const ageHint = p.age !== undefined ? `, ${p.age} ano(s)` : "";
  const addr = p.address ? `\n  · Endereço: ${p.address}` : "";
  const contact = p.contact ? `\n  · Contato: ${p.contact}` : "";
  return `- **${p.name}**${rel}${ageHint}${docHint}${addr}${contact}`;
}

function renderSimplePartyBlock(title: string, list: CaseParty[]): string {
  if (!list.length) return "";
  return `**${title}**\n\n${list.map((p) => `- ${p.name}${p.document ? ` — ${p.document}` : ""}`).join("\n")}`;
}

function renderFacts(
  facts: CaseFact[],
  brain: CaseBrain | null,
  lacunas: string[],
): string {
  const brainFacts = brain?.facts ?? [];
  if (facts.length === 0 && brainFacts.length === 0) {
    lacunas.push("Coletar e organizar fatos relevantes (datas, condutas, sequência).");
    return "_Fatos a complementar._";
  }
  // Preferência: brain (mais completo, com data normalizada e evidência), depois facts legacy.
  if (brainFacts.length > 0) {
    return brainFacts
      .map((f, idx) => {
        const num = String(idx + 1).padStart(2, "0");
        const dateNote = f.date ? ` _(em ${f.date})_` : "";
        const ev = f.evidenceRefs.length ? ` _(documento(s): ${f.evidenceRefs.length})_` : "";
        return `**${num}.** ${f.text}${dateNote}${ev}`;
      })
      .join("\n\n");
  }
  return facts
    .map((f, idx) => {
      const num = String(idx + 1).padStart(2, "0");
      const dateNote = f.dates?.length ? ` _(referência temporal: ${f.dates.join(", ")})_` : "";
      return `**${num}.** ${f.text}${dateNote}`;
    })
    .join("\n\n");
}

function renderLaw(
  foundations: ApprovedLegalFoundation[],
  strategy: StrategySynthesis | undefined,
  groundingOut: string[],
  pinnedSources: CaseLegalSource[],
  brain: CaseBrain | null,
): string {
  const sections: string[] = [];
  if (strategy?.thesis) sections.push(`**Tese central:** ${strategy.thesis}`);
  if (strategy?.arguments?.length) {
    sections.push(
      `**Argumentos centrais:**\n\n` +
        strategy.arguments
          .map((a, i) => `${i + 1}. ${a.headline}${a.excerpt ? ` — _${a.excerpt}_` : ""}`)
          .join("\n"),
    );
  }

  // F4 — pinnedSources priorizadas, depois retrieval (sem duplicar normas).
  const seenNormUrn = new Set<string>();
  const seenChunkId = new Set<string>();
  const lines: string[] = [];

  for (const ps of pinnedSources) {
    if (ps.chunkId && !seenChunkId.has(ps.chunkId)) {
      seenChunkId.add(ps.chunkId);
      groundingOut.push(ps.chunkId);
    }
    if (ps.normUrn && !seenNormUrn.has(ps.normUrn)) {
      seenNormUrn.add(ps.normUrn);
    }
    const headline = ps.normUrn ?? ps.articleRef ?? "Fundamento pinado";
    const articleHint = ps.articleRef && ps.normUrn ? ` — ${ps.articleRef}` : "";
    const excerpt = (ps.excerpt ?? "").slice(0, 320).trim();
    lines.push(
      `- _${headline}${articleHint}_${ps.normUrn ? ` (\`${ps.normUrn}\`)` : ""}${excerpt ? ` — “${excerpt}…”` : ""}`,
    );
  }

  // Filtra retrieval por área: se brain não inclui Constitucional/ADCT-related,
  // pula chunks ADCT (a menos que pinned explicitamente).
  const skipAdct = !areaIncludes(brain?.area, ["constitucional"]);
  for (const c of foundations) {
    if (lines.length >= 8) break;
    if (seenNormUrn.has(c.urn)) continue;
    if (skipAdct && /adct|disposi[cç][oõ]es\s+transit[óo]rias/i.test(c.title ?? "")) continue;
    seenNormUrn.add(c.urn);
    seenChunkId.add(c.chunkId);
    groundingOut.push(c.chunkId);
    const headline = c.title || c.identifier || c.urn;
    const articleHint = c.articleRef ? ` — ${c.articleRef}` : "";
    const previewRaw = (c.excerpt ?? "").slice(0, 320).replace(/\s+/g, " ").trim();
    const preview = previewRaw.length === 320 ? `${previewRaw}…` : previewRaw;
    lines.push(`- _${headline}${articleHint}_ (\`${c.urn}\`) — “${preview}”`);
  }

  if (lines.length > 0) {
    sections.push("**Fundamentação normativa:**\n\n" + lines.join("\n"));
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

function renderRequests(
  requests: CaseRequest[],
  brain: CaseBrain | null,
  lacunas: string[],
): string {
  const brainRequests = brain?.requests ?? [];
  const hasAny = requests.length > 0 || brainRequests.length > 0;
  if (!hasAny) {
    lacunas.push("Definir pedidos jurídicos (principais, subsidiários, urgência, prova).");
    return "_Pedidos a definir._";
  }

  const lines: string[] = ["Diante do exposto, requer:"];

  // Brain primeiro (mais granular), sem duplicar com legacy.
  const seenTexts = new Set<string>();
  const pushLine = (text: string, prefix: string) => {
    const k = text.toLowerCase().trim();
    if (seenTexts.has(k)) return;
    seenTexts.add(k);
    lines.push(`${prefix} ${stripVerbHead(text)};`);
  };

  const partition = (
    list: BrainRequest[],
    kind: BrainRequest["kind"],
  ): BrainRequest[] => list.filter((r) => r.kind === kind);

  const main = [
    ...partition(brainRequests, "MAIN"),
    ...requests.filter((r) => r.kind === CaseRequestKind.MAIN),
  ];
  const urgency = [
    ...partition(brainRequests, "URGENCY"),
    ...requests.filter((r) => r.kind === CaseRequestKind.URGENCY),
  ];
  const provisional = [
    ...partition(brainRequests, "PROVISIONAL"),
    ...requests.filter((r) => r.kind === CaseRequestKind.PROVISIONAL),
  ];
  const subs = [
    ...partition(brainRequests, "SUBSIDIARY"),
    ...requests.filter((r) => r.kind === CaseRequestKind.SUBSIDIARY),
  ];
  const proc = [
    ...partition(brainRequests, "PROCEDURAL"),
    ...requests.filter((r) => r.kind === CaseRequestKind.PROCEDURAL),
  ];

  for (const r of urgency) pushLine(r.text, "a) Liminarmente,");
  for (const r of main) pushLine(r.text, "b)");
  for (const r of provisional) pushLine(r.text, "c) Cominatoriamente,");
  for (const r of subs) pushLine(r.text, "d) Subsidiariamente,");
  for (const r of proc) pushLine(r.text, "e)");

  if (lines.length === 1) {
    lacunas.push("Reclassificar pedidos por tipo (urgência, principal, subsidiário).");
    return "_Pedidos a definir._";
  }
  return lines.join("\n");
}

function renderUrgency(
  brain: CaseBrain | null,
  manifest: CorpusManifest | undefined,
  unindexed: Array<{ urn?: string; label: string; suggestedUse?: string }>,
): string {
  const urgencyReqs = brain?.requests?.filter((r) => r.kind === "URGENCY") ?? [];
  const lines: string[] = [];

  // F4.1 — só cita art. 300 CPC se o CPC estiver indexado; senão, vira lacuna.
  const cpcCitation: CitationCandidate = {
    urn: "urn:lex:br:federal:lei:13.105:2015",
    articleRef: "art. 300",
    label: "CPC (Lei 13.105/2015)",
    suggestedUse:
      "Citar art. 300 do CPC para fundamentar tutela de urgência (probabilidade do direito + perigo de dano).",
  };
  const msCitation: CitationCandidate = {
    urn: "urn:lex:br:federal:lei:12.016:2009",
    articleRef: "art. 7º, III",
    label: "Lei do Mandado de Segurança (Lei 12.016/2009)",
    suggestedUse:
      "Citar art. 7º, III, da Lei 12.016/2009 para fundamentar liminar em mandado de segurança.",
  };

  const cpcDecision = manifest ? decideCitationSync(cpcCitation, manifest) : { allowed: false as const, reason: "Manifest não disponível" };
  const msDecision = manifest && brain?.probableMeasure?.kind === "MS"
    ? decideCitationSync(msCitation, manifest)
    : null;

  if (cpcDecision.allowed) {
    lines.push("Presentes os requisitos do art. 300 do CPC — probabilidade do direito e perigo de dano —, requer-se:");
  } else {
    unindexed.push(cpcCitation);
  }
  if (msDecision && msDecision.allowed) {
    lines.push("Nos termos do art. 7º, III, da Lei 12.016/2009, requer-se:");
  } else if (msDecision && !msDecision.allowed) {
    unindexed.push(msCitation);
  }

  if (lines.length === 0) {
    lines.push(
      "Demonstrados os requisitos da tutela de urgência (probabilidade do direito e perigo de dano), requer-se:",
    );
  }

  for (const r of urgencyReqs) {
    lines.push(`- ${stripVerbHead(r.text)};`);
  }
  if (urgencyReqs.length === 0) {
    lines.push("- (a explicitar nos pedidos da seção V).");
  }
  return lines.join("\n");
}

function renderEvidence(
  reqs: CaseRequest[],
  documents: Array<{ originalName: string }>,
): string {
  const evidenceReqs = reqs.filter((r) => r.kind === CaseRequestKind.EVIDENCE);
  const docList = documents.length
    ? `\n\n**Documentos já anexados:**\n${documents.map((d) => `- ${d.originalName}`).join("\n")}`
    : "";
  if (!evidenceReqs.length) {
    return (
      "Protesta provar o alegado por todos os meios em direito admitidos, em especial documental, testemunhal e pericial, se necessário." +
      docList
    );
  }
  return (
    ["Protesta provar o alegado mediante:", ...evidenceReqs.map((r) => `- ${stripVerbHead(r.text)};`)].join("\n") + docList
  );
}

function renderValue(brain: CaseBrain | null, lacunas: string[]): string {
  // brain pode incluir um valor sugerido em campos futuros (não consolidado ainda).
  // Mantemos lacuna explícita.
  void brain;
  lacunas.push("Definir valor da causa após apuração de prejuízo material/proveito econômico.");
  return "_Lacuna: definir valor da causa após apuração de prejuízo material/proveito econômico._";
}

function renderClosing(c: Case, lacunas: string[]): string {
  lacunas.push("Preencher local, data, OAB e nome do(a) advogado(a) responsável.");
  void c;
  return "Nestes termos, pede deferimento.\n\n[local], [data].\n\n[OAB] [Nome do Advogado]";
}

function renderUnindexedBlock(
  list: Array<{ urn?: string; label: string; suggestedUse?: string }>,
): string {
  const intro =
    "Os fundamentos abaixo não estão indexados no corpus atual e devem ser revisados manualmente:";
  const lines = list.map((item, i) => {
    const head = `${i + 1}. **${item.label}**`;
    const use = item.suggestedUse ? ` — ${item.suggestedUse}` : "";
    return `${head}${use}`;
  });
  return [intro, "", ...lines].join("\n");
}

/* ---------------------------- helpers ---------------------------------- */

function stripVerbHead(text: string): string {
  return text
    .replace(/^\s*\d+[).\-]\s*/, "")
    .replace(/^\s*(requer-se|requer|pleiteia|postula|pede-se|pede|solicita|pugna|pretende)\s+/i, "")
    .trim()
    .replace(/[.;]\s*$/, "");
}

function areaIncludes(areas: string[] | undefined, needles: string[]): boolean {
  if (!areas || areas.length === 0) return false;
  const lower = areas.map((a) => a.toLowerCase());
  return needles.some((n) => lower.some((a) => a.includes(n)));
}

function dedupeStrings(arr: string[]): string[] {
  return Array.from(new Set(arr.filter((s) => s.trim().length > 0)));
}
