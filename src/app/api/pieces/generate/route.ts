import { NextResponse } from "next/server";
import { generateText } from "ai";
import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { retrieveContext } from "@/lib/retrieval/hybrid-retriever";
import { loadMemoryBlock } from "@/lib/memory/engine";
import { SYSTEM_BASE, groundingFromChunks, styleInjection } from "@/lib/ai/prompts";
import { getPieceLanguageModel, getPieceModelId, getChatProviderId } from "@/lib/ai/llm";
import { recordCostEntry } from "@/lib/cost/record";
import { recordObservabilityLog } from "@/lib/observability/record";
import { tiptapDocFromPlainText } from "@/lib/editor/tiptap-from-text";
import type { Prisma } from "@prisma/client";
import { classifyLegalQuery } from "@/lib/legal/query-classifier";
import { evaluateSourceSufficiency } from "@/lib/legal/source-sufficiency";
import { computeConfidence } from "@/lib/legal/confidence";

export const runtime = "nodejs";

type Body = {
  processId: string;
  kind: string;
  objective: string;
  title?: string;
};

export async function POST(req: Request) {
  const t0 = Date.now();
  const { workspaceId, user } = await getWorkspaceContext();
  const body = (await req.json()) as Body;
  const processId = String(body.processId ?? "");
  const kind = String(body.kind ?? "").trim();
  const objective = String(body.objective ?? "").trim();
  const title = String(body.title ?? "").trim() || `${kind} — ${new Date().toISOString().slice(0, 10)}`;

  if (!processId || !kind || objective.length < 4) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const proc = await prisma.process.findFirst({
    where: { id: processId, workspaceId },
    include: { client: true },
  });
  if (!proc) {
    return NextResponse.json({ error: "Processo não encontrado" }, { status: 404 });
  }

  const style = await prisma.styleProfile.findFirst({ where: { workspaceId } });
  const styleBlock = styleInjection(style?.profileJson ?? null);
  const memory = await loadMemoryBlock(workspaceId, processId);

  const query = `${kind} ${objective} ${proc.number} ${proc.title ?? ""}`.slice(0, 800);
  const { chunks } = await retrieveContext({
    workspaceId,
    processId,
    query,
    limit: 16,
    userId: user.id,
  });
  const grounding = groundingFromChunks(chunks);

  const classification = classifyLegalQuery(`Gerar peça: ${kind}. Objetivo: ${objective}`);
  const sourceSufficiency = evaluateSourceSufficiency({
    classification,
    retrievedChunks: chunks,
    processId,
  });
  const confidence = computeConfidence({
    classification,
    retrievedChunks: chunks,
    sourceSufficiency,
  });

  const citations = chunks.map((c, i) => ({
    ref: i + 1,
    label: c.sourceLabel,
    type: c.sourceType,
    section: c.meta["section"] ?? null,
    excerpt: c.text.slice(0, 220),
    score: c.score,
    documentId: c.meta["documentId"] ?? null,
  }));

  const prompt = `${SYSTEM_BASE}

TAREFA: Gerar uma peça jurídica brasileira técnica (advogado-para-advogado) com base nas FONTES.
Objetivo do advogado: ${objective}

Processo: ${proc.number}. ${proc.title ?? ""}. ${proc.vara ?? ""}. ${proc.tribunal ?? ""}.
Cliente: ${proc.client?.name ?? "N/I"}.

Memória persistente do processo (pode conter estratégia/teses):
${memory}

${styleBlock}

${grounding}

Regras adicionais obrigatórias:
- Nunca invente artigo, súmula ou precedente sem estar em FONTES. Se não houver FONTES, diga explicitamente que não há base documental suficiente.
- Separe a resposta em: (1) Análise do documento/processo, (2) Fundamentação jurídica (com [fonte:N]), (3) Sugestão estratégica, (4) Minuta (peça completa).
- Na Minuta, mantenha estrutura com seções típicas (preâmbulo, fatos, direito, pedidos, fecho), quando aplicável.
- Cite [fonte:N] sempre que apoiar algo em uma fonte.

Gere agora a peça do tipo: ${kind}.`;

  let text = "";
  let usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | undefined;
  if (!sourceSufficiency.sufficient) {
    text = [
      "RASCUNHO (BASE INSUFICIENTE PARA PEÇA ROBUSTA)",
      "",
      "Não localizei fonte suficiente na base indexada para afirmar isso com segurança.",
      "",
      "1) Diagnóstico de insuficiência",
      ...sourceSufficiency.reasons.map((r) => `- ${r}`),
      ...(sourceSufficiency.warnings.length ? ["", "2) Alertas", ...sourceSufficiency.warnings.map((w) => `- ${w}`)] : []),
      "",
      "3) Documentos/fonte necessários para geração segura",
      "- Despacho/decisão/intimação pertinente do processo (com data/publicação).",
      "- Peças relevantes (inicial/contestação) e documentos essenciais do caso.",
      "- Base legal/jurisprudência específica (se a tese depender disso).",
      "",
      "4) Checklist para geração segura",
      "- Confirmar o comando do juízo e o pedido concreto.",
      "- Confirmar marco inicial do prazo (se houver) e forma de contagem.",
      "- Separar fatos provados (documento) de argumentos (tese).",
      "",
      "5) Minuta parcial (opcional; requer revisão humana)",
      "## [RASCUNHO] Manifestação — estrutura sugerida",
      "- Endereçamento",
      "- Síntese do despacho (sem afirmar detalhes sem fonte)",
      "- Providência sugerida (hipóteses) e pedidos condicionais",
      "- Requerimentos finais",
    ].join("\n");
  } else {
    const tLlm = Date.now();
    const res = await generateText({
      model: getPieceLanguageModel(),
      temperature: 0.2,
      maxOutputTokens: 2200,
      prompt,
    });
    text = res.text;
    usage = res.usage;

    recordObservabilityLog({
      workspaceId,
      userId: user.id,
      kind: "llm.piece_generate",
      name: kind,
      latencyMs: Date.now() - tLlm,
      payloadJson: {
        model: getPieceModelId(),
        provider: getChatProviderId(),
        promptTokens: usage?.promptTokens,
        completionTokens: usage?.completionTokens,
      },
      retrievalChunkIds: chunks.map((c) => c.id),
    });

    recordCostEntry({
      workspaceId,
      userId: user.id,
      category: "COMPLETION",
      provider: getChatProviderId(),
      model: getPieceModelId(),
      promptTokens: usage?.promptTokens,
      completionTokens: usage?.completionTokens,
      totalTokens: usage?.totalTokens,
      metaJson: { processId, kind },
    });
  }

  const contentJson = tiptapDocFromPlainText(text.trim());

  const piece = await prisma.legalPiece.create({
    data: {
      workspaceId,
      processId,
      kind,
      title,
      contentJson: contentJson as unknown as Prisma.InputJsonValue,
      aiMetaJson: {
        query,
        classification,
        sourceSufficiency,
        confidence,
        citations,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId,
      kind: "piece.generated",
      title: `Peça gerada: ${kind}`,
      metaJson: { processId, pieceId: piece.id, latencyMs: Date.now() - t0 },
    },
  });

  return NextResponse.json({ pieceId: piece.id });
}

