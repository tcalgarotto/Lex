import { describe, it, expect } from "vitest";
import { CorpusProvider } from "@prisma/client";
import {
  getProviderEntry,
  listProviderEntries,
  snapshotProviderStatuses,
} from "./registry";

describe("provider registry", () => {
  it("inclui FIXTURE/LEXML/STF/STJ/DATAJUD/CAMARA/SENADO", () => {
    expect(getProviderEntry(CorpusProvider.FIXTURE)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.LEXML)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.STF)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.STJ)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.DATAJUD)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.CAMARA)).not.toBeNull();
    expect(getProviderEntry(CorpusProvider.SENADO)).not.toBeNull();
  });

  it("FIXTURE sempre status=ok e mode=fixture", () => {
    const entry = getProviderEntry(CorpusProvider.FIXTURE);
    expect(entry).not.toBeNull();
    const status = entry!.status();
    expect(status.status).toBe("ok");
    expect(status.mode).toBe("fixture");
    expect(status.requiresApiKey).toBe(false);
  });

  it("DATAJUD sem chave fica not_configured (mode=live por default em prod)", () => {
    const entry = getProviderEntry(CorpusProvider.DATAJUD);
    const status = entry!.status();
    // Em testes sem env DATAJUD_API_KEY, pode ficar disabled (override env)
    // ou not_configured (default live + sem chave). Ambos são aceitáveis.
    expect(["disabled", "not_configured"]).toContain(status.status);
    expect(status.requiresApiKey).toBe(true);
  });

  it("CAMARA habilitado por default (sem chave)", () => {
    const entry = getProviderEntry(CorpusProvider.CAMARA);
    const status = entry!.status();
    expect(status.requiresApiKey).toBe(false);
    expect(["ok", "disabled"]).toContain(status.status);
  });

  it("SENADO habilitado por default (sem chave)", () => {
    const entry = getProviderEntry(CorpusProvider.SENADO);
    const status = entry!.status();
    expect(status.requiresApiKey).toBe(false);
    expect(["ok", "disabled"]).toContain(status.status);
  });

  it("ordena entries por priority desc", () => {
    const entries = listProviderEntries();
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1]!.priority).toBeGreaterThanOrEqual(entries[i]!.priority);
    }
  });

  it("snapshotProviderStatuses retorna todos providers cadastrados (>=7)", () => {
    const snap = snapshotProviderStatuses();
    expect(snap.length).toBeGreaterThanOrEqual(7);
    const ids = snap.map((s) => s.id);
    expect(ids).toContain(CorpusProvider.FIXTURE);
    expect(ids).toContain(CorpusProvider.LEXML);
    expect(ids).toContain(CorpusProvider.STF);
    expect(ids).toContain(CorpusProvider.STJ);
    expect(ids).toContain(CorpusProvider.DATAJUD);
    expect(ids).toContain(CorpusProvider.CAMARA);
    expect(ids).toContain(CorpusProvider.SENADO);
  });
});
