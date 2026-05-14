import { mkdirSync } from "node:fs";
import * as path from "node:path";
import { test as setup } from "@playwright/test";

const authDir = path.join(process.cwd(), "tests/e2e/.auth");
const authFile = path.join(authDir, "user.json");

const email = process.env["E2E_USER_EMAIL"]?.trim() ?? "";
const password = process.env["E2E_USER_PASSWORD"]?.trim() ?? "";

setup.skip(
  !email || !password,
  "Defina E2E_USER_EMAIL e E2E_USER_PASSWORD no ambiente (ver docs/UX_FLOW_AUDIT.md → P0.1 Case Flow E2E).",
);

setup("gravar storageState autenticado", async ({ page }) => {
  mkdirSync(authDir, { recursive: true });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.waitForURL(/\/(dashboard|cases)/, { timeout: 60_000 });
  await page.context().storageState({ path: authFile });
});
