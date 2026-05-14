import type { WorkspaceLicense } from "@prisma/client";

/**
 * Planos de armazenamento (nuvem de documentos). Checkout ainda não ativo —
 * constantes para futura cobrança e overrides por `Workspace.storageQuotaBytes`.
 */
export const STORAGE_PLAN = {
  BASIC: "BASIC",
  PRO: "PRO",
  OFFICE: "OFFICE",
  ENTERPRISE: "ENTERPRISE",
} as const;

export type StoragePlanCode = (typeof STORAGE_PLAN)[keyof typeof STORAGE_PLAN];

/** Quotas alvo por tier (bytes), potência de 2 onde faz sentido. */
export const STORAGE_QUOTA_BYTES_BY_PLAN: Record<StoragePlanCode, bigint> = {
  BASIC: 2147483648n, // 2 GiB
  PRO: 10737418240n, // 10 GiB
  OFFICE: 53687091200n, // 50 GiB
  ENTERPRISE: 2147483648n, // placeholder — negociado / custom via campo no workspace
};

const LICENSE_TO_STORAGE_PLAN: Record<WorkspaceLicense, StoragePlanCode> = {
  INVESTOR: STORAGE_PLAN.BASIC,
  SOLO: STORAGE_PLAN.BASIC,
  DUO: STORAGE_PLAN.BASIC,
  TEAM: STORAGE_PLAN.BASIC,
  ENTERPRISE: STORAGE_PLAN.ENTERPRISE,
};

const STORAGE_PLAN_LABEL_PT: Record<StoragePlanCode, string> = {
  BASIC: "Plano atual",
  PRO: "Pro",
  OFFICE: "Escritório",
  ENTERPRISE: "Empresarial",
};

export function storagePlanCodeForWorkspaceLicense(license: WorkspaceLicense): StoragePlanCode {
  return LICENSE_TO_STORAGE_PLAN[license];
}

export function storagePlanDisplayName(code: StoragePlanCode): string {
  return STORAGE_PLAN_LABEL_PT[code];
}
