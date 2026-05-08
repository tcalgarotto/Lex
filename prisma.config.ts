import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import type { PrismaConfig } from "prisma";

/**
 * Carrega `.env` local (ou `.env.production.local` em prod) ANTES do Prisma
 * ler o schema. Necessário porque, com `prisma.config.ts` presente, o Prisma
 * NÃO carrega `.env` automaticamente (opt-in deliberado).
 *
 * Em produção (Vercel/CI), as variáveis já vêm em `process.env` — esse loader
 * é no-op nesse caso. Em dev local, garante que `npm run db:push` /
 * `db:migrate` / `db:generate` continuem funcionando sem flags extras.
 *
 * Parse minimalista (KEY=VALUE com aspas opcionais). Sem dependência externa.
 */
function loadDotenv(file: string): void {
  if (!existsSync(file)) return;
  const text = readFileSync(file, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue; // não sobrescreve env existente
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

// Ordem: .env.local sobrescreve .env (padrão Next.js).
loadDotenv(path.resolve(process.cwd(), ".env"));
loadDotenv(path.resolve(process.cwd(), ".env.local"));

/**
 * Configuração canônica do Prisma (substitui o bloco `package.json#prisma`,
 * deprecado em Prisma 6 e removido em Prisma 7).
 *
 * Documentação: https://pris.ly/prisma-config
 */
export default {
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
} satisfies PrismaConfig;
