export type CaseIntakeFundamentalMeta = {
  nextSteps: string[];
  missingQuestions: string[];
  informationGaps?: string[];
  partyRelations?: Array<{ from: string; to: string; relation: string }>;
  evidenceMentioned?: string[];
  needsConfirmation?: string[];
  urgencyScore?: number | null;
  readinessScore?: number | null;
};

export function readCaseIntakeFundamentalMeta(metadata: unknown): CaseIntakeFundamentalMeta | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>)["intakeFundamental"];
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const strList = (v: unknown) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.trim().length > 0) : [];

  const relations = Array.isArray(o["partyRelations"])
    ? o["partyRelations"]
        .filter((x): x is { from: string; to: string; relation: string } => {
          if (!x || typeof x !== "object") return false;
          const r = x as Record<string, unknown>;
          return (
            typeof r["from"] === "string" &&
            typeof r["to"] === "string" &&
            typeof r["relation"] === "string"
          );
        })
        .map((r) => ({ from: r.from, to: r.to, relation: r.relation }))
    : [];

  return {
    nextSteps: strList(o["nextSteps"]),
    missingQuestions: strList(o["missingQuestions"]),
    informationGaps: strList(o["informationGaps"]),
    partyRelations: relations,
    evidenceMentioned: strList(o["evidenceMentioned"]),
    needsConfirmation: strList(o["needsConfirmation"]),
    urgencyScore: typeof o["urgencyScore"] === "number" ? o["urgencyScore"] : null,
    readinessScore: typeof o["readinessScore"] === "number" ? o["readinessScore"] : null,
  };
}
