// IMPORTANTE: o import abaixo precisa vir ANTES do `import { PrismaClient }`.
// Ele aplica como side-effect o fallback DATABASE_URL ← POSTGRES_PRISMA_URL e
// DIRECT_URL ← POSTGRES_URL_NON_POOLING, garantindo que o Prisma engine
// encontre as envs corretas mesmo quando o projeto roda em Vercel com a
// Supabase Integration ativa (que provisiona POSTGRES_*).
import "./env-normalize";

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function shouldLogQueries(): boolean {
  const flag = (process.env["PRISMA_QUERY_LOGS"] ?? "").trim().toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  // Default: nunca em produção, e nunca em dev (era a fonte do spam).
  // Habilite apenas com `PRISMA_QUERY_LOGS=true` quando precisar debugar.
  return false;
}

const logLevels: ("query" | "error" | "warn" | "info")[] = shouldLogQueries()
  ? ["query", "error", "warn"]
  : process.env["NODE_ENV"] === "production"
    ? ["error"]
    : ["error", "warn"];

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: logLevels,
  });

if (process.env["NODE_ENV"] !== "production") globalForPrisma.prisma = prisma;
