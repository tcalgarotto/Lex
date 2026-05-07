import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Suite de integração: exercita Postgres real via Prisma.
 * - Não roda em CI por padrão (precisa DATABASE_URL acessível).
 * - Localmente: `npm run test:integration` (carrega .env via tsx? não — Vitest carrega
 *   process.env de quem o invoca; rode com `dotenv -e .env -- npm run test:integration`
 *   ou exporte as envs antes).
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
