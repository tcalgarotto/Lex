import type { LegalLayer } from "@prisma/client";

export type SourceType =
  | "process_document"
  | "legislation"
  | "jurisprudence"
  | "process_memory"
  | "legal_piece"
  | "style_example"
  | "unknown";

export type RetrievedChunk = {
  id: string;
  text: string;
  layer: LegalLayer;
  sourceType: SourceType;
  sourceLabel: string;
  score: number | null;
  meta: Record<string, string | undefined>;
};
