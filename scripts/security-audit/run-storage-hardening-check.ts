/**
 * Executa verificações read-only de hardening Storage (FASE A).
 * Usa DATABASE_URL — não imprime secrets. Exit 0 = OK, 1 = falha, 2 = bloqueado.
 *
 *   npm run security:storage:hardening-check
 *   RED_TEAM_CONFIRM_STAGING=1 npm run security:storage:hardening-check
 */

import { config as loadEnv } from "dotenv";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertSupabaseUrlNotProduction } from "./env-guard";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

const EXPECTED_POLICIES = [
  "documents_authenticated_select",
  "documents_authenticated_insert",
  "documents_authenticated_update",
  "documents_authenticated_delete",
] as const;

const LEGACY_POLICIES = [
  "documents_read_own_workspace",
  "documents_write_own_workspace",
  "documents_update_own_workspace",
  "documents_delete_own_workspace",
] as const;

const RECOMMENDED_MIMES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);

type Fail = { code: string; detail: string };

function fail(code: string, detail: string): Fail {
  return { code, detail };
}

async function main(): Promise<void> {
  const urlCheck = assertSupabaseUrlNotProduction();
  if (!urlCheck.ok) {
    console.error(`[storage-hardening] BLOQUEADO: ${urlCheck.reason}`);
    process.exit(2);
  }

  if (!(process.env["DATABASE_URL"] ?? "").trim()) {
    console.error("[storage-hardening] BLOQUEADO: DATABASE_URL ausente");
    process.exit(2);
  }

  const prisma = new PrismaClient();
  const failures: Fail[] = [];

  try {
    const buckets = await prisma.$queryRaw<
      Array<{
        id: string;
        name: string;
        public: boolean;
        file_size_limit: number | null;
        allowed_mime_types: string[] | null;
      }>
    >`
      SELECT id, name, public, file_size_limit, allowed_mime_types
      FROM storage.buckets
      WHERE id = 'documents' OR name = 'documents'
    `;

    if (buckets.length !== 1) {
      failures.push(fail("Q1_BUCKET", `esperado 1 bucket documents, obtido ${buckets.length}`));
    } else {
      const b = buckets[0]!;
      if (b.public) failures.push(fail("Q1_PUBLIC", "bucket documents está público"));
      else console.log("[storage-hardening] OK Q1 bucket privado");

      if (b.file_size_limit != null && b.file_size_limit > 52_428_800) {
        failures.push(
          fail("Q1_SIZE", `file_size_limit maior que 50MB: ${b.file_size_limit}`),
        );
      } else if (b.file_size_limit != null) {
        console.log(`[storage-hardening] OK Q1 file_size_limit=${b.file_size_limit}`);
      }

      const mimes = b.allowed_mime_types ?? [];
      if (mimes.some((m) => m.includes("*"))) {
        failures.push(fail("Q7_WILDCARD", "allowed_mime_types contém wildcard"));
      }
      if (mimes.some((m) => m === "application/msword" || m === "application/vnd.ms-word")) {
        failures.push(
          fail("Q7_MSWORD", "allowed_mime_types contém application/msword — remover no painel"),
        );
      }
      for (const m of mimes) {
        if (!RECOMMENDED_MIMES.has(m)) {
          console.log(`[storage-hardening] AVISO Q7 MIME extra no painel: ${m}`);
        }
      }
      if (mimes.length > 0) {
        console.log(`[storage-hardening] OK Q7 allowed_mime_types (${mimes.length} tipo(s))`);
      }
    }

    const policies = await prisma.$queryRaw<
      Array<{ policyname: string; cmd: string; roles: string }>
    >`
      SELECT policyname, cmd::text AS cmd, roles::text AS roles
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname LIKE 'documents%'
      ORDER BY policyname
    `;

    const names = policies.map((p) => p.policyname);
    for (const expected of EXPECTED_POLICIES) {
      if (!names.includes(expected)) {
        failures.push(fail("Q2_MISSING", `policy ausente: ${expected}`));
      }
    }
    const extra = names.filter((n) => !EXPECTED_POLICIES.includes(n as (typeof EXPECTED_POLICIES)[number]));
    for (const leg of LEGACY_POLICIES) {
      if (names.includes(leg)) failures.push(fail("Q3_LEGACY", `policy legada presente: ${leg}`));
    }
    const unexpected = extra.filter(
      (n) => !LEGACY_POLICIES.includes(n as (typeof LEGACY_POLICIES)[number]),
    );
    if (unexpected.length > 0) {
      failures.push(fail("Q2_EXTRA", `policies inesperadas: ${unexpected.join(", ")}`));
    }
    if (names.length === EXPECTED_POLICIES.length && failures.every((f) => !f.code.startsWith("Q2"))) {
      console.log("[storage-hardening] OK Q2/Q3 policies (4 authenticated, sem legadas)");
    }

    const permissive = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND policyname LIKE 'documents%'
        AND (
          qual ~* 'using\\s*\\(\\s*true\\s*\\)'
          OR with_check ~* 'with\\s+check\\s*\\(\\s*true\\s*\\)'
          OR qual = 'true'
          OR with_check = 'true'
        )
    `;
    if (permissive.length > 0) {
      failures.push(
        fail("Q5_PERMISSIVE", `policies permissivas: ${permissive.map((p) => p.policyname).join(", ")}`),
      );
    } else {
      console.log("[storage-hardening] OK Q5 sem USING/WITH CHECK true");
    }

    const anonPolicies = await prisma.$queryRaw<Array<{ policyname: string }>>`
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'storage' AND tablename = 'objects'
        AND 'anon' = ANY(roles)
        AND policyname ILIKE 'documents%'
    `;
    if (anonPolicies.length > 0) {
      failures.push(
        fail("Q6_ANON", `policies anon: ${anonPolicies.map((p) => p.policyname).join(", ")}`),
      );
    } else {
      console.log("[storage-hardening] OK Q6 sem policy anon em documents");
    }

    const fnRows = await prisma.$queryRaw<Array<{ fn_def: string }>>`
      SELECT pg_get_functiondef('public.lex_auth_workspace_ids()'::regprocedure) AS fn_def
    `;
    const fnDef = fnRows[0]?.fn_def ?? "";
    if (!fnDef.includes("auth.uid()")) {
      failures.push(fail("Q4_UID", "lex_auth_workspace_ids sem auth.uid()"));
    }
    if (fnDef.includes("auth.jwt()") && fnDef.includes("email")) {
      failures.push(fail("Q4_EMAIL", "lex_auth_workspace_ids ainda usa email do JWT"));
    }
    if (
      fnDef.includes("auth.uid()") &&
      !fnDef.includes("auth.jwt() ->> 'email'") &&
      !fnDef.includes("auth.jwt() ->> \"email\"")
    ) {
      console.log("[storage-hardening] OK Q4 lex_auth_workspace_ids usa auth.uid()");
    }
  } catch (e) {
    console.error(
      "[storage-hardening] ERRO ao consultar banco:",
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }

  if (failures.length > 0) {
    console.error(`[storage-hardening] FALHOU (${failures.length}):`);
    for (const f of failures) {
      console.error(`  - ${f.code}: ${f.detail}`);
    }
    process.exit(1);
  }

  console.log("[storage-hardening] TODAS as verificações SQL passaram.");
  process.exit(0);
}

main();
