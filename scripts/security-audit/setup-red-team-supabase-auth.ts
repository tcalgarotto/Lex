/**
 * Cria/atualiza usuários Supabase Auth para red-team Storage remoto e alinha Prisma
 * (User.id = auth.users.id, Membership.userId = auth.uid()).
 *
 * Não imprime senhas. Grava/atualiza chaves em `.env` (gitignored).
 *
 *   npm run security:red-team:setup-auth
 */

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { MembershipRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { RT, redTeamPrismaOnlyEmail } from "../../tests/security/red-team/fixture-ids";
import { assertSupabaseUrlNotProduction, throwIfUnsafeRedTeamEnvironment } from "./env-guard";

const ROOT = path.resolve(__dirname, "../..");
const ENV_PATH = path.join(ROOT, ".env");

function stablePassword(seed: string): string {
  const h = createHash("sha256").update(seed).digest("base64url").slice(0, 20);
  return `LexRT-${h}!9`;
}

function upsertEnvLines(updates: Record<string, string>): void {
  const lines = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8").split("\n") : [];
  const map = new Map<string, string>();
  const other: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t || t.startsWith("#")) {
      other.push(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      other.push(line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    map.set(key, line.slice(eq + 1));
  }

  for (const [key, value] of Object.entries(updates)) {
    map.set(key, value);
  }

  const redTeamBlock = [
    "",
    "# --- Red-team Storage (gerado por security:red-team:setup-auth; não commitar) ---",
    `RED_TEAM_CONFIRM_STAGING=${map.get("RED_TEAM_CONFIRM_STAGING") ?? "1"}`,
    `SUPABASE_TEST_USER_A_EMAIL=${map.get("SUPABASE_TEST_USER_A_EMAIL") ?? RT.users.commonA.email}`,
    `SUPABASE_TEST_USER_B_EMAIL=${map.get("SUPABASE_TEST_USER_B_EMAIL") ?? RT.users.commonB.email}`,
    `SUPABASE_TEST_USER_A_PASSWORD=${map.get("SUPABASE_TEST_USER_A_PASSWORD") ?? ""}`,
    `SUPABASE_TEST_USER_B_PASSWORD=${map.get("SUPABASE_TEST_USER_B_PASSWORD") ?? ""}`,
  ];

  const reserved = new Set([
    "RED_TEAM_CONFIRM_STAGING",
    "SUPABASE_TEST_USER_A_EMAIL",
    "SUPABASE_TEST_USER_B_EMAIL",
    "SUPABASE_TEST_USER_A_PASSWORD",
    "SUPABASE_TEST_USER_B_PASSWORD",
  ]);

  const body: string[] = [];
  for (const line of other) {
    const t = line.trim();
    if (!t) {
      body.push(line);
      continue;
    }
    const eq = line.indexOf("=");
    if (eq === -1) {
      body.push(line);
      continue;
    }
    const key = line.slice(0, eq).trim();
    if (!reserved.has(key)) body.push(`${key}=${map.get(key) ?? line.slice(eq + 1)}`);
  }

  for (const [key, value] of map.entries()) {
    if (!reserved.has(key) && !body.some((l) => l.startsWith(`${key}=`))) {
      body.push(`${key}=${value}`);
    }
  }

  writeFileSync(ENV_PATH, [...body.filter((l, i, a) => !(l === "" && i === a.length - 1)), ...redTeamBlock, ""].join("\n"));
}

async function ensureAuthUser(
  admin: SupabaseClient,
  email: string,
  password: string,
): Promise<string> {
  const { data: listed, error: listErr } = await admin.auth.admin.listUsers({ perPage: 200 });
  if (listErr) throw new Error(`listUsers: ${listErr.message}`);

  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing?.id) {
    const { error: updErr } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updErr) throw new Error(`updateUser ${email}: ${updErr.message}`);
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user?.id) {
    throw new Error(`createUser ${email}: ${error?.message ?? "sem id"}`);
  }
  return data.user.id;
}

function fixtureUserIdForEmail(email: string): string | null {
  if (email === RT.users.commonA.email) return RT.users.commonA.id;
  if (email === RT.users.commonB.email) return RT.users.commonB.id;
  return null;
}

/**
 * Auth UUID para Storage RLS + usuário fixture (rt_user_*) para testes Prisma/API mockados.
 */
async function linkPrisma(authUserId: string, email: string, workspaceId: string, name: string) {
  const fixtureUserId = fixtureUserIdForEmail(email);

  if (fixtureUserId) {
    const prismaOnlyEmail = redTeamPrismaOnlyEmail(fixtureUserId);
    await prisma.user.upsert({
      where: { id: fixtureUserId },
      create: { id: fixtureUserId, email: prismaOnlyEmail, name: `${name} (Prisma fixture)` },
      update: { email: prismaOnlyEmail, name: `${name} (Prisma fixture)` },
    });
    await prisma.membership.upsert({
      where: { workspaceId_userId: { workspaceId, userId: fixtureUserId } },
      create: { workspaceId, userId: fixtureUserId, role: MembershipRole.LAWYER },
      update: { role: MembershipRole.LAWYER },
    });
  } else {
    const existingByEmail = await prisma.user.findUnique({ where: { email } });
    if (existingByEmail && existingByEmail.id !== authUserId) {
      await prisma.membership.deleteMany({ where: { userId: existingByEmail.id } });
      await prisma.user.delete({ where: { id: existingByEmail.id } });
    }
  }

  await prisma.user.upsert({
    where: { id: authUserId },
    create: { id: authUserId, email, name },
    update: { email, name },
  });

  await prisma.membership.upsert({
    where: { workspaceId_userId: { workspaceId, userId: authUserId } },
    create: { workspaceId, userId: authUserId, role: MembershipRole.LAWYER },
    update: { role: MembershipRole.LAWYER },
  });
}

async function main(): Promise<void> {
  loadEnv({ path: ENV_PATH });
  throwIfUnsafeRedTeamEnvironment();
  const urlCheck = assertSupabaseUrlNotProduction();
  if (!urlCheck.ok) {
    console.error(`[setup-auth] BLOQUEADO: ${urlCheck.reason}`);
    process.exit(2);
  }

  const url = (process.env["NEXT_PUBLIC_SUPABASE_URL"] ?? "").trim();
  const serviceKey = (process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "").trim();
  if (!url || !serviceKey) {
    console.error("[setup-auth] NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY obrigatórios");
    process.exit(2);
  }

  const emailA =
    (process.env["SUPABASE_TEST_USER_A_EMAIL"] ?? "").trim() || RT.users.commonA.email;
  const emailB =
    (process.env["SUPABASE_TEST_USER_B_EMAIL"] ?? "").trim() || RT.users.commonB.email;

  let passwordA = (process.env["SUPABASE_TEST_USER_A_PASSWORD"] ?? "").trim();
  let passwordB = (process.env["SUPABASE_TEST_USER_B_PASSWORD"] ?? "").trim();
  if (!passwordA) passwordA = stablePassword(`redteam-a:${url}`);
  if (!passwordB) passwordB = stablePassword(`redteam-b:${url}`);

  upsertEnvLines({
    RED_TEAM_CONFIRM_STAGING: "1",
    SUPABASE_TEST_USER_A_EMAIL: emailA,
    SUPABASE_TEST_USER_B_EMAIL: emailB,
    SUPABASE_TEST_USER_A_PASSWORD: passwordA,
    SUPABASE_TEST_USER_B_PASSWORD: passwordB,
  });

  console.log("[setup-auth] Variáveis red-team gravadas em .env (senhas não exibidas).");

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("[setup-auth] Garantindo workspaces/fixtures Prisma (seed leve)...");
  const { execSync } = await import("node:child_process");
  execSync("npm run security:red-team:seed", { cwd: ROOT, stdio: "inherit" });

  console.log("[setup-auth] Criando/atualizando usuários Supabase Auth...");
  const authIdA = await ensureAuthUser(admin, emailA, passwordA);
  const authIdB = await ensureAuthUser(admin, emailB, passwordB);

  await linkPrisma(authIdA, emailA, RT.workspaces.a.id, "[REDTEAM] Comum A");
  await linkPrisma(authIdB, emailB, RT.workspaces.b.id, "[REDTEAM] Comum B");

  console.log("[setup-auth] OK — User/Membership alinhados a auth.uid() para Storage RLS.");
  console.log(`[setup-auth] A: ${emailA} → workspace ${RT.workspaces.a.id}`);
  console.log(`[setup-auth] B: ${emailB} → workspace ${RT.workspaces.b.id}`);
}

main()
  .catch((e) => {
    console.error("[setup-auth] ERRO:", e instanceof Error ? e.message : String(e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
