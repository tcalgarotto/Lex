import {
  LegalLayer,
  MembershipRole,
  MemoryKind,
  PrismaClient,
} from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type CorpusJsonRow = {
  layer: string;
  code: string;
  title?: string;
  articleRef?: string;
  tribunal?: string;
  year?: number;
  body: string;
};

async function main() {
  const email = process.env["SEED_USER_EMAIL"] ?? "dev@lex.local";
  const externalId = process.env["SEED_USER_ID"] ?? "seed-user-lex-001";

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      id: externalId,
      email,
      name: "Advogado Demo",
    },
    update: { name: "Advogado Demo" },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "meu-escritorio" },
    create: {
      name: "Meu Escritório",
      slug: "meu-escritorio",
    },
    update: {},
  });

  await prisma.membership.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: MembershipRole.OWNER,
    },
    update: { role: MembershipRole.OWNER },
  });

  await prisma.styleProfile.upsert({
    where: {
      workspaceId_userId: { workspaceId: workspace.id, userId: user.id },
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      profileJson: {
        formalidade: "alta",
        doutrina: "moderada",
        jurisprudencia: "frequente",
        tom: "tecnico",
        frases_recorrentes: [],
      },
      recurringPhrases: ["Com efeito,", "Nesse sentido,"],
      metricsJson: { avgSentenceLength: 28, sectionsTypical: ["Fatos", "Direito", "Pedidos"] },
    },
    update: {},
  });

  const client = await prisma.client.create({
    data: {
      workspaceId: workspace.id,
      name: "Cliente Exemplo Ltda.",
      email: "contato@exemplo.com",
    },
  });

  const legalProcess = await prisma.process.create({
    data: {
      workspaceId: workspace.id,
      clientId: client.id,
      number: "0000000-00.0000.0.00.0000",
      title: "Ação declaratória – cumprimento contratual",
      vara: "1ª Vara Cível",
      tribunal: "TJSP",
      observations: "Processo demonstrativo para onboarding.",
      tags: ["cível", "contratos"],
    },
  });

  await prisma.processTimelineEvent.create({
    data: {
      processId: legalProcess.id,
      title: "Processo criado no Lex",
      description: "Baseline da linha do tempo processual.",
    },
  });

  await prisma.chatThread.upsert({
    where: { processId: legalProcess.id },
    create: {
      workspaceId: workspace.id,
      processId: legalProcess.id,
      title: "Chat contextual",
    },
    update: {},
  });

  await prisma.memoryEntry.create({
    data: {
      workspaceId: workspace.id,
      processId: legalProcess.id,
      kind: MemoryKind.STRATEGY,
      title: "Tese central",
      content:
        "Demonstrar inadimplemento contratual com prova documental e jurisprudência consolidada do STJ.",
    },
  });

  await prisma.activity.create({
    data: {
      workspaceId: workspace.id,
      kind: "process.created",
      title: "Novo processo cadastrado",
      metaJson: { processId: legalProcess.id },
    },
  });

  const legPath = path.join(process.cwd(), "seed/data/legislation.json");
  const jurPath = path.join(process.cwd(), "seed/data/jurisprudencia-demo.json");
  const legItems = JSON.parse(readFileSync(legPath, "utf-8")) as CorpusJsonRow[];
  const jurItems = JSON.parse(readFileSync(jurPath, "utf-8")) as CorpusJsonRow[];

  await prisma.legalSource.createMany({
    data: [...legItems, ...jurItems].map((j) => ({
      layer:
        j.layer === "jurisprudence" ? LegalLayer.jurisprudence : LegalLayer.legislation,
      code: j.code,
      title: j.title,
      articleRef: j.articleRef,
      tribunal: j.tribunal,
      year: j.year,
      body: j.body,
    })),
  });

  console.log("Seed OK — workspace:", workspace.slug, "process:", legalProcess.number);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
