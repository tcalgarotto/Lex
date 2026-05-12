-- Habilita extensão pg_trgm para buscas de texto eficientes (trigram)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índices GIN (trigram) para Processos
CREATE INDEX IF NOT EXISTS "Process_workspaceId_title_trgm_idx" ON "Process" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Process_workspaceId_number_trgm_idx" ON "Process" USING GIN ("number" gin_trgm_ops);

-- Índices GIN (trigram) para Peças Jurídicas
CREATE INDEX IF NOT EXISTS "LegalPiece_workspaceId_title_trgm_idx" ON "LegalPiece" USING GIN ("title" gin_trgm_ops);

-- Índices GIN (trigram) para Chunks de Documentos do Usuário
CREATE INDEX IF NOT EXISTS "DocumentChunk_textPreview_trgm_idx" ON "DocumentChunk" USING GIN ("textPreview" gin_trgm_ops);

-- Índices GIN (trigram) para Casos
CREATE INDEX IF NOT EXISTS "Case_workspaceId_title_trgm_idx" ON "Case" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Case_workspaceId_processNumber_trgm_idx" ON "Case" USING GIN ("processNumber" gin_trgm_ops);
