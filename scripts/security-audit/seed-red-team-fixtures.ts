/**
 * Seed idempotente — fixtures red-team dual-tenant (dados falsos).
 * Não apaga dados. Não imprime secrets.
 *
 * Uso: npm run security:red-team:seed
 */

import { CalendarEventType, IntegrationProvider, MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { documentStoragePath } from "@/lib/storage";
import { throwIfUnsafeRedTeamEnvironment } from "./env-guard";
import { RT, RT_SECRET_MARKER_B, redTeamPrismaOnlyEmail } from "../../tests/security/red-team/fixture-ids";

async function upsertUser(id: string, email: string, name: string) {
  return prisma.user.upsert({
    where: { id },
    create: { id, email, name },
    update: { email, name },
  });
}

async function upsertWorkspace(id: string, slug: string, name: string) {
  return prisma.workspace.upsert({
    where: { id },
    create: { id, slug, name },
    update: { slug, name },
  });
}

async function upsertMembership(
  id: string,
  workspaceId: string,
  userId: string,
  role: MembershipRole,
) {
  return prisma.membership.upsert({
    where: { id },
    create: { id, workspaceId, userId, role },
    update: { role },
  });
}

async function main() {
  throwIfUnsafeRedTeamEnvironment();

  console.log("[red-team:seed] Iniciando upsert de fixtures falsas (sem delete)...");

  await upsertWorkspace(RT.workspaces.a.id, RT.workspaces.a.slug, RT.workspaces.a.name);
  await upsertWorkspace(RT.workspaces.b.id, RT.workspaces.b.slug, RT.workspaces.b.name);

  await upsertUser(RT.users.adminA.id, RT.users.adminA.email, "[REDTEAM] Admin A");
  await upsertUser(
    RT.users.commonA.id,
    redTeamPrismaOnlyEmail(RT.users.commonA.id),
    "[REDTEAM] Comum A",
  );
  await upsertUser(
    RT.users.commonB.id,
    redTeamPrismaOnlyEmail(RT.users.commonB.id),
    "[REDTEAM] Comum B",
  );

  await upsertMembership(
    RT.memberships.adminA.id,
    RT.workspaces.a.id,
    RT.users.adminA.id,
    MembershipRole.OWNER,
  );
  await upsertMembership(
    RT.memberships.commonA.id,
    RT.workspaces.a.id,
    RT.users.commonA.id,
    MembershipRole.LAWYER,
  );
  await upsertMembership(
    RT.memberships.commonB.id,
    RT.workspaces.b.id,
    RT.users.commonB.id,
    MembershipRole.LAWYER,
  );

  await prisma.client.upsert({
    where: { id: RT.clients.a.id },
    create: {
      id: RT.clients.a.id,
      workspaceId: RT.workspaces.a.id,
      name: RT.clients.a.name,
      email: "alfa-falso@fixture.lex.invalid",
    },
    update: { name: RT.clients.a.name },
  });
  await prisma.client.upsert({
    where: { id: RT.clients.b.id },
    create: {
      id: RT.clients.b.id,
      workspaceId: RT.workspaces.b.id,
      name: RT.clients.b.name,
      email: "bravo-falso@fixture.lex.invalid",
    },
    update: { name: RT.clients.b.name },
  });

  await prisma.process.upsert({
    where: { id: RT.processes.a.id },
    create: {
      id: RT.processes.a.id,
      workspaceId: RT.workspaces.a.id,
      clientId: RT.clients.a.id,
      number: RT.processes.a.number,
      title: "[REDTEAM] Processo Alfa Falso",
    },
    update: { title: "[REDTEAM] Processo Alfa Falso" },
  });
  await prisma.process.upsert({
    where: { id: RT.processes.b.id },
    create: {
      id: RT.processes.b.id,
      workspaceId: RT.workspaces.b.id,
      clientId: RT.clients.b.id,
      number: RT.processes.b.number,
      title: "[REDTEAM] Processo Bravo Falso",
    },
    update: { title: "[REDTEAM] Processo Bravo Falso" },
  });

  await prisma.case.upsert({
    where: { id: RT.cases.a.id },
    create: {
      id: RT.cases.a.id,
      workspaceId: RT.workspaces.a.id,
      createdById: RT.users.commonA.id,
      title: RT.cases.a.title,
      rawInput: RT.documents.a.marker,
      status: "INTAKE",
      processId: RT.processes.a.id,
    },
    update: { title: RT.cases.a.title },
  });
  await prisma.case.upsert({
    where: { id: RT.cases.b.id },
    create: {
      id: RT.cases.b.id,
      workspaceId: RT.workspaces.b.id,
      createdById: RT.users.commonB.id,
      title: RT.cases.b.title,
      rawInput: RT.documents.b.marker,
      status: "INTAKE",
      processId: RT.processes.b.id,
    },
    update: { title: RT.cases.b.title },
  });

  const pathA = documentStoragePath(RT.workspaces.a.id, RT.documents.a.id, RT.documents.a.name);
  const pathB = documentStoragePath(RT.workspaces.b.id, RT.documents.b.id, RT.documents.b.name);

  await prisma.document.upsert({
    where: { id: RT.documents.a.id },
    create: {
      id: RT.documents.a.id,
      workspaceId: RT.workspaces.a.id,
      caseId: RT.cases.a.id,
      processId: RT.processes.a.id,
      uploadedByUserId: RT.users.commonA.id,
      originalName: RT.documents.a.name,
      mimeType: "application/pdf",
      sizeBytes: 128,
      storagePath: pathA,
      status: "INDEXED",
      extractedText: RT.documents.a.marker,
    },
    update: {
      extractedText: RT.documents.a.marker,
      storagePath: pathA,
      deletedAt: null,
    },
  });
  await prisma.document.upsert({
    where: { id: RT.documents.b.id },
    create: {
      id: RT.documents.b.id,
      workspaceId: RT.workspaces.b.id,
      caseId: RT.cases.b.id,
      processId: RT.processes.b.id,
      uploadedByUserId: RT.users.commonB.id,
      originalName: RT.documents.b.name,
      mimeType: "application/pdf",
      sizeBytes: 128,
      storagePath: pathB,
      status: "INDEXED",
      extractedText: RT.documents.b.marker,
    },
    update: {
      extractedText: RT.documents.b.marker,
      storagePath: pathB,
      deletedAt: null,
    },
  });

  const pathAMalicious = documentStoragePath(
    RT.workspaces.a.id,
    RT.documents.aMalicious.id,
    RT.documents.aMalicious.name,
  );
  await prisma.document.upsert({
    where: { id: RT.documents.aMalicious.id },
    create: {
      id: RT.documents.aMalicious.id,
      workspaceId: RT.workspaces.a.id,
      caseId: RT.cases.a.id,
      processId: RT.processes.a.id,
      uploadedByUserId: RT.users.commonA.id,
      originalName: RT.documents.aMalicious.name,
      mimeType: "text/plain",
      sizeBytes: 256,
      storagePath: pathAMalicious,
      status: "INDEXED",
      extractedText: RT.documents.aMalicious.marker,
    },
    update: {
      extractedText: RT.documents.aMalicious.marker,
      storagePath: pathAMalicious,
      deletedAt: null,
    },
  });

  await prisma.documentChunk.upsert({
    where: { id: RT.chunks.a.id },
    create: {
      id: RT.chunks.a.id,
      documentId: RT.documents.a.id,
      chunkIndex: 0,
      text: RT.documents.a.marker,
      textPreview: RT.documents.a.marker,
    },
    update: { text: RT.documents.a.marker, textPreview: RT.documents.a.marker },
  });
  await prisma.documentChunk.upsert({
    where: { id: RT.chunks.aMalicious.id },
    create: {
      id: RT.chunks.aMalicious.id,
      documentId: RT.documents.aMalicious.id,
      chunkIndex: 0,
      text: RT.documents.aMalicious.marker,
      textPreview: RT.documents.aMalicious.marker,
    },
    update: {
      text: RT.documents.aMalicious.marker,
      textPreview: RT.documents.aMalicious.marker,
    },
  });
  await prisma.documentChunk.upsert({
    where: { id: RT.chunks.b.id },
    create: {
      id: RT.chunks.b.id,
      documentId: RT.documents.b.id,
      chunkIndex: 0,
      text: RT.documents.b.marker,
      textPreview: RT.documents.b.marker,
    },
    update: { text: RT.documents.b.marker, textPreview: RT.documents.b.marker },
  });

  await prisma.chatThread.upsert({
    where: { id: RT.threads.a.id },
    create: {
      id: RT.threads.a.id,
      workspaceId: RT.workspaces.a.id,
      processId: RT.processes.a.id,
      title: "[REDTEAM] Chat Alfa",
    },
    update: { title: "[REDTEAM] Chat Alfa" },
  });
  await prisma.chatThread.upsert({
    where: { id: RT.threads.b.id },
    create: {
      id: RT.threads.b.id,
      workspaceId: RT.workspaces.b.id,
      processId: RT.processes.b.id,
      title: "[REDTEAM] Chat Bravo",
    },
    update: { title: "[REDTEAM] Chat Bravo" },
  });

  await prisma.legalProcess.upsert({
    where: { id: RT.legalProcesses.a.id },
    create: {
      id: RT.legalProcesses.a.id,
      workspaceId: RT.workspaces.a.id,
      caseId: RT.cases.a.id,
      processId: RT.processes.a.id,
      cnj: RT.legalProcesses.a.cnj,
      cnjFormatted: "1111111-11.1111.1.11.1111",
      tribunalAcronym: "TJFAKE",
      tribunalAlias: "api_publica_tjfake",
      branch: "1",
    },
    update: {},
  });
  await prisma.legalProcess.upsert({
    where: { id: RT.legalProcesses.b.id },
    create: {
      id: RT.legalProcesses.b.id,
      workspaceId: RT.workspaces.b.id,
      caseId: RT.cases.b.id,
      processId: RT.processes.b.id,
      cnj: RT.legalProcesses.b.cnj,
      cnjFormatted: "2222222-22.2222.2.22.2222",
      tribunalAcronym: "TJFAKE",
      tribunalAlias: "api_publica_tjfake",
      branch: "1",
    },
    update: {},
  });

  const starts = new Date("2030-06-01T14:00:00.000Z");
  await prisma.calendarEvent.upsert({
    where: { id: RT.calendar.a.id },
    create: {
      id: RT.calendar.a.id,
      workspaceId: RT.workspaces.a.id,
      caseId: RT.cases.a.id,
      title: RT.calendar.a.title,
      eventType: CalendarEventType.HEARING,
      startsAt: starts,
      createdByUserId: RT.users.commonA.id,
    },
    update: { title: RT.calendar.a.title },
  });
  await prisma.calendarEvent.upsert({
    where: { id: RT.calendar.b.id },
    create: {
      id: RT.calendar.b.id,
      workspaceId: RT.workspaces.b.id,
      caseId: RT.cases.b.id,
      title: RT.calendar.b.title,
      eventType: CalendarEventType.HEARING,
      startsAt: starts,
      createdByUserId: RT.users.commonB.id,
    },
    update: { title: RT.calendar.b.title },
  });

  await prisma.integration.upsert({
    where: { id: RT.integrations.a.id },
    create: {
      id: RT.integrations.a.id,
      workspaceId: RT.workspaces.a.id,
      provider: IntegrationProvider.WEBHOOK,
      label: RT.integrations.a.label,
      secretRef: "redteam-fake-secret-ref-a-not-real",
    },
    update: { label: RT.integrations.a.label },
  });
  await prisma.integration.upsert({
    where: { id: RT.integrations.b.id },
    create: {
      id: RT.integrations.b.id,
      workspaceId: RT.workspaces.b.id,
      provider: IntegrationProvider.WEBHOOK,
      label: RT.integrations.b.label,
      secretRef: "redteam-fake-secret-ref-b-not-real",
    },
    update: { label: RT.integrations.b.label },
  });

  console.log("[red-team:seed] OK — workspaces:", RT.workspaces.a.slug, RT.workspaces.b.slug);
  console.log("[red-team:seed] Marcador B (não deve vazar para A):", RT_SECRET_MARKER_B.slice(0, 20) + "...");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("[red-team:seed] Falhou:", e instanceof Error ? e.message : String(e));
    await prisma.$disconnect();
    process.exit(1);
  });
