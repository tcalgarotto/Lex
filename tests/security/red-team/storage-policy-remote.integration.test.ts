/**
 * FASE 3.1 — Supabase Storage direto (anon + JWT A/B) em staging controlado.
 * NÃO EXECUTADO sem envs; nunca roda em produção.
 */

import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { documentStoragePath } from "@/lib/storage";
import { assertStagingStorageTestEnv } from "../../../scripts/security-audit/env-guard";
import { RT, RT_SECRET_MARKER_B } from "./fixture-ids";
import { RedTeamReport } from "./helpers";
import { MINIMAL_PDF_BUFFER } from "./upload-fixtures";

const report = new RedTeamReport();

type RemoteConfig = {
  url: string;
  anonKey: string;
  emailA: string;
  passwordA: string;
  emailB: string;
  passwordB: string;
  serviceRoleKey?: string;
};

function resolveRemoteConfig(): { ok: false; reason: string } | { ok: true; config: RemoteConfig } {
  const base = assertStagingStorageTestEnv();
  if (!base.ok) return { ok: false, reason: base.reason };
  const url = (process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "").trim();
  const anonKey = (process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"] ?? "").trim();
  const passwordA = (process.env["SUPABASE_TEST_USER_A_PASSWORD"] ?? "").trim();
  const passwordB = (process.env["SUPABASE_TEST_USER_B_PASSWORD"] ?? "").trim();
  if (!passwordA || !passwordB) {
    return {
      ok: false,
      reason: "SUPABASE_TEST_USER_A_PASSWORD e SUPABASE_TEST_USER_B_PASSWORD obrigatórios",
    };
  }
  const emailA =
    (process.env["SUPABASE_TEST_USER_A_EMAIL"] ?? "").trim() || RT.users.commonA.email;
  const emailB =
    (process.env["SUPABASE_TEST_USER_B_EMAIL"] ?? "").trim() || RT.users.commonB.email;
  const serviceRoleKey = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim() || undefined;
  return {
    ok: true,
    config: { url, anonKey, emailA, passwordA, emailB, passwordB, serviceRoleKey },
  };
}

function errorPayload(err: unknown): string {
  if (!err) return "";
  if (typeof err === "object" && err !== null) {
    return JSON.stringify(err);
  }
  return String(err);
}

function leaksSensitiveInfo(payload: string): boolean {
  const lower = payload.toLowerCase();
  if (payload.includes(RT_SECRET_MARKER_B)) return true;
  if (lower.includes("bravo-falso") && lower.includes("storage")) return true;
  return false;
}

const pathB = documentStoragePath(
  RT.workspaces.b.id,
  RT.documents.b.id,
  RT.documents.b.name,
);

let remoteOk = false;
let config: RemoteConfig | null = null;
let fixtureInStorage = false;

async function signInClient(cfg: RemoteConfig, email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Auth falhou para ${email}: ${error.message}`);
  }
  return client;
}

beforeAll(async () => {
  const resolved = resolveRemoteConfig();
  if (!resolved.ok) {
    report.skip("Supabase Storage remoto", resolved.reason);
    return;
  }
  const cfg = resolved.config;
  config = cfg;
  remoteOk = true;

  if (cfg.serviceRoleKey) {
    const admin = createClient(cfg.url, cfg.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await admin.storage.from("documents").upload(pathB, MINIMAL_PDF_BUFFER, {
      upsert: true,
      contentType: "application/pdf",
    });
    fixtureInStorage = !error;
  }
});

afterAll(() => {
  report.print();
  const p0 = report.findings.filter((f) => f.status === "FALHOU" && f.severity === "P0");
  if (remoteOk && p0.length > 0) {
    throw new Error(`FASE 3.2 storage remoto: ${p0.length} P0`);
  }
});

describe("FASE 3.2 — Storage policy remoto (Supabase client)", () => {
  it("SR.1 anon não lista bucket documents", async () => {
    if (!remoteOk || !config) return;
    const anon = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.storage.from("documents").list(RT.workspaces.b.id, { limit: 5 });
    const leaked = (data?.length ?? 0) > 0;
    const errText = errorPayload(error);
    if (leaked) {
      report.fail("SR.1 anon listou objetos", {
        severity: "P0",
        obtained: `items=${data?.length}`,
      });
    } else {
      report.pass("SR.1 anon sem listagem útil", { obtained: error ? "erro auth" : "vazio" });
    }
    expect(leaked).toBe(false);
    expect(errTextSafe(errText)).toBe(true);
  });

  it("SR.2 anon não baixa objeto fixture B", async () => {
    if (!remoteOk || !config) return;
    const anon = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.storage.from("documents").download(pathB);
    const gotBytes = data && (await data.arrayBuffer()).byteLength > 0;
    const errText = errorPayload(error);
    if (gotBytes) {
      report.fail("SR.2 anon baixou objeto B", { severity: "P0", obtained: "bytes>0" });
    } else {
      report.pass("SR.2 anon download bloqueado", { obtained: error ? "erro" : "sem dados" });
    }
    expect(gotBytes).toBeFalsy();
    expect(leaksSensitiveInfo(errText)).toBe(false);
  });

  it("SR.3 usuário A não lista prefixo workspace B", async () => {
    if (!remoteOk || !config) return;
    let clientA: SupabaseClient;
    try {
      clientA = await signInClient(config, config.emailA, config.passwordA);
    } catch (e) {
      report.skip("SR.3 auth usuário A", e instanceof Error ? e.message : String(e));
      return;
    }
    const { data, error } = await clientA.storage.from("documents").list(RT.workspaces.b.id, {
      limit: 10,
    });
    const leaked = (data?.length ?? 0) > 0;
    if (leaked) {
      report.fail("SR.3 user A listou workspace B", { severity: "P0", obtained: String(data?.length) });
    } else {
      report.pass("SR.3 user A sem listagem B", { obtained: error ? "erro/negado" : "vazio" });
    }
    expect(leaked).toBe(false);
  });

  it("SR.4 usuário A não baixa objeto B", async () => {
    if (!remoteOk || !config) return;
    let clientA: SupabaseClient;
    try {
      clientA = await signInClient(config, config.emailA, config.passwordA);
    } catch (e) {
      report.skip("SR.4 auth usuário A", e instanceof Error ? e.message : String(e));
      return;
    }
    const { data, error } = await clientA.storage.from("documents").download(pathB);
    const gotBytes = data && (await data.arrayBuffer()).byteLength > 0;
    const errText = errorPayload(error) + errorPayload(data);
    if (gotBytes) {
      report.fail("SR.4 user A baixou B", { severity: "P0" });
    } else {
      report.pass("SR.4 user A download B bloqueado");
    }
    expect(gotBytes).toBeFalsy();
    expect(leaksSensitiveInfo(errText)).toBe(false);
  });

  it("SR.5 usuário B acessa objeto B se existir no storage", async () => {
    if (!remoteOk || !config) return;
    if (!fixtureInStorage) {
      report.skip("SR.5 download B por user B", "Objeto fixture ausente (defina SUPABASE_SERVICE_ROLE_KEY para seed)");
      return;
    }
    let clientB: SupabaseClient;
    try {
      clientB = await signInClient(config, config.emailB, config.passwordB);
    } catch (e) {
      report.skip("SR.5 auth usuário B", e instanceof Error ? e.message : String(e));
      return;
    }
    const { data, error } = await clientB.storage.from("documents").download(pathB);
    const bytes = data ? (await data.arrayBuffer()).byteLength : 0;
    if (bytes > 0 && !error) {
      report.pass("SR.5 user B download B permitido", { obtained: `bytes=${bytes}` });
    } else {
      report.fail("SR.5 user B não baixou fixture esperado", {
        severity: "P1",
        obtained: errorPayload(error),
        fix: "Aplicar supabase/storage/documents_policies.sql (auth.uid() = Membership.userId)",
      });
    }
    expect(bytes).toBeGreaterThan(0);
  });

  it("SR.6 erros não vazam metadados sensíveis", async () => {
    if (!remoteOk || !config) return;
    const anon = createClient(config.url, config.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.storage.from("documents").download(pathB);
    const text = errorPayload(error);
    expect(leaksSensitiveInfo(text)).toBe(false);
    expect(text).not.toContain(RT.documents.b.marker);
    report.pass("SR.6 mensagens de erro sem segredo Bravo");
  });
});

function errTextSafe(text: string): boolean {
  return !leaksSensitiveInfo(text);
}
