-- Coluna gerada de tsvector (idioma português) para BM25 nativo do Postgres.
-- `unaccent` garante que pesquisas em texto sem acentos achem termos com acentos.
ALTER TABLE "LegalChunk"
  ADD COLUMN "textTsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce("text", ''))) STORED;

CREATE INDEX "LegalChunk_textTsv_gin"
  ON "LegalChunk" USING GIN ("textTsv");
