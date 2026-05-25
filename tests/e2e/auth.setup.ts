import { mkdirSync } from "node:fs";
import * as path from "node:path";
import { test as setup } from "@playwright/test";
import { injectSupabaseSession } from "./helpers/supabase-session";

const authDir = path.join(process.cwd(), "tests/e2e/.auth");
const authFile = path.join(authDir, "user.json");

const email =
  process.env["E2E_USER_EMAIL"]?.trim() ||
  process.env["SUPABASE_TEST_USER_A_EMAIL"]?.trim() ||
  "";
const password =
  process.env["E2E_USER_PASSWORD"]?.trim() ||
  process.env["SUPABASE_TEST_USER_A_PASSWORD"]?.trim() ||
  "";
const baseURL = process.env["E2E_BASE_URL"] ?? "http://127.0.0.1:3000";

setup.skip(
  !email || !password,
  "Defina E2E_USER_EMAIL/E2E_USER_PASSWORD ou SUPABASE_TEST_USER_A_* no ambiente.",
);

setup("gravar storageState autenticado", async ({ page, context }) => {
  mkdirSync(authDir, { recursive: true });

  await injectSupabaseSession(context, { email, password, baseURL });
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/(dashboard|cases|onboarding)/, { timeout: 60_000 });

  await page
    .waitForResponse(
      (res) => res.url().includes("/api/auth/sync") && res.status() === 200,
      { timeout: 30_000 },
    )
    .catch(() => undefined);

  await page.context().storageState({ path: authFile });
});
