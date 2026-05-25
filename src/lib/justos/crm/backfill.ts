import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractN8nSecretaryFromCaseMetadata } from "@/lib/justos/secretary-from-case";
import { normalizeCrmPhoneE164 } from "./phone";
import { createCrmContact } from "./contact-service";

export type CrmBackfillReport = {
  created: number;
  skipped: number;
  updated: number;
  invalidPhone: number;
  errors: string[];
};

export async function backfillCrmContactsFromClients(
  workspaceId: string,
): Promise<CrmBackfillReport> {
  const report: CrmBackfillReport = {
    created: 0,
    skipped: 0,
    updated: 0,
    invalidPhone: 0,
    errors: [],
  };

  const clients = await prisma.client.findMany({
    where: { workspaceId },
    select: { id: true, name: true, email: true, phone: true, documentId: true },
  });

  for (const client of clients) {
    const phoneE164 = normalizeCrmPhoneE164(client.phone);
    if (client.phone && !phoneE164) {
      report.invalidPhone += 1;
    }

    const existing = phoneE164
      ? await prisma.crmContact.findFirst({
          where: { workspaceId, phoneE164, deletedAt: null },
        })
      : await prisma.crmContact.findFirst({
          where: {
            workspaceId,
            clientId: client.id,
            deletedAt: null,
          },
        });

    if (existing) {
      if (!existing.clientId) {
        try {
          await prisma.crmContact.update({
            where: { id: existing.id },
            data: {
              clientId: client.id,
              displayName: existing.displayName || client.name,
              email: existing.email ?? client.email,
            },
          });
          report.updated += 1;
        } catch (e) {
          report.errors.push(`client ${client.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      } else {
        report.skipped += 1;
      }
      continue;
    }

    try {
      await createCrmContact({
        workspaceId,
        data: {
          kind: "CLIENT",
          displayName: client.name,
          phoneE164,
          email: client.email,
          documentId: client.documentId,
          clientId: client.id,
          pipelineStage: "NEW",
          metadataJson: { source: "backfill_client" },
        },
      });
      report.created += 1;
    } catch (e) {
      report.errors.push(`client ${client.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const cases = await prisma.case.findMany({
    where: { workspaceId, deletedAt: null },
    select: { id: true, title: true, metadataJson: true },
    take: 500,
  });

  for (const c of cases) {
    const sec = extractN8nSecretaryFromCaseMetadata(c.metadataJson);
    const phones = [
      ...(sec?.lawyerWhatsApp ?? []),
      ...(sec?.clientWhatsApp ? [sec.clientWhatsApp] : []),
    ];
    for (const raw of phones) {
      const phoneE164 = normalizeCrmPhoneE164(raw);
      if (!phoneE164) {
        if (raw) report.invalidPhone += 1;
        continue;
      }
      const existing = await prisma.crmContact.findFirst({
        where: { workspaceId, phoneE164, deletedAt: null },
      });
      if (existing) {
        if (!existing.caseId && c.id) {
          await prisma.crmContact.update({
            where: { id: existing.id },
            data: { caseId: c.id },
          });
          report.updated += 1;
        } else {
          report.skipped += 1;
        }
        continue;
      }
      try {
        await createCrmContact({
          workspaceId,
          data: {
            kind: raw === sec?.clientWhatsApp ? "CLIENT" : "OTHER",
            displayName: `${c.title} (${phoneE164.slice(-4)})`,
            phoneE164,
            caseId: c.id,
            pipelineStage: "ACTIVE",
            metadataJson: { source: "backfill_case_secretary" },
          },
        });
        report.created += 1;
      } catch (e) {
        report.errors.push(`case ${c.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return report;
}
