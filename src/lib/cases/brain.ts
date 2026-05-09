/**
 * Case Brain v1 — consolidação LLM-first auditável (F2).
 *
 * Pipeline:
 *   1. Pré-extract heurístico (regex / NER simples) → seed determinístico.
 *   2. LLM call (DeepSeek via factory) com JSON schema estrito.
 *   3. Validador determinístico (`validateBrain`) — descarta itens inválidos.
 *   4. Cache por `sha256(rawInput + sortedDocHashes + checklist)`.
 *
 * Cada item carrega `sourceText`, `confidence`, `origin`. Resultado
 * persiste em `Case.metadataJson.brain` (ver `persistBrainEntities` em
 * `repository.ts`).
 *
 * Quando o LLM falha (3 retries), o resultado é marcado `degraded=true`
 * e o pré-extract heurístico se torna o output (UI mostra alerta).
 */

import { createHash } from "node:crypto";
import { generateText } from "ai";
import {
  CasePartyRole,
  CaseRequestKind,
  CaseRiskKind,
  CaseRiskSeverity,
  Prisma,
} from "@prisma/client";
import { getChatLanguageModel } from "@/lib/ai/llm";
import { cacheGet, cacheSet } from "@/lib/redis";
import { getLogger } from "@/lib/logger";
import { runIntake } from "./intake";
import { parseSlashCommands } from "./slash-commands";
import { validateBrain } from "./brain-validator";
import { computeProceduralReadiness } from "./readiness";
import type {
  BrainFact,
  BrainEvidence,
  BrainParty,
  BrainPartyRole,
  BrainRequest,
  BrainRequestKind,
  BrainRisk,
  CaseBrain,
  ChecklistResponses,
} from "./brain-types";

const log = getLogger("case.brain");

const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias
const CACHE_PREFIX = "lex:case-brain:v1:";
const LLM_TIMEOUT_MS = 25_000;
const LLM_MAX_RETRIES = 3;

export type BrainInputDoc = {
  id: string;
  originalName: string;
  /** Texto extraído (já presente em Document.extractedText). Pode ser truncado. */
  text: string;
};

export type BrainConsolidationInput = {
  rawInput: string;
  documents: BrainInputDoc[];
  pinnedSources?: Array<{ chunkId: string; normUrn?: string | null; articleRef?: string | null; excerpt?: string }>;
  checklistResponses?: ChecklistResponses;
  manualNotes?: string[];
};

export type BrainConsolidationResult = {
  brain: CaseBrain;
  cached: boolean;
  llmUsed: boolean;
  warnings: string[];
};

/* ----------------------------- public API ------------------------------ */

/**
 * Calcula um hash determinístico do input para chave de cache.
 * Inclui rawInput + textos dos docs (ordenados por id) + checklist.
 */
export function brainInputHash(input: BrainConsolidationInput): string {
  const docs = [...input.documents]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => `${d.id}::${createHash("sha256").update(d.text).digest("hex")}`);
  const checklistHash = input.checklistResponses
    ? createHash("sha256")
        .update(JSON.stringify(input.checklistResponses))
        .digest("hex")
    : "none";
  const notesHash = (input.manualNotes ?? []).join("|");
  const payload = JSON.stringify({
    raw: input.rawInput,
    docs,
    checklist: checklistHash,
    notes: notesHash,
  });
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Consolida o Case Brain. Retorna o brain + flags úteis para auditoria.
 *
 * Estratégia:
 *  - Cache hit → devolve direto (TTL 7 dias).
 *  - Pré-extract heurístico → semente "garantida".
 *  - LLM enriquece e estrutura (com JSON schema explícito).
 *  - Validador peneira saída do LLM → fallback ao heurístico em campos vazios.
 *  - `proceduralReadiness` calculada por `computeProceduralReadiness`.
 */
export async function consolidateCaseBrain(
  input: BrainConsolidationInput,
): Promise<BrainConsolidationResult> {
  const inputHash = brainInputHash(input);
  const cacheKey = `${CACHE_PREFIX}${inputHash}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    try {
      const brain = JSON.parse(cached) as CaseBrain;
      return { brain, cached: true, llmUsed: true, warnings: [] };
    } catch {
      // cache corrompido, segue para reconsolidação
    }
  }

  // 1) Pré-extract heurístico — sempre roda, gera semente confiável.
  const seed = preExtractHeuristic(input);

  // 2) Tenta LLM. Se falhar todas as retries, usa só o seed.
  let llmBrain: ReturnType<typeof validateBrain>["partial"] | null = null;
  let llmUsed = false;
  const warnings: string[] = [];

  try {
    const llmResult = await callLlmForBrain(input, seed);
    llmBrain = llmResult.partial;
    warnings.push(...llmResult.warnings);
    llmUsed = true;
  } catch (e) {
    log.warnOnce("llm-failed", `LLM falhou no Case Brain: ${(e as Error).message}`);
    warnings.push(`LLM indisponível: ${(e as Error).message}`);
  }

  // 3) Mesclar. Quando LLM produziu campo, usa ele. Senão, fallback ao seed.
  const merged = mergeSeedAndLlm(seed, llmBrain);

  // 4) Calcular proceduralReadiness.
  const readiness = computeProceduralReadiness({
    parties: merged.parties,
    facts: merged.facts,
    requests: merged.requests,
    evidence: merged.evidence,
    probableAuthority: merged.probableAuthority,
    missingDocuments: merged.missingDocuments,
    checklistResponses: input.checklistResponses,
    documents: input.documents,
    area: merged.area,
  });

  const brain: CaseBrain = {
    brainVersion: 1,
    inputHash,
    degraded: !llmUsed,
    title: merged.title,
    area: merged.area,
    phase: merged.phase,
    problem: merged.problem,
    objective: merged.objective,
    thesis: merged.thesis,
    probableMeasure: merged.probableMeasure,
    narrative: merged.narrative,
    parties: merged.parties,
    ...(merged.probableAuthority ? { probableAuthority: merged.probableAuthority } : {}),
    facts: merged.facts,
    requests: merged.requests,
    risks: merged.risks,
    evidence: merged.evidence,
    missingDocuments: merged.missingDocuments,
    suggestedFoundations: merged.suggestedFoundations,
    inconsistencies: merged.inconsistencies,
    proceduralReadiness: readiness,
    ...(input.checklistResponses ? { checklistResponses: input.checklistResponses } : {}),
    generatedAt: new Date().toISOString(),
  };

  await cacheSet(cacheKey, JSON.stringify(brain), CACHE_TTL_SECONDS);

  return { brain, cached: false, llmUsed, warnings };
}

/* --------------------- pré-extract heurístico -------------------------- */

function preExtractHeuristic(
  input: BrainConsolidationInput,
): ReturnType<typeof validateBrain>["partial"] {
  const { cleanedText, commands } = parseSlashCommands(input.rawInput || " ");
  const intake = runIntake(cleanedText || " ");

  const commandParties: BrainParty[] = [];
  const commandFacts: BrainFact[] = [];
  const commandRequests: BrainRequest[] = [];
  const commandRisks: BrainRisk[] = [];
  const commandEvidence: BrainEvidence[] = [];
  const commandMissingDocuments: string[] = [];

  for (const cmd of commands) {
    const value = cmd.value.trim();
    if (!value) continue;
    switch (cmd.name) {
      case "autora":
      case "autor":
        commandParties.push({
          role: "assisted_party",
          name: value,
          sourceText: cmd.sourceText,
          confidence: 0.98,
          origin: "user_command",
        });
        break;
      case "reu":
      case "réu":
        commandParties.push({
          role: "opposing_party",
          name: value,
          sourceText: cmd.sourceText,
          confidence: 0.98,
          origin: "user_command",
        });
        break;
      case "fato":
        commandFacts.push({
          text: value,
          sourceText: cmd.sourceText,
          confidence: 0.98,
          origin: "user_command",
          evidenceRefs: [],
        });
        break;
      case "pedido":
        commandRequests.push({
          text: value,
          kind: "MAIN",
          sourceText: cmd.sourceText,
          confidence: 0.98,
          origin: "user_command",
        });
        break;
      case "urgencia":
        commandRequests.push({
          text: value,
          kind: "URGENCY",
          sourceText: cmd.sourceText,
          confidence: 0.98,
          origin: "user_command",
        });
        break;
      case "documento":
        // Interpretação operacional: o usuário está anotando uma evidência/documento relevante.
        // (Documentos "faltantes" continuam sendo inferidos/checados via brain/readiness.)
        commandEvidence.push({
          kind: "document",
          ref: value,
          sourceText: cmd.sourceText,
          confidence: 0.95,
          origin: "user_command",
        });
        break;
      case "risco":
        commandRisks.push({
          title: value.slice(0, 80),
          detail: value,
          severity: "MEDIUM",
          sourceText: cmd.sourceText,
          confidence: 0.95,
          origin: "user_command",
        });
        break;
      case "observacao":
        // Observação vira "missingDocuments" quando o usuário explicitamente lista uma pendência documental.
        // Caso contrário, ela entra como risco informativo (não bloqueante).
        if (/comprovante|laudo|negativa|declara[cç][aã]o|documento|certid[aã]o/i.test(value)) {
          commandMissingDocuments.push(value);
        } else {
          commandRisks.push({
            title: value.slice(0, 80),
            detail: value,
            severity: "LOW",
            sourceText: cmd.sourceText,
            confidence: 0.9,
            origin: "user_command",
          });
        }
        break;
      case "prazo":
      case "valor":
        commandFacts.push({
          text: `${cmd.name.toUpperCase()}: ${value}`,
          sourceText: cmd.sourceText,
          confidence: 0.98,
          origin: "user_command",
          evidenceRefs: [],
        });
        break;
    }
  }

  const parties: BrainParty[] = intake.parties.map((p) => ({
    role: roleFromIntake(p.role),
    name: p.name,
    sourceText: p.name,
    confidence: 0.6,
    origin: "input" as const,
    ...(p.document ? { document: p.document } : {}),
  }));

  const facts: BrainFact[] = intake.facts.map((f) => ({
    text: f.text,
    sourceText: f.text,
    confidence: f.confidence,
    origin: "input" as const,
    evidenceRefs: [],
    ...(f.dates && f.dates.length > 0 && f.dates[0] ? { date: f.dates[0] } : {}),
  }));

  const requests: BrainRequest[] = intake.requests.map((r) => ({
    text: r.text,
    kind: requestKindFromIntake(r.kind),
    sourceText: r.text,
    confidence: 0.65,
    origin: "input" as const,
  }));

  // Adiciona documentos como evidência conhecida.
  const evidence = input.documents.map((d) => ({
    kind: "document",
    ref: d.id,
    sourceText: d.originalName,
    confidence: 0.95,
    origin: `document:${d.id}` as const,
  }));

  return {
    title: intake.title || "Caso sem título",
    area: [],
    phase: "pre_processual",
    problem: intake.summary ?? "",
    objective: "",
    thesis: "",
    probableMeasure: {
      kind: "OUTRO",
      rationale: "Pré-extract heurístico — definir após análise jurídica.",
    },
    narrative: intake.summary ?? cleanedText.slice(0, 600) ?? input.rawInput.slice(0, 600),
    parties: [...commandParties, ...parties],
    facts: [...commandFacts, ...facts],
    requests: [...commandRequests, ...requests],
    risks: [...commandRisks],
    evidence: [...evidence, ...commandEvidence],
    missingDocuments: [...commandMissingDocuments],
    suggestedFoundations: [],
    inconsistencies: [],
  };
}

function roleFromIntake(role: CasePartyRole): BrainPartyRole {
  switch (role) {
    case CasePartyRole.AUTHOR:
      return "assisted_party";
    case CasePartyRole.DEFENDANT:
      return "opposing_party";
    case CasePartyRole.INTERVENING:
      return "third_party";
    default:
      return "other";
  }
}

function requestKindFromIntake(kind: CaseRequestKind): BrainRequestKind {
  switch (kind) {
    case CaseRequestKind.MAIN:
      return "MAIN";
    case CaseRequestKind.SUBSIDIARY:
      return "SUBSIDIARY";
    case CaseRequestKind.URGENCY:
      return "URGENCY";
    case CaseRequestKind.PROVISIONAL:
      return "PROVISIONAL";
    case CaseRequestKind.EVIDENCE:
      return "EVIDENCE";
    case CaseRequestKind.PROCEDURAL:
      return "PROCEDURAL";
    default:
      return "OTHER";
  }
}

/* ------------------------- LLM call & schema --------------------------- */

const BRAIN_JSON_SCHEMA = `{
  "title": "string (curto, com partes principais)",
  "area": ["string (ex.: Constitucional, Educação, Infância)"],
  "phase": "pre_processual | judicial | recursal | execucao | outro",
  "problem": "string descrevendo o problema jurídico",
  "objective": "string descrevendo o objetivo do cliente",
  "thesis": "string com a tese jurídica principal",
  "probableMeasure": {
    "kind": "MS | OBRIGACAO_FAZER | INDENIZATORIA | DECLARATORIA | POSSESSORIA | EXECUCAO | MEDIDA_CAUTELAR | OUTRO",
    "rationale": "string"
  },
  "narrative": "string com 2-3 parágrafos da narrativa do caso",
  "parties": [
    { "role": "assisted_party|child_or_dependent|opposing_party|authority|third_party|other",
      "name": "string", "document": "CPF/CNPJ?", "contact": "?",
      "address": "?", "age": 0, "relationship": "string?",
      "sourceText": "trecho literal do input", "confidence": 0.0..1.0,
      "origin": "input|checklist|document:<docId>" }
  ],
  "probableAuthority": {
    "name": "string", "role": "string", "entity": "string",
    "sourceText": "trecho", "confidence": 0.0..1.0, "origin": "..."
  },
  "facts": [
    { "text": "string", "date": "yyyy-mm-dd?", "evidenceRefs": ["docId"],
      "sourceText": "trecho", "confidence": 0.0..1.0, "origin": "..." }
  ],
  "requests": [
    { "text": "string", "kind": "URGENCY|MAIN|SUBSIDIARY|PROVISIONAL|EVIDENCE|PROCEDURAL|OTHER",
      "sourceText": "trecho", "confidence": 0.0..1.0, "origin": "..." }
  ],
  "risks": [
    { "title": "string", "detail": "string", "severity": "LOW|MEDIUM|HIGH|CRITICAL",
      "mitigation": "?", "sourceText": "trecho", "confidence": 0.0..1.0, "origin": "..." }
  ],
  "evidence": [
    { "kind": "document|testimony|expertise|other", "ref": "docId|description",
      "sourceText": "trecho", "confidence": 0.0..1.0, "origin": "..." }
  ],
  "missingDocuments": ["string descrevendo documento faltante"],
  "suggestedFoundations": [
    { "urn": "urn:lex:...?", "articleRef": "Art. 5º", "rationale": "string" }
  ],
  "inconsistencies": [
    { "kind": "string", "description": "string", "evidence": "string" }
  ]
}`;

function buildBrainPrompt(
  input: BrainConsolidationInput,
  seed: ReturnType<typeof preExtractHeuristic>,
): string {
  const docExcerpts = input.documents
    .slice(0, 8)
    .map((d) => `\n---\n[doc:${d.id}] ${d.originalName}\n${d.text.slice(0, 4000)}`)
    .join("\n");

  const checklistBlock = input.checklistResponses
    ? `\n\n## Respostas do checklist (templateId: ${input.checklistResponses.templateId}, v${input.checklistResponses.version})\n${JSON.stringify(input.checklistResponses.answers, null, 2)}`
    : "";

  const pinnedBlock =
    input.pinnedSources && input.pinnedSources.length > 0
      ? `\n\n## Fundamentos pinados pelo advogado\n${input.pinnedSources
          .map(
            (s) =>
              `- ${s.articleRef ?? s.normUrn ?? s.chunkId}: ${(s.excerpt ?? "").slice(0, 240)}`,
          )
          .join("\n")}`
      : "";

  const notesBlock =
    input.manualNotes && input.manualNotes.length > 0
      ? `\n\n## Notas manuais do advogado\n${input.manualNotes.map((n) => `- ${n}`).join("\n")}`
      : "";

  return `Você é um assistente jurídico brasileiro. Sua tarefa é CONSOLIDAR a inteligência do caso em JSON estruturado, com auditabilidade.

REGRAS CRÍTICAS:
1. Devolva APENAS um objeto JSON válido. Sem markdown, sem comentários, sem prefixos. Comece com '{' e termine com '}'.
2. Cada item de \`parties\`, \`facts\`, \`requests\`, \`risks\`, \`evidence\` DEVE ter: "sourceText" (trecho literal do input), "confidence" (0..1) e "origin" (origem da informação).
3. Se um campo não puder ser preenchido com confiança, devolva array vazio ou string vazia. NÃO INVENTE.
4. Pedidos NÃO são fatos. Verbo dispositivo ("requer", "pede", "pleiteia") = pedido. Verbo descritivo ("procurou", "informou", "compareceu") = fato.
5. Quando relato é incompleto, popule \`missingDocuments\` com o que faltaria para uma peça processual sólida.
6. Identifique a parte assistida (assisted_party), interessada/menor (child_or_dependent) e contrária (opposing_party).
7. Se houver autoridade pública envolvida, popule \`probableAuthority\`.
8. Use a língua portuguesa do Brasil. Datas no formato yyyy-mm-dd.

ESQUEMA OBRIGATÓRIO:
${BRAIN_JSON_SCHEMA}

## Pré-extract heurístico (use como semente — pode corrigir/expandir)
${JSON.stringify({ parties: seed.parties.slice(0, 8), facts: seed.facts.slice(0, 8), requests: seed.requests.slice(0, 6) }, null, 2)}

## Relato bruto do caso
${input.rawInput || "(vazio — usuário criou caso vazio ou via documento; use os documentos abaixo para popular)"}

## Documentos vinculados ao caso${docExcerpts || "\n(nenhum)"}${checklistBlock}${pinnedBlock}${notesBlock}

Devolva APENAS o JSON.`;
}

async function callLlmForBrain(
  input: BrainConsolidationInput,
  seed: ReturnType<typeof preExtractHeuristic>,
): Promise<ReturnType<typeof validateBrain>> {
  const prompt = buildBrainPrompt(input, seed);
  // texto-fonte completo para a verificação cruzada do validador.
  const sourceText = [
    input.rawInput,
    ...input.documents.map((d) => d.text),
    JSON.stringify(input.checklistResponses?.answers ?? {}),
    ...(input.manualNotes ?? []),
  ].join("\n");

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= LLM_MAX_RETRIES; attempt += 1) {
    try {
      const result = await Promise.race([
        generateText({
          model: getChatLanguageModel(),
          prompt,
          temperature: 0.1,
          maxTokens: 3500,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`LLM timeout ${LLM_TIMEOUT_MS}ms`)),
            LLM_TIMEOUT_MS,
          ),
        ),
      ]);

      const cleaned = stripMarkdownJson(result.text);
      const parsed = JSON.parse(cleaned) as unknown;
      return validateBrain(parsed, sourceText);
    } catch (e) {
      lastErr = e as Error;
      log.warnOnce(
        `llm-attempt-${attempt}`,
        `Tentativa ${attempt}/${LLM_MAX_RETRIES} falhou: ${(e as Error).message}`,
      );
    }
  }
  throw lastErr ?? new Error("LLM falhou sem detalhes");
}

function stripMarkdownJson(text: string): string {
  // Remove ```json ... ``` se vier; pega primeiro objeto { ... } válido.
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = (fenceMatch ? fenceMatch[1] : text) ?? "";
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1) return candidate.trim();
  return candidate.slice(start, end + 1);
}

/* --------------------------- merge helpers ----------------------------- */

function mergeSeedAndLlm(
  seed: ReturnType<typeof preExtractHeuristic>,
  llm: ReturnType<typeof validateBrain>["partial"] | null,
): ReturnType<typeof preExtractHeuristic> {
  if (!llm) return seed;
  // LLM tem prioridade nos campos textuais; arrays são somados sem duplicar.
  return {
    title: pickNonEmpty(llm.title, seed.title),
    area: llm.area.length > 0 ? llm.area : seed.area,
    phase: llm.phase ?? seed.phase,
    problem: pickNonEmpty(llm.problem, seed.problem),
    objective: pickNonEmpty(llm.objective, seed.objective),
    thesis: pickNonEmpty(llm.thesis, seed.thesis),
    probableMeasure:
      llm.probableMeasure?.kind && llm.probableMeasure.kind !== "OUTRO"
        ? llm.probableMeasure
        : seed.probableMeasure,
    narrative: pickNonEmpty(llm.narrative, seed.narrative),
    parties: dedupeBy([...seed.parties, ...llm.parties], (p) => `${p.role}::${p.name.toLowerCase()}`),
    ...(llm.probableAuthority ? { probableAuthority: llm.probableAuthority } : {}),
    facts: dedupeBy([...seed.facts, ...llm.facts], (f) => f.text.slice(0, 80).toLowerCase()),
    requests: dedupeBy(
      [...seed.requests, ...llm.requests],
      (r) => r.text.slice(0, 80).toLowerCase(),
    ),
    risks: dedupeBy([...llm.risks, ...seed.risks], (r) => r.title.toLowerCase()),
    evidence: dedupeBy(
      [...seed.evidence, ...llm.evidence],
      (e) => `${e.kind}::${e.ref ?? e.sourceText}`,
    ),
    missingDocuments: dedupeBy(
      [...llm.missingDocuments, ...seed.missingDocuments],
      (s) => s.toLowerCase(),
    ),
    suggestedFoundations: dedupeBy(
      [...llm.suggestedFoundations, ...seed.suggestedFoundations],
      (s) => `${s.urn ?? ""}::${s.articleRef ?? ""}`,
    ),
    inconsistencies: [...llm.inconsistencies, ...seed.inconsistencies],
  };
}

function pickNonEmpty(a: string, b: string): string {
  return a && a.trim().length > 0 ? a : b;
}

function dedupeBy<T>(arr: T[], key: (item: T) => string): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const it of arr) {
    const k = key(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

/* ----------------------- persist brain entities ------------------------ */

/**
 * Sincroniza partes/pedidos/riscos do brain com as tabelas relacionais
 * (`CaseParty`, `CaseRequest`, `CaseRisk`). Idempotente por hash do
 * `sourceText`. Roda dentro de transaction se chamado pelo orchestrator.
 *
 * Não APAGA registros — só adiciona o que ainda não existe. O usuário
 * advogado mantém autonomia para editar/deletar manualmente depois.
 */
export async function persistBrainEntities(args: {
  caseId: string;
  brain: CaseBrain;
  prisma: typeof import("@/lib/prisma").prisma | Prisma.TransactionClient;
}) {
  const { caseId, brain, prisma } = args;

  // Fatos — idempotência por prefixo do texto, append por ordinal
  if (brain.facts.length > 0) {
    const existing = await prisma.caseFact.findMany({
      where: { caseId },
      select: { id: true, text: true, ordinal: true },
      orderBy: { ordinal: "asc" },
    });
    const existingTexts = new Set(existing.map((e) => e.text.slice(0, 200).toLowerCase()));
    const startOrdinal = (existing.at(-1)?.ordinal ?? 0) + 1;
    const toCreate = brain.facts
      .filter((f) => !existingTexts.has(f.text.slice(0, 200).toLowerCase()))
      .map((f, i) => ({
        caseId,
        ordinal: startOrdinal + i,
        text: f.text,
        dates: f.date ? [f.date] : [],
        confidence: f.confidence,
      }) satisfies Prisma.CaseFactCreateManyInput);
    if (toCreate.length > 0) {
      await prisma.caseFact.createMany({ data: toCreate });
    }
  }

  // Partes — upsert por hash de role+name
  if (brain.parties.length > 0) {
    const existing = await prisma.caseParty.findMany({
      where: { caseId },
      select: { id: true, role: true, name: true },
    });
    const existingKeys = new Set(
      existing.map((e) => `${e.role}::${e.name.toLowerCase()}`),
    );
    const toCreate = brain.parties.filter((p) => {
      const role = brainPartyRoleToPrisma(p.role);
      return !existingKeys.has(`${role}::${p.name.toLowerCase()}`);
    });
    if (toCreate.length > 0) {
      await prisma.caseParty.createMany({
        data: toCreate.map((p) => {
          const data: Prisma.CasePartyCreateManyInput = {
            caseId,
            role: brainPartyRoleToPrisma(p.role),
            name: p.name,
            kind:
              p.role === "authority"
                ? "PUBLIC_ENTITY"
                : p.role === "child_or_dependent"
                  ? "PERSON"
                  : "UNKNOWN",
            ...(p.document ? { document: p.document } : {}),
          };
          const meta: Record<string, unknown> = {};
          meta["origin"] = p.origin;
          meta["sourceText"] = p.sourceText;
          meta["confidence"] = p.confidence;
          if (p.contact) meta["phone"] = p.contact;
          if (p.address) meta["address"] = p.address;
          if (p.age !== undefined) meta["age"] = p.age;
          if (p.relationship) meta["relationship"] = p.relationship;
          if (Object.keys(meta).length > 0) {
            data.metadataJson = meta as Prisma.InputJsonValue;
          }
          return data;
        }),
      });
    }
  }

  // Pedidos — usa kind correto (incluindo PROVISIONAL) e idempotência por text-hash
  if (brain.requests.length > 0) {
    const existing = await prisma.caseRequest.findMany({
      where: { caseId },
      select: { id: true, text: true, ordinal: true },
    });
    const existingTexts = new Set(existing.map((e) => e.text.slice(0, 120).toLowerCase()));
    const startOrdinal = (existing.at(-1)?.ordinal ?? 0) + 1;
    const toCreate = brain.requests
      .filter((r) => !existingTexts.has(r.text.slice(0, 120).toLowerCase()))
      .map((r, i) => ({
        caseId,
        ordinal: startOrdinal + i,
        kind: brainRequestKindToPrisma(r.kind),
        text: r.text,
        metadataJson: {
          origin: r.origin,
          sourceText: r.sourceText,
          confidence: r.confidence,
        } as Prisma.InputJsonValue,
      } satisfies Prisma.CaseRequestCreateManyInput));
    if (toCreate.length > 0) {
      await prisma.caseRequest.createMany({ data: toCreate });
    }
  }

  // Riscos — idempotência por title-hash
  if (brain.risks.length > 0) {
    const existing = await prisma.caseRisk.findMany({
      where: { caseId },
      select: { id: true, title: true },
    });
    const existingTitles = new Set(existing.map((e) => e.title.toLowerCase()));
    const toCreate = brain.risks
      .filter((r) => !existingTitles.has(r.title.toLowerCase()))
      .map(
        (r) =>
          ({
            caseId,
            kind: brainRiskTitleToKind(r.title),
            severity: brainSeverityToPrisma(r.severity),
            title: r.title,
            detail: r.detail,
            evidenceChunkIds: [],
            evidenceNormUrns: [],
          }) satisfies Prisma.CaseRiskCreateManyInput,
      );
    if (toCreate.length > 0) {
      await prisma.caseRisk.createMany({ data: toCreate });
    }
  }
}

function brainPartyRoleToPrisma(r: BrainPartyRole): CasePartyRole {
  switch (r) {
    case "assisted_party":
      return CasePartyRole.AUTHOR;
    case "opposing_party":
    case "authority":
      return CasePartyRole.DEFENDANT;
    case "child_or_dependent":
    case "third_party":
      return CasePartyRole.INTERVENING;
    default:
      return CasePartyRole.OTHER;
  }
}

function brainRequestKindToPrisma(k: BrainRequestKind): CaseRequestKind {
  switch (k) {
    case "URGENCY":
      return CaseRequestKind.URGENCY;
    case "PROVISIONAL":
      return CaseRequestKind.PROVISIONAL;
    case "MAIN":
      return CaseRequestKind.MAIN;
    case "SUBSIDIARY":
      return CaseRequestKind.SUBSIDIARY;
    case "EVIDENCE":
      return CaseRequestKind.EVIDENCE;
    case "PROCEDURAL":
      return CaseRequestKind.PROCEDURAL;
    default:
      return CaseRequestKind.OTHER;
  }
}

function brainSeverityToPrisma(s: BrainRisk["severity"]): CaseRiskSeverity {
  switch (s) {
    case "CRITICAL":
    case "HIGH":
      return CaseRiskSeverity.HIGH;
    case "MEDIUM":
      return CaseRiskSeverity.MEDIUM;
    default:
      return CaseRiskSeverity.LOW;
  }
}

function brainRiskTitleToKind(title: string): CaseRiskKind {
  const lc = title.toLowerCase();
  if (/revogad/.test(lc)) return CaseRiskKind.REVOKED_NORM;
  if (/diverg/.test(lc)) return CaseRiskKind.PRECEDENT_DIVERGENCE;
  if (/lacuna|ausent|sem fundament|sem ancor/.test(lc)) return CaseRiskKind.MISSING_GROUNDING;
  if (/processual|procedimental/.test(lc)) return CaseRiskKind.PROCEDURAL_GAP;
  if (/fragilid|fraco|tese.*frac/.test(lc)) return CaseRiskKind.WEAK_ARGUMENT;
  return CaseRiskKind.OTHER;
}
