import {
  LegalProcessDataJudStatus,
  LegalProcessSyncSource,
  LegalProcessSyncStatus,
  Prisma,
} from "@prisma/client";
import { createDataJudClient, DataJudClientError } from "@/lib/datajud/datajud-client";
import { getEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { normalizeDataJudCover, normalizeDataJudMovements } from "@/lib/datajud/datajud-normalizer";
import {
  formatCnj,
  parseCnj,
  resolveDataJudAlias,
  type ParsedCnj,
} from "@/lib/datajud/resolve-datajud-alias";

export type ImportProcessByCnjInput = {
  workspaceId: string;
  userId?: string | null;
  cnj: string;
  caseId?: string | null;
  tribunalAcronym?: string | null;
  source?: LegalProcessSyncSource;
};

export type ImportProcessByCnjResult = {
  legalProcessId: string;
  processId: string;
  cnj: ParsedCnj;
  alias: string;
  tribunalAcronym: string;
  importedMovements: number;
  totalMovements: number;
  status: "imported" | "updated" | "not_found";
};

function toJson(value: unknown): Prisma.InputJsonValue {
  return value === null || value === undefined
    ? (Prisma.JsonNull as unknown as Prisma.InputJsonValue)
    : (value as Prisma.InputJsonValue);
}

async function ensureLegacyProcess(args: {
  workspaceId: string;
  cnjFormatted: string;
  title: string;
  tribunalAcronym: string;
  vara: string | null;
  observations: string | null;
}) {
  const existing = await prisma.process.findFirst({
    where: { workspaceId: args.workspaceId, number: args.cnjFormatted },
    select: { id: true },
  });
  const process =
    existing ??
    (await prisma.process.create({
      data: {
        workspaceId: args.workspaceId,
        number: args.cnjFormatted,
        title: args.title,
        tribunal: args.tribunalAcronym,
        vara: args.vara,
        observations: args.observations,
        tags: ["datajud"],
      },
      select: { id: true },
    }));

  await prisma.chatThread.upsert({
    where: { processId: process.id },
    update: {},
    create: {
      workspaceId: args.workspaceId,
      processId: process.id,
      title: `Chat do processo ${args.cnjFormatted}`,
    },
  });
  return process;
}

export async function importProcessByCnj(
  input: ImportProcessByCnjInput,
): Promise<ImportProcessByCnjResult> {
  const env = getEnv();
  const parsed = parseCnj(input.cnj);
  if (!parsed || !parsed.isValid) {
    throw new Error("CNJ inválido. Confira os 20 dígitos e o dígito verificador.");
  }

  if (input.caseId) {
    const linkedCase = await prisma.case.findFirst({
      where: { id: input.caseId, workspaceId: input.workspaceId, deletedAt: null },
      select: { id: true },
    });
    if (!linkedCase) throw new Error("Caso não encontrado neste workspace.");
  }

  const resolution = resolveDataJudAlias({
    cnj: input.cnj,
    tribunalAcronym: input.tribunalAcronym,
    fallbackAlias: env.DATAJUD_DEFAULT_ALIAS,
  });
  if (!resolution.ok) {
    throw new Error("Não foi possível identificar o tribunal DataJud. Selecione o tribunal manualmente.");
  }

  const client = createDataJudClient(resolution.alias);
  const startedAt = new Date();
  let hit;
  try {
    hit = await client.searchByCnj(parsed.digits);
  } catch (error) {
    await prisma.legalProcessSyncLog.create({
      data: {
        workspaceId: input.workspaceId,
        cnj: parsed.digits,
        tribunalAlias: resolution.alias,
        status: LegalProcessSyncStatus.ERROR,
        source: input.source ?? LegalProcessSyncSource.IMPORT,
        startedAt,
        finishedAt: new Date(),
        errorCode: error instanceof DataJudClientError ? error.code : "DATAJUD_IMPORT_ERROR",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }

  if (!hit) {
    const legacy = await ensureLegacyProcess({
      workspaceId: input.workspaceId,
      cnjFormatted: parsed.formatted,
      title: `Processo ${parsed.formatted}`,
      tribunalAcronym: resolution.tribunalAcronym,
      vara: null,
      observations: "CNJ válido, mas não encontrado no DataJud no momento da consulta.",
    });
    const legal = await prisma.legalProcess.upsert({
      where: { workspaceId_cnj: { workspaceId: input.workspaceId, cnj: parsed.digits } },
      update: {
        processId: legacy.id,
        caseId: input.caseId ?? undefined,
        cnjFormatted: parsed.formatted,
        tribunalAcronym: resolution.tribunalAcronym,
        tribunalAlias: resolution.alias,
        branch: parsed.branch,
        dataJudStatus: LegalProcessDataJudStatus.NOT_FOUND,
        lastDataJudSyncAt: new Date(),
      },
      create: {
        workspaceId: input.workspaceId,
        processId: legacy.id,
        caseId: input.caseId ?? null,
        cnj: parsed.digits,
        cnjFormatted: parsed.formatted,
        tribunalAcronym: resolution.tribunalAcronym,
        tribunalAlias: resolution.alias,
        branch: parsed.branch,
        dataJudStatus: LegalProcessDataJudStatus.NOT_FOUND,
        lastDataJudSyncAt: new Date(),
      },
      select: { id: true },
    });
    await prisma.legalProcessSyncLog.create({
      data: {
        workspaceId: input.workspaceId,
        legalProcessId: legal.id,
        cnj: parsed.digits,
        tribunalAlias: resolution.alias,
        status: LegalProcessSyncStatus.NOT_FOUND,
        source: input.source ?? LegalProcessSyncSource.IMPORT,
        startedAt,
        finishedAt: new Date(),
      },
    });
    return {
      legalProcessId: legal.id,
      processId: legacy.id,
      cnj: { ...parsed, tribunalAlias: resolution.alias, tribunalAcronym: resolution.tribunalAcronym },
      alias: resolution.alias,
      tribunalAcronym: resolution.tribunalAcronym,
      importedMovements: 0,
      totalMovements: 0,
      status: "not_found",
    };
  }

  const cover = normalizeDataJudCover({
    hit,
    parsedCnj: parsed,
    alias: resolution.alias,
    tribunalAcronym: resolution.tribunalAcronym,
  });
  const movements = normalizeDataJudMovements({ hit, cnj: parsed.digits });
  const legacy = await ensureLegacyProcess({
    workspaceId: input.workspaceId,
    cnjFormatted: cover.cnjFormatted,
    title: cover.classeNome ? `${cover.classeNome} ${cover.cnjFormatted}` : `Processo ${cover.cnjFormatted}`,
    tribunalAcronym: resolution.tribunalAcronym,
    vara: cover.orgaoJulgadorNome,
    observations: `Importado do DataJud (${resolution.tribunalEntry.label}).`,
  });

  const imported = await prisma.$transaction(async (tx) => {
    const legal = await tx.legalProcess.upsert({
      where: { workspaceId_cnj: { workspaceId: input.workspaceId, cnj: parsed.digits } },
      update: {
        processId: legacy.id,
        caseId: input.caseId ?? undefined,
        cnjFormatted: cover.cnjFormatted,
        tribunalAcronym: cover.tribunalAcronym,
        tribunalAlias: cover.tribunalAlias,
        branch: cover.branch,
        grau: cover.grau,
        classeCodigo: cover.classeCodigo,
        classeNome: cover.classeNome,
        assuntosJson: toJson(cover.assuntosJson),
        dataAjuizamento: cover.dataAjuizamento,
        orgaoJulgadorCodigo: cover.orgaoJulgadorCodigo,
        orgaoJulgadorNome: cover.orgaoJulgadorNome,
        sistemaCodigo: cover.sistemaCodigo,
        sistemaNome: cover.sistemaNome,
        formatoCodigo: cover.formatoCodigo,
        formatoNome: cover.formatoNome,
        nivelSigilo: cover.nivelSigilo,
        dataHoraUltimaAtualizacao: cover.dataHoraUltimaAtualizacao,
        lastDataJudSyncAt: new Date(),
        dataJudStatus: LegalProcessDataJudStatus.ACTIVE,
        dataJudRawJson: toJson(cover.rawJson),
      },
      create: {
        workspaceId: input.workspaceId,
        processId: legacy.id,
        caseId: input.caseId ?? null,
        cnj: cover.cnj,
        cnjFormatted: cover.cnjFormatted,
        tribunalAcronym: cover.tribunalAcronym,
        tribunalAlias: cover.tribunalAlias,
        branch: cover.branch,
        grau: cover.grau,
        classeCodigo: cover.classeCodigo,
        classeNome: cover.classeNome,
        assuntosJson: toJson(cover.assuntosJson),
        dataAjuizamento: cover.dataAjuizamento,
        orgaoJulgadorCodigo: cover.orgaoJulgadorCodigo,
        orgaoJulgadorNome: cover.orgaoJulgadorNome,
        sistemaCodigo: cover.sistemaCodigo,
        sistemaNome: cover.sistemaNome,
        formatoCodigo: cover.formatoCodigo,
        formatoNome: cover.formatoNome,
        nivelSigilo: cover.nivelSigilo,
        dataHoraUltimaAtualizacao: cover.dataHoraUltimaAtualizacao,
        lastDataJudSyncAt: new Date(),
        dataJudStatus: LegalProcessDataJudStatus.ACTIVE,
        dataJudRawJson: toJson(cover.rawJson),
      },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    const createResult =
      movements.length > 0
        ? await tx.legalProcessMovement.createMany({
            data: movements.map((movement) => ({
              workspaceId: input.workspaceId,
              legalProcessId: legal.id,
              codigo: movement.codigo,
              nome: movement.nome,
              dataHora: movement.dataHora,
              category: movement.category,
              complementosJson: toJson(movement.complementosJson),
              orgaoJulgadorJson: toJson(movement.orgaoJulgadorJson),
              movementHash: movement.movementHash,
              rawJson: toJson(movement.rawJson),
            })),
            skipDuplicates: true,
          })
        : { count: 0 };

    await tx.legalProcessSyncLog.create({
      data: {
        workspaceId: input.workspaceId,
        legalProcessId: legal.id,
        cnj: parsed.digits,
        tribunalAlias: resolution.alias,
        status: LegalProcessSyncStatus.SUCCESS,
        source: input.source ?? LegalProcessSyncSource.IMPORT,
        startedAt,
        finishedAt: new Date(),
        resultCount: movements.length,
        rawMetaJson: toJson({ externalId: cover.externalId, importedMovements: createResult.count }),
      },
    });

    return { legalProcessId: legal.id, importedMovements: createResult.count };
  });

  return {
    legalProcessId: imported.legalProcessId,
    processId: legacy.id,
    cnj: { ...parsed, tribunalAlias: resolution.alias, tribunalAcronym: resolution.tribunalAcronym },
    alias: resolution.alias,
    tribunalAcronym: resolution.tribunalAcronym,
    importedMovements: imported.importedMovements,
    totalMovements: movements.length,
    status: imported.importedMovements === movements.length ? "imported" : "updated",
  };
}

export { formatCnj };
