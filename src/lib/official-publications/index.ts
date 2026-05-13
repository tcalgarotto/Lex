export type OfficialPublicationSearchInput = {
  cnj?: string;
  term?: string;
};

export type NormalizedOfficialPublication = {
  source: "DJEN" | "OFFICIAL_GAZETTE" | "TRIBUNAL_PUBLIC_QUERY";
  title: string;
  summary: string;
  publishedAt?: Date | null;
  url?: string | null;
  rawText?: string | null;
};

export type OfficialPublicationConnector = {
  id: string;
  name: string;
  status: "manual_bridge" | "public_read_only" | "requires_official_authorization";
  search(input: OfficialPublicationSearchInput): Promise<NormalizedOfficialPublication[]>;
};

export function normalizeOfficialPublication(raw: Partial<NormalizedOfficialPublication>) {
  return {
    source: raw.source ?? "OFFICIAL_GAZETTE",
    title: raw.title?.trim() || "Publicação oficial",
    summary: raw.summary?.trim() || "Publicação importada para revisão humana.",
    publishedAt: raw.publishedAt ?? null,
    url: raw.url ?? null,
    rawText: raw.rawText ?? null,
  } satisfies NormalizedOfficialPublication;
}

export async function searchOfficialPublicationByCnj(_cnj: string) {
  return [] satisfies NormalizedOfficialPublication[];
}

export async function searchOfficialPublicationByTerm(_term: string) {
  return [] satisfies NormalizedOfficialPublication[];
}
