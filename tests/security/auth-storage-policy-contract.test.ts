import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const POLICIES = fs.readFileSync(
  path.resolve(__dirname, "../../supabase/storage/documents_policies.sql"),
  "utf-8",
);
const SYNC_USER = fs.readFileSync(
  path.resolve(__dirname, "../../src/lib/auth/sync-user.ts"),
  "utf-8",
);
const PROXY = fs.readFileSync(path.resolve(__dirname, "../../src/proxy.ts"), "utf-8");
const SESSION = fs.readFileSync(
  path.resolve(__dirname, "../../src/lib/auth/session.ts"),
  "utf-8",
);

describe("Auth + Storage — contratos de segurança", () => {
  it("RLS usa auth.uid() para membership, não email do JWT", () => {
    expect(POLICIES).toMatch(/auth\.uid\(\)/);
    expect(POLICIES).toMatch(/m\."userId"\s*=\s*\(auth\.uid\(\)\)::text/);
    expect(POLICIES).not.toMatch(/auth\.jwt\(\)\s*->>\s*'email'/);
  });

  it("sync Prisma usa id do Supabase Auth como User.id", () => {
    expect(SYNC_USER).toMatch(/where:\s*\{\s*id:\s*authUser\.id\s*\}/);
    expect(SYNC_USER).toMatch(/id:\s*authUser\.id/);
  });

  it("sessão servidor usa getUser(), não getSession()", () => {
    expect(SESSION).toMatch(/getUser\(\)/);
    expect(SESSION).not.toMatch(/getSession\(\)/);
  });

  it("middleware: /api/* não faz fallback para getSession", () => {
    expect(PROXY).toMatch(/isApiRoute/);
    expect(PROXY).toMatch(/!isApiRoute/);
    expect(PROXY).toMatch(/getUser\(\)/);
  });

  it("upload servidor usa admin (service role), não cliente anon", () => {
    const storage = fs.readFileSync(
      path.resolve(__dirname, "../../src/lib/storage.ts"),
      "utf-8",
    );
    expect(storage).toMatch(/createSupabaseAdminClient/);
    expect(storage).not.toMatch(/createSupabaseBrowserClient/);
  });
});
