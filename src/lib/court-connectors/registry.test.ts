import { describe, expect, it } from "vitest";
import { CourtConnectorStatus, CourtConnectorType } from "@prisma/client";
import {
  getCourtConnectorDefinition,
  getCourtConnectorDefinitions,
  isConnectorActiveWithoutOfficialAuthorization,
} from "./registry";

describe("Free Official Court Stack registry", () => {
  it("keeps DataJud as the only broad automatic active court API", () => {
    const datajud = getCourtConnectorDefinition(CourtConnectorType.DATAJUD_PUBLIC);
    expect(datajud?.status).toBe(CourtConnectorStatus.active);
    expect(datajud?.canRunAutomatically).toBe(true);
    expect(datajud?.capabilities).toContain("movements");

    const unsafeActive = getCourtConnectorDefinitions().filter(isConnectorActiveWithoutOfficialAuthorization);
    expect(unsafeActive).toEqual([]);
  });

  it("does not mark official-only or login-based portals as active", () => {
    for (const provider of [
      CourtConnectorType.ESCRITORIO_DIGITAL,
      CourtConnectorType.MNI,
      CourtConnectorType.DOMICILIO_JUDICIAL,
      CourtConnectorType.PJE,
      CourtConnectorType.EPROC,
      CourtConnectorType.ESAJ,
      CourtConnectorType.PROJUDI,
    ]) {
      const connector = getCourtConnectorDefinition(provider);
      expect(connector).toBeTruthy();
      expect(connector?.status).not.toBe(CourtConnectorStatus.active);
      expect(connector?.canRunAutomatically).toBe(false);
    }
  });

  it("does not ask for passwords or certificate storage in copy", () => {
    const copy = JSON.stringify(getCourtConnectorDefinitions()).toLowerCase();
    expect(copy).not.toContain("login automático");
    expect(copy).not.toContain("armazenar senha");
    expect(copy).not.toContain("armazenar certificado");
  });
});
