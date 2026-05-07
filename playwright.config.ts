import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["E2E_PORT"] ?? 3000);
const BASE_URL = process.env["E2E_BASE_URL"] ?? `http://localhost:${PORT}`;
const isCI = !!process.env["CI"];

/**
 * Convenções:
 * - `npm run test:e2e` sobe um Next dev server em paralelo (webServer)
 *   se `E2E_BASE_URL` não estiver setado. Em CI/preview definir `E2E_BASE_URL`
 *   para apontar para o deploy de preview e desligar o webServer (ver `webServer`).
 * - Testes em `tests/e2e/` rodam contra o BASE_URL.
 * - Reusa o servidor existente em dev local para iterar rápido.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 1,
  reporter: isCI ? [["github"], ["list"]] : "list",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    screenshot: "only-on-failure",
    video: isCI ? "retain-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env["E2E_BASE_URL"]
    ? undefined
    : {
        command: `next dev --port ${PORT}`,
        port: PORT,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        env: {
          NODE_ENV: "development",
        },
      },
});
