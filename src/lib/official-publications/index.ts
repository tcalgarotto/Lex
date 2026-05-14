export type OfficialPublicationSearchInput = {
  cnj?: string;
  term?: string;
  tribunalAcronym?: string;
  publishedFrom?: Date | string | null;
  publishedTo?: Date | string | null;
};

export type NormalizedOfficialPublication = {
  source: "DJEN" | "OFFICIAL_GAZETTE" | "TRIBUNAL_PUBLIC_QUERY";
  title: string;
  summary: string;
  publishedAt?: Date | null;
  url?: string | null;
  rawText?: string | null;
  tribunalAcronym?: string | null;
  processNumber?: string | null;
  externalId?: string | null;
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
    tribunalAcronym: raw.tribunalAcronym ?? null,
    processNumber: raw.processNumber ?? null,
    externalId: raw.externalId ?? null,
  } satisfies NormalizedOfficialPublication;
}

const COMUNICA_PJE_PUBLIC_BASE_URL = "https://comunicaapi.pje.jus.br/api/v1/comunicacao";

type ComunicaPjeItem = {
  id?: number | string;
  data_disponibilizacao?: string;
  siglaTribunal?: string;
  tipoComunicacao?: string;
  nomeOrgao?: string;
  texto?: string;
  numero_processo?: string;
  numeroProcesso?: string;
};

function clean(value?: string | null) {
  return value?.trim() || "";
}

function dateParam(value?: Date | string | null) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function buildComunicaPjeUrl(input: OfficialPublicationSearchInput) {
  const params = new URLSearchParams();
  const cnj = clean(input.cnj).replace(/\D/g, "");
  const term = clean(input.term);
  const tribunal = clean(input.tribunalAcronym).toUpperCase();
  const from = dateParam(input.publishedFrom);
  const to = dateParam(input.publishedTo);

  if (cnj) params.set("numeroProcesso", cnj);
  if (term) params.set("texto", term);
  if (tribunal) params.set("siglaTribunal", tribunal);
  if (from) params.set("dataDisponibilizacaoInicio", from);
  if (to) params.set("dataDisponibilizacaoFim", to);

  // The public API rejects date-only broad searches unless the page size is capped.
  params.set("itensPorPagina", cnj || term || tribunal ? "20" : "5");

  return `${COMUNICA_PJE_PUBLIC_BASE_URL}?${params.toString()}`;
}

export async function searchComunicaPjePublic(input: OfficialPublicationSearchInput) {
  if (!clean(input.cnj) && !clean(input.term) && !clean(input.tribunalAcronym) && !input.publishedFrom) {
    return [] satisfies NormalizedOfficialPublication[];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(buildComunicaPjeUrl(input), {
      signal: controller.signal,
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [] satisfies NormalizedOfficialPublication[];

    const payload = (await response.json()) as { items?: ComunicaPjeItem[] };
    return (payload.items ?? []).slice(0, 20).map((item) => {
      const text = stripHtml(item.texto ?? "");
      const processNumber = item.numero_processo ?? item.numeroProcesso ?? null;
      return normalizeOfficialPublication({
        source: "DJEN",
        title: `${item.tipoComunicacao ?? "Comunicação"}${processNumber ? ` ${processNumber}` : ""}`,
        summary: text.slice(0, 280) || "Comunicação pública encontrada no Comunica PJe/DJEN.",
        publishedAt: item.data_disponibilizacao ? new Date(`${item.data_disponibilizacao}T00:00:00.000Z`) : null,
        rawText: item.texto ?? null,
        tribunalAcronym: item.siglaTribunal ?? null,
        processNumber,
        externalId: item.id ? String(item.id) : null,
      });
    });
  } catch {
    return [] satisfies NormalizedOfficialPublication[];
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchOfficialPublicationByCnj(cnj: string) {
  return searchComunicaPjePublic({ cnj });
}

export async function searchOfficialPublicationByTerm(term: string) {
  return searchComunicaPjePublic({ term });
}
