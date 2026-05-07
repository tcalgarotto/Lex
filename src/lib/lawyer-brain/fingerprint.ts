/**
 * Lawyer Style Brain — fingerprints determinísticos e memória de citações
 * preferidas a partir de texto de peças (ex.: peças vencedoras).
 */

export type WritingFingerprint = {
  avgSentenceLength: number;
  avgWordLength: number;
  commaPerSentence: number;
  formalMarkers: string[];
  estimatedTone: "assertivo" | "diplomatico" | "neutro";
};

export type StructureFingerprint = {
  detectedSections: Array<{ label: string; order: number }>;
  hasFactsBlock: boolean;
  hasRequestsBlock: boolean;
  hasLegalGroundsBlock: boolean;
};

export type LawyerBrainSnapshot = {
  writing: WritingFingerprint;
  structure: StructureFingerprint;
  preferredCitations: string[];
  sampleExtractedAt: string;
};

const FORMAL_MARKERS = [
  "com efeito",
  "nesse sentido",
  "ante o exposto",
  "pelo exposto",
  "requer-se",
  "outrossim",
  "ademais",
  "por oportuno",
];

const SECTION_HEADERS =
  /^(dos?\s+fatos|do\s+direito|dos?\s+pedidos|da\s+tutela|preliminarmente|qualifica[cç][aã]o)/gim;

export function computeWritingFingerprint(text: string): WritingFingerprint {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter((s) => s.length > 4);
  const words = cleaned.split(/\s+/).filter((w) => w.length > 0);
  const formalHits = FORMAL_MARKERS.filter((m) => cleaned.toLowerCase().includes(m));

  const avgSentenceLength =
    sentences.length === 0
      ? 0
      : Math.round(sentences.reduce((a, s) => a + s.length, 0) / sentences.length);
  const avgWordLength =
    words.length === 0
      ? 0
      : Math.round(
          words.reduce((a, w) => a + w.replace(/[^a-záéíóúâêôãõç]/gi, "").length, 0) /
            words.length,
        );

  const commas = (cleaned.match(/,/g) ?? []).length;
  const commaPerSentence = sentences.length === 0 ? 0 : commas / sentences.length;

  let estimatedTone: WritingFingerprint["estimatedTone"] = "neutro";
  if (/requer|pleiteia|postula|imperativo/i.test(cleaned)) estimatedTone = "assertivo";
  if (/excelent[ií]ssim|vem\s+respeitosamente/i.test(cleaned)) estimatedTone = "diplomatico";

  return {
    avgSentenceLength,
    avgWordLength,
    commaPerSentence: Math.round(commaPerSentence * 100) / 100,
    formalMarkers: formalHits.slice(0, 8),
    estimatedTone,
  };
}

export function computeStructureFingerprint(text: string): StructureFingerprint {
  const lines = text.split(/\n+/).map((l) => l.trim());
  const detectedSections: Array<{ label: string; order: number }> = [];
  let order = 0;
  for (const line of lines) {
    const head = line.slice(0, 48);
    SECTION_HEADERS.lastIndex = 0;
    if (SECTION_HEADERS.test(head)) {
      order += 1;
      detectedSections.push({ label: head.replace(/[:.\s]+$/, ""), order });
    }
  }

  const flat = text.toLowerCase();
  return {
    detectedSections,
    hasFactsBlock: /\bfatos\b/i.test(flat) || /dos?\s+fatos/i.test(flat),
    hasRequestsBlock: /\bpedidos\b/i.test(flat) || /dos?\s+pedidos/i.test(flat),
    hasLegalGroundsBlock: /\bdireito\b/i.test(flat) || /\bfundamenta/i.test(flat),
  };
}
