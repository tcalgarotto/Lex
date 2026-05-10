import { describe, expect, it } from "vitest";
import { DocumentStatus } from "@prisma/client";
import { deriveDocumentDisplayStatus } from "./status-display";

const NOW = new Date("2026-05-08T20:00:00Z");
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

describe("deriveDocumentDisplayStatus", () => {
  it("UPLOADED → 'Enviado' (progress) sem stall", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.UPLOADED,
      updatedAt: minutesAgo(60),
      now: NOW,
    });
    expect(r.label).toBe("Enviado");
    expect(r.kind).toBe("progress");
    expect(r.stalled).toBe(false);
  });

  it("INDEXED → 'Pronto para busca' nunca trava", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.INDEXED,
      updatedAt: minutesAgo(60 * 24),
      now: NOW,
    });
    expect(r.label).toBe("Pronto para busca");
    expect(r.kind).toBe("ok");
    expect(r.stalled).toBe(false);
  });

  it("FAILED → 'Falhou' (error)", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.FAILED,
      updatedAt: minutesAgo(1),
      now: NOW,
    });
    expect(r.label).toBe("Falhou");
    expect(r.kind).toBe("error");
    expect(r.stalled).toBe(false);
  });

  it("PARSING há 5 min → 'Extraindo texto' (não trava)", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.PARSING,
      updatedAt: minutesAgo(5),
      now: NOW,
    });
    expect(r.label).toBe("Extraindo texto");
    expect(r.stalled).toBe(false);
  });

  it("PARSING há 16 min → 'Travado' (warning)", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.PARSING,
      updatedAt: minutesAgo(16),
      now: NOW,
    });
    expect(r.label).toBe("Travado");
    expect(r.kind).toBe("warning");
    expect(r.stalled).toBe(true);
    expect(r.raw).toBe(DocumentStatus.PARSING);
  });

  it("CHUNKING há 30 min → 'Travado'", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.CHUNKING,
      updatedAt: minutesAgo(30),
      now: NOW,
    });
    expect(r.label).toBe("Travado");
    expect(r.stalled).toBe(true);
  });

  it("EMBEDDING há 19 min → ainda 'Indexando'", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.EMBEDDING,
      updatedAt: minutesAgo(19),
      now: NOW,
    });
    expect(r.label).toBe("Indexando");
    expect(r.stalled).toBe(false);
  });

  it("EMBEDDING há 21 min → 'Travado'", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.EMBEDDING,
      updatedAt: minutesAgo(21),
      now: NOW,
    });
    expect(r.label).toBe("Travado");
    expect(r.stalled).toBe(true);
  });

  it("aceita updatedAt como string ISO", () => {
    const r = deriveDocumentDisplayStatus({
      status: DocumentStatus.PARSING,
      updatedAt: minutesAgo(20).toISOString(),
      now: NOW,
    });
    expect(r.stalled).toBe(true);
  });
});
