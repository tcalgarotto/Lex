import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  _resetEnvNormalizeForTests,
  normalizeVercelSupabaseEnv,
} from "./env-normalize";

describe("env-normalize", () => {
  const originals: Record<string, string | undefined> = {};
  const keys = [
    "DATABASE_URL",
    "DIRECT_URL",
    "POSTGRES_PRISMA_URL",
    "POSTGRES_URL_NON_POOLING",
  ];

  beforeEach(() => {
    for (const k of keys) {
      originals[k] = process.env[k];
      delete process.env[k];
    }
    _resetEnvNormalizeForTests();
  });

  afterEach(() => {
    for (const k of keys) {
      if (originals[k] === undefined) delete process.env[k];
      else process.env[k] = originals[k];
    }
  });

  it("copia POSTGRES_PRISMA_URL para DATABASE_URL quando ausente", () => {
    process.env["POSTGRES_PRISMA_URL"] = "postgresql://x:y@h:6543/db?pgbouncer=true";
    const r = normalizeVercelSupabaseEnv();
    expect(r.appliedDatabaseUrl).toBe(true);
    expect(process.env["DATABASE_URL"]).toBe("postgresql://x:y@h:6543/db?pgbouncer=true");
  });

  it("copia POSTGRES_URL_NON_POOLING para DIRECT_URL quando ausente", () => {
    process.env["POSTGRES_URL_NON_POOLING"] = "postgresql://x:y@h:5432/db";
    const r = normalizeVercelSupabaseEnv();
    expect(r.appliedDirectUrl).toBe(true);
    expect(process.env["DIRECT_URL"]).toBe("postgresql://x:y@h:5432/db");
  });

  it("não sobrescreve DATABASE_URL explícito mesmo com alias presente", () => {
    process.env["DATABASE_URL"] = "postgresql://explicit/db";
    process.env["POSTGRES_PRISMA_URL"] = "postgresql://alias/db";
    const r = normalizeVercelSupabaseEnv();
    expect(r.appliedDatabaseUrl).toBe(false);
    expect(r.unusedAliases).toContain("POSTGRES_PRISMA_URL");
    expect(process.env["DATABASE_URL"]).toBe("postgresql://explicit/db");
  });

  it("não sobrescreve DIRECT_URL explícito mesmo com alias presente", () => {
    process.env["DIRECT_URL"] = "postgresql://explicit/db";
    process.env["POSTGRES_URL_NON_POOLING"] = "postgresql://alias/db";
    const r = normalizeVercelSupabaseEnv();
    expect(r.appliedDirectUrl).toBe(false);
    expect(r.unusedAliases).toContain("POSTGRES_URL_NON_POOLING");
  });

  it("é idempotente — segunda chamada retorna mesmo report cacheado", () => {
    process.env["POSTGRES_PRISMA_URL"] = "postgresql://x/db";
    const a = normalizeVercelSupabaseEnv();
    // Mudança após primeira chamada não deve reagir (cache).
    process.env["POSTGRES_URL_NON_POOLING"] = "postgresql://y/db";
    const b = normalizeVercelSupabaseEnv();
    expect(a).toBe(b);
    expect(b.appliedDirectUrl).toBe(false);
  });

  it("trata strings vazias como ausência", () => {
    process.env["POSTGRES_PRISMA_URL"] = "   ";
    const r = normalizeVercelSupabaseEnv();
    expect(r.appliedDatabaseUrl).toBe(false);
    expect(process.env["DATABASE_URL"]).toBeUndefined();
  });
});
