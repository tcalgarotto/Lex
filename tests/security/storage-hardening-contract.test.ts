import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RT } from "../security/red-team/fixture-ids";
import {
  ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES,
} from "@/lib/documents/upload-constraints";
import { validateDocumentFileSignature } from "@/lib/documents/file-signature";
import { MINIMAL_PDF_BUFFER } from "../security/red-team/upload-fixtures";

const ROOT = path.resolve(__dirname, "../..");

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf-8");
}

describe("FASE B — Storage/Auth contratos no código", () => {
  it("B1 upload gera path no servidor (workspaceId/documentId/safeName)", () => {
    const upload = read("src/app/api/documents/upload/route.ts");
    const caseDoc = read("src/app/api/cases/[id]/documents/route.ts");
    const post = upload.slice(upload.indexOf("export async function POST"));
    expect(upload).toMatch(/documentStoragePath\(workspaceId,\s*documentId/);
    expect(upload).toMatch(/nanoid\(\)/);
    expect(caseDoc).toMatch(/documentStoragePath\(workspaceId,\s*documentId/);
    expect(post.indexOf("await uploadDocumentBuffer")).toBeGreaterThan(
      post.indexOf("validateLegalDocumentUploadBuffer"),
    );
  });

  it("B2 service_role só server-side; sem NEXT_PUBLIC service key", () => {
    const env = read("src/lib/env.ts");
    expect(env).not.toMatch(/NEXT_PUBLIC.*SERVICE_ROLE/);
    const adminPath = path.join(ROOT, "src/lib/supabase/admin.ts");
    expect(fs.readFileSync(adminPath, "utf-8")).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
    const appHits = walkSrc(/createSupabaseAdminClient/).filter((f) => f.startsWith("app/"));
    expect(appHits).toHaveLength(0);
  });

  it("B3 rotas de download exigem contexto de workspace", () => {
    const fileRoute = read("src/app/api/documents/[documentId]/file/route.ts");
    expect(fileRoute).toMatch(/getWorkspaceContext|workspaceId/);
  });
});

describe("FASE C — MIME e magic bytes (contrato)", () => {
  it("C1 allowlist não inclui msword", () => {
    expect(ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES.has("application/msword")).toBe(false);
    expect(ALLOWED_DOCUMENT_UPLOAD_MIME_TYPES.has("application/vnd.ms-word")).toBe(false);
  });

  it("C2 msword e PDF falso bloqueados na validação", () => {
    const msword = validateDocumentFileSignature(
      MINIMAL_PDF_BUFFER,
      "x.doc",
      "application/msword",
    );
    expect(msword.ok).toBe(false);

    const fakePdf = validateDocumentFileSignature(
      Buffer.from("not a pdf", "utf8"),
      "x.pdf",
      "application/pdf",
    );
    expect(fakePdf.ok).toBe(false);
  });

  it("C3 upload route: 415 antes de storage e inngest", () => {
    const upload = read("src/app/api/documents/upload/route.ts");
    const postHandler = upload.slice(upload.indexOf("export async function POST"));
    const sigIdx = postHandler.indexOf("validateLegalDocumentUploadBuffer");
    const storageIdx = postHandler.indexOf("await uploadDocumentBuffer");
    const dbIdx = postHandler.indexOf("prisma.document.create");
    const inngestIdx = postHandler.indexOf("inngest.send");
    expect(sigIdx).toBeGreaterThan(-1);
    expect(storageIdx).toBeGreaterThan(sigIdx);
    expect(dbIdx).toBeGreaterThan(storageIdx);
    expect(inngestIdx).toBeGreaterThan(dbIdx);
    expect(postHandler).toMatch(/status:\s*415/);
  });
});

describe("FASE D — e-mails fake red-team", () => {
  it("D1 defaults do código (fixture.lex.invalid)", () => {
    expect(RT.users.commonA.email).toBe("redteam-common-a@fixture.lex.invalid");
    expect(RT.users.commonB.email).toBe("redteam-common-b@fixture.lex.invalid");
  });
});

function walkSrc(pattern: RegExp): string[] {
  const srcDir = path.join(ROOT, "src");
  const out: string[] = [];
  function walk(dir: string, rel: string) {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      if (fs.statSync(p).isDirectory()) {
        if (name !== "node_modules") walk(p, r);
      } else if (/\.(ts|tsx)$/.test(name)) {
        if (pattern.test(fs.readFileSync(p, "utf8"))) out.push(r);
      }
    }
  }
  walk(srcDir, "");
  return out;
}
