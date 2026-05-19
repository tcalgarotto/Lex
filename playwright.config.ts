import * as path from "node:path";
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["E2E_PORT"] ?? 3000);
const BASE_URL = process.env["E2E_BASE_URL"] ?? `http://localhost:${PORT}`;
const isCI = !!process.env["CI"];
const authFile = path.join(__dirname, "tests/e2e/.auth/user.json");
const authE2eSpecs = /(case-flow-fundamental|lazy-intake-p02)\.spec\.ts/;
const hasE2eAuthCreds =
  !!process.env["E2E_USER_EMAIL"]?.trim() && !!process.env["E2E_USER_PASSWORD"]?.trim();

/**
 * Convenções:
 * - `npm run test:e2e` sobe um Next dev server em paralelo (webServer)
 *   se `E2E_BASE_URL` não estiver setado. Em CI/preview definir `E2E_BASE_URL`
 *   para apontar para o deploy de preview e desligar o webServer (ver `webServer`).
 * - Testes em `tests/e2e/` rodam contra o BASE_URL.
 * - Reusa o servidor existente em dev local para iterar rápido.
 * - Fluxo P0.1 (`case-flow-fundamental.spec.ts`): projeto `chromium-auth` + `auth.setup.ts`
 *   (variáveis E2E_USER_EMAIL / E2E_USER_PASSWORD). Ver docs/UX_FLOW_AUDIT.md.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : 1,
  reporter: isCI
    ? [
        ["github"],
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ]
    : [
        ["list"],
        ["html", { outputFolder: "playwright-report", open: "never" }],
      ],
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: isCI ? "retain-on-failure" : "on-first-retry",
    screenshot: "only-on-failure",
    video: isCI ? "retain-on-failure" : "off",
  },
  projects: hasE2eAuthCreds
    ? [
        {
          name: "setup",
          testMatch: /auth\.setup\.ts/,
        },
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          dependencies: [],
          testIgnore: [/auth\.setup\.ts/, authE2eSpecs],
        },
        {
          name: "chromium-auth",
          use: {
            ...devices["Desktop Chrome"],
            storageState: authFile,
          },
          dependencies: ["setup"],
          testMatch: authE2eSpecs,
          timeout: 240_000,
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          testIgnore: [/auth\.setup\.ts/, authE2eSpecs],
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
