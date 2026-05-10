import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    // Não usar `tests/**/*.test.ts(x)` aqui: arrasta `tests/integration/**`,
    // que exige Postgres (roda só em `npm run test:integration`).
    include: [
      "src/**/*.test.ts",
      "src/**/*.test.tsx",
      "tests/cases/**/*.test.ts",
      "tests/cases/**/*.test.tsx",
      "tests/legal-research/**/*.test.ts",
      "tests/legal-research/**/*.test.tsx",
      "tests/security/**/*.test.ts",
      "tests/security/**/*.test.tsx",
      "tests/ui/**/*.test.ts",
      "tests/ui/**/*.test.tsx",
    ],
    // Cada arquivo roda em fork isolado: garante que `vi.doMock` num arquivo
    // não vaze para outro (importante para os testes de rate-limit/redis).
    pool: "forks",
    isolate: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
