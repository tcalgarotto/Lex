import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
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
