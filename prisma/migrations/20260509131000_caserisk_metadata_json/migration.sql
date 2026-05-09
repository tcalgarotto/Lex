-- F4.5 — Adiciona metadataJson opcional ao CaseRisk para guardar evidência
-- estruturada de inconsistências documentais (documentId, suggestion, etc.).
ALTER TABLE "CaseRisk" ADD COLUMN IF NOT EXISTS "metadataJson" JSONB;
