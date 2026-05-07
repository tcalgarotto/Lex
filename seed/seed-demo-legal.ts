/**
 * Seed demo realista para venda (processo + docs + peça anterior + fontes globais) e indexação no Qdrant.
 *
 * Uso:
 *   npm run seed:demo-legal
 *
 * Requer: DATABASE_URL, QDRANT_URL(+KEY opcional), REDIS_URL, DEEPINFRA_API_KEY.
 * (Chat provider só é necessário quando você efetivamente usar o chat/geração.)
 */
import { PrismaClient, DocumentStatus, LegalLayer, MembershipRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { embedTexts } from "@/lib/ai/embeddings";
import { chunkLegalText } from "@/lib/parsers/legal-chunker";
import { getQdrantVectorStore } from "@/lib/retrieval/vector-store/qdrant-store";
import { sha256Hex } from "@/lib/util/content-hash";
import { GLOBAL_WORKSPACE_ID } from "@/lib/constants";

const prisma = new PrismaClient();

const DISPATCH_TEXT = `
DESPACHO

Vistos.

1) Intime-se a parte autora para, no prazo de 15 (quinze) dias, emendar a petição inicial, juntando comprovantes de tentativa de solução extrajudicial e esclarecendo o período exato dos fatos narrados, sob pena de indeferimento.

2) Após, voltem conclusos para apreciação do pedido de tutela.

Publique-se. Intime-se.
`;

const CONTESTATION_TEXT = `
CONTESTAÇÃO (DEMO)

I. SÍNTESE
Trata-se de ação indenizatória em que a autora alega danos morais por suposta negativação indevida.

II. PRELIMINARES
Impugna-se a gratuidade por ausência de documentos. Suscita-se inépcia parcial por ausência de individualização dos fatos.

III. MÉRITO
Houve contratação válida e inadimplemento. A inscrição decorreu do exercício regular de direito.

IV. PEDIDOS
Requer a improcedência. Subsidiariamente, a redução do quantum.
`;

const PRIOR_PIECE_TEXT = `
EXCELENTÍSSIMO(A) SENHOR(A) DOUTOR(A) JUIZ(A) DE DIREITO DA __ VARA CÍVEL DA COMARCA DE ___.

Processo nº [●]

I. DOS FATOS
Com efeito, a parte autora buscou solução extrajudicial sem êxito.

II. DO DIREITO
Nesse sentido, a responsabilidade civil exige demonstração do ato, dano e nexo.

III. DOS PEDIDOS
Ante o exposto, requer...
`;

async function upsertProcessDocumentToQdrant(params: {
  workspaceId: string;
  documentId: string;
  processId: string;
  text: string;
}) {
  const store = getQdrantVectorStore();
  const chunks = chunkLegalText(params.text, 1600, 180);
  const vectors = await embedTexts(chunks.map((c) => c.text));
  const points = chunks.map((c, i) => {
    const contentHash = sha256Hex(c.text);
    return {
      id: randomUUID(),
      vector: vectors[i]!,
      payload: {
        workspaceId: params.workspaceId,
        layer: "user_documents" as const,
        chunkText: c.text,
        section: c.section,
        contentHash,
        documentId: params.documentId,
        processId: params.processId,
        sourceCode: c.label,
      },
    };
  });
  await store.upsertPoints(points);
  await prisma.documentChunk.createMany({
    data: points.map((p, idx) => ({
      documentId: params.documentId,
      chunkIndex: idx,
      text: chunks[idx]!.text,
      textPreview: chunks[idx]!.text.slice(0, 2000),
      section: chunks[idx]!.section,
      contentHash: p.payload.contentHash,
      qdrantPointId: p.id,
      tokenEstimate: Math.ceil(chunks[idx]!.text.length / 4),
    })),
  });
  await prisma.document.update({
    where: { id: params.documentId },
    data: {
      status: DocumentStatus.INDEXED,
      progress: 1,
      indexedAt: new Date(),
      extractedText: params.text,
      extractedAt: new Date(),
      totalChunks: chunks.length,
      processedChunks: chunks.length,
    },
  });
}

async function main() {
  const email = process.env["SEED_USER_EMAIL"] ?? "demo@lex.local";
  const userId = process.env["SEED_USER_ID"] ?? "seed-user-lex-demo";

  const user = await prisma.user.upsert({
    where: { email },
    create: { id: userId, email, name: "Advogado Demo (Comercial)" },
    update: { name: "Advogado Demo (Comercial)" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-escritorio" },
    create: { name: "Escritório Demo", slug: "demo-escritorio" },
    update: {},
  });

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId: workspace.id, userId: user.id } },
    create: { workspaceId: workspace.id, userId: user.id, role: MembershipRole.OWNER },
    update: { role: MembershipRole.OWNER },
  });

  const proc = await prisma.process.create({
    data: {
      workspaceId: workspace.id,
      number: "0001234-56.2026.8.26.0100",
      title: "Ação indenizatória — negativação indevida (DEMO)",
      vara: "2ª Vara Cível",
      tribunal: "TJSP",
      observations:
        "Caso fictício para demonstração comercial. Objetivo: manifestar em emenda à inicial.",
      tags: ["demo", "indenização", "negativação"],
    },
  });

  const thread = await prisma.chatThread.create({
    data: { workspaceId: workspace.id, processId: proc.id, title: "Chat contextual" },
  });

  // Fonte global (legislação/jurisprudência demo) — indexada como GLOBAL_WORKSPACE_ID
  await prisma.legalSource.createMany({
    data: [
      {
        layer: LegalLayer.legislation,
        code: "CPC",
        title: "Código de Processo Civil (trecho demo)",
        articleRef: "Art. 321",
        body:
          "Art. 321. O juiz, ao verificar que a petição inicial não preenche os requisitos dos arts. 319 e 320 ou que apresenta defeitos e irregularidades capazes de dificultar o julgamento de mérito, determinará que o autor, no prazo de 15 (quinze) dias, a emende ou a complete, indicando com precisão o que deve ser corrigido ou completado.",
      },
      {
        layer: LegalLayer.jurisprudence,
        code: "TJSP",
        title: "Acórdão demo — emenda à inicial",
        tribunal: "TJSP",
        year: 2024,
        body:
          "EMENTA (DEMO). Emenda à inicial. Determinação de juntada de documentos essenciais. Ausência de cumprimento no prazo. Possibilidade de indeferimento, assegurada a indicação precisa do que deve ser complementado. Recurso desprovido.",
      },
    ],
  });

  // Indexar fontes globais recém criadas no Qdrant
  const sources = await prisma.legalSource.findMany({ take: 50, orderBy: { createdAt: "desc" } });
  const store = getQdrantVectorStore();
  for (const src of sources) {
    const chunks = chunkLegalText(src.body, 2000, 200);
    if (!chunks.length) continue;
    const vecs = await embedTexts(chunks.map((c) => c.text));
    await store.upsertPoints(
      chunks.map((c, i) => ({
        id: randomUUID(),
        vector: vecs[i]!,
        payload: {
          workspaceId: GLOBAL_WORKSPACE_ID,
          layer: src.layer,
          chunkText: c.text,
          section: c.section,
          contentHash: sha256Hex(c.text),
          sourceCode: src.code,
          articleRef: src.articleRef ?? undefined,
          tribunal: src.tribunal ?? undefined,
        },
      })),
    );
  }

  // Documento 1: despacho
  const docDispatch = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      processId: proc.id,
      originalName: "despacho-emenda-inicial-demo.txt",
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(DISPATCH_TEXT, "utf8"),
      storagePath: "demo://despacho",
      status: DocumentStatus.PARSING,
      progress: 0,
    },
  });
  await upsertProcessDocumentToQdrant({
    workspaceId: workspace.id,
    documentId: docDispatch.id,
    processId: proc.id,
    text: DISPATCH_TEXT,
  });

  // Documento 2: contestação
  const docContest = await prisma.document.create({
    data: {
      workspaceId: workspace.id,
      processId: proc.id,
      originalName: "contestacao-demo.txt",
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(CONTESTATION_TEXT, "utf8"),
      storagePath: "demo://contestacao",
      status: DocumentStatus.PARSING,
      progress: 0,
    },
  });
  await upsertProcessDocumentToQdrant({
    workspaceId: workspace.id,
    documentId: docContest.id,
    processId: proc.id,
    text: CONTESTATION_TEXT,
  });

  // Peça anterior para estilo + contexto
  await prisma.legalPiece.create({
    data: {
      workspaceId: workspace.id,
      processId: proc.id,
      kind: "manifestação",
      title: "Manifestação anterior (DEMO)",
      contentJson: {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: PRIOR_PIECE_TEXT.trim() }] },
        ],
      },
    },
  });

  // Primeira mensagem “guia” no chat
  await prisma.chatMessage.createMany({
    data: [
      {
        threadId: thread.id,
        role: "SYSTEM",
        content:
          "Processo DEMO criado. Pergunte: “O que devo fazer diante deste despacho?” e depois gere uma manifestação.",
      },
    ],
  });

  console.log("OK. Processo demo:", proc.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

