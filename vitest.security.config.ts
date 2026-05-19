import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";
import path from "node:path";

loadEnv({ path: path.resolve(__dirname, ".env") });

const passthroughKeys = [
  "RED_TEAM_CONFIRM_STAGING",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_TEST_USER_A_EMAIL",
  "SUPABASE_TEST_USER_B_EMAIL",
  "SUPABASE_TEST_USER_A_PASSWORD",
  "SUPABASE_TEST_USER_B_PASSWORD",
  "DATABASE_URL",
  "DEEPSEEK_API_KEY",
  "AI_CHAT_PROVIDER",
] as const;

const securityTestEnv: Record<string, string> = {
  NODE_ENV: "test",
  REDIS_URL: (process.env["REDIS_URL"] ?? "").trim() || "redis://127.0.0.1:6379",
};
for (const key of passthroughKeys) {
  const v = process.env[key];
  if (v != null && String(v).trim() !== "") securityTestEnv[key] = String(v).trim();
}

/**
 * Red team — integração real (Postgres + handlers).
 * `npm run security:red-team:test`
 */
export default defineConfig({
  test: {
    env: securityTestEnv,
    environment: "node",
    include: [
      "tests/security/red-team/**/*.integration.test.ts",
      "tests/security/red-team/**/*.test.ts",
      "tests/security/red-team/static-p0-patterns.test.ts",
    ],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    sequence: { concurrent: false },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
