import { describe, expect, it } from "vitest";
import { scrubPii } from "@/lib/legal-research/legal-research-logger";

describe("legal research logging safety", () => {
  it("scrubPii masks CPF-like sequences", () => {
    expect(scrubPii("cpf 123.456.789-00")).not.toContain("789-00");
  });

  it("scrubPii leaves short identifiers mostly intact", () => {
    expect(scrubPii("case-abc")).toContain("case");
  });
});
