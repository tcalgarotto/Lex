import { describe, it, expect } from "vitest";
import { CorpusProvider } from "@prisma/client";
import {
  getProviderEntry,
  listProviderEntries,
  snapshotProviderStatuses,
} from "./registry";

describe("provider registry", () => {
  it("inclui FIXTURE/LEXML/STF/STJ/DATAJUD", () => {
    expect(getProviderEntry(CorpusProvider.FIXTURE)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.LEXML)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.STF)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.STJ)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.DATAJUD)).not.toBeNull();
  });

  it("FIXTURE sempre status=ok e mode=fixture", () => {
    const entry = getProviderEntry(CorpusProvider.FIXTURE);
    expect(entry).not.toBeNull();
    const status = entry!.status();
    expect(status.status).toBe("ok");
    expect(status.mode).toBe("fixture");
    expect(status.requiresApiKey).toBe(false);
  });

  it("DATAJUD sem chave fica not_configured ou disabled", () => {
    const entry = getProviderEntry(CorpusProvider.DATAJUD);
    const status = entry!.status();
    // Em testes sem env DATAJUD_API_KEY, deve estar disabled (default) ou not_configured.
    expect(["disabled", "not_configured"]).toContain(status.status);
    expect(status.requiresApiKey).toBe(true);
  });

  it("ordena entries por priority desc", () => {
    const entries = listProviderEntries();
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1]!.priority).toBeGreaterThanOrEqual(entries[i]!.priority);
    }
  });

  it("snapshotProviderStatuses retorna todos providers cadastrados", () => {
    const snap = snapshotProviderStatuses();
    expect(snap.length).toBeGreaterThanOrEqual(5);
    const ids = snap.map((s) => s.id);
    expect(ids).toContain(CorpusProvider.FIXTURE);
    expect(ids).toContain(CorpusProvider.LEXML);
    expect(ids).toContain(CorpusProvider.STF);
    expect(ids).toContain(CorpusProvider.STJ);
    expect(ids).toContain(CorpusProvider.DATAJUD);
  });
});
