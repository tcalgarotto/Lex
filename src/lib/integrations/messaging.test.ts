import { describe, expect, it } from "vitest";
import { emailAdapter, whatsappAdapter } from "./messaging";

describe("emailAdapter", () => {
  it("recusa endereço inválido", async () => {
    if (!emailAdapter.sendMessage) throw new Error("contract");
    const r = await emailAdapter.sendMessage(
      { workspaceId: "ws" },
      { to: "not-an-email", body: "ola" },
    );
    expect(r.ok).toBe(false);
    expect(r.fingerprint).toHaveLength(16);
  });

  it("dry-run sem secretRef", async () => {
    if (!emailAdapter.sendMessage) throw new Error("contract");
    const r = await emailAdapter.sendMessage(
      { workspaceId: "ws" },
      { to: "alice@example.com", subject: "Audiência", body: "Confirmação." },
    );
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/Dry-run/i);
  });

  it("aceita envio com secretRef configurado", async () => {
    if (!emailAdapter.sendMessage) throw new Error("contract");
    const r = await emailAdapter.sendMessage(
      { workspaceId: "ws", secretRef: "env:RESEND_API_KEY" },
      { to: "alice@example.com", body: "ok" },
    );
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/enfileirado/);
  });
});

describe("whatsappAdapter", () => {
  it("rejeita número malformado", async () => {
    if (!whatsappAdapter.sendMessage) throw new Error("contract");
    const r = await whatsappAdapter.sendMessage(
      { workspaceId: "ws" },
      { to: "abc", body: "x" },
    );
    expect(r.ok).toBe(false);
  });

  it("aceita número internacional", async () => {
    if (!whatsappAdapter.sendMessage) throw new Error("contract");
    const r = await whatsappAdapter.sendMessage(
      { workspaceId: "ws" },
      { to: "+5511999999999", body: "Lembrete: audiência amanhã." },
    );
    expect(r.ok).toBe(true);
  });
});
