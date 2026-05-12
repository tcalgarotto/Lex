-- Otimização Elite: Índices Parciais para Soft Deletes e Índices de Cobertura
-- Estes índices garantem que o banco ignore registros excluídos/arquivados nas consultas padrão.

-- Índices Parciais para Documentos (Workspace + Status ativo)
CREATE INDEX IF NOT EXISTS "Document_workspaceId_active_idx" 
ON "Document" ("workspaceId", "status") 
WHERE "deletedAt" IS NULL AND "archivedAt" IS NULL;

-- Índices Parciais para Peças Jurídicas
CREATE INDEX IF NOT EXISTS "LegalPiece_workspaceId_active_idx" 
ON "LegalPiece" ("workspaceId") 
WHERE "deletedAt" IS NULL AND "archivedAt" IS NULL;

-- Índices Parciais para Casos
CREATE INDEX IF NOT EXISTS "Case_workspaceId_active_idx" 
ON "Case" ("workspaceId", "status") 
WHERE "deletedAt" IS NULL AND "archivedAt" IS NULL;

-- Índice de Cobertura para Observabilidade (Admin/Stats)
-- Permite que o banco responda métricas sem tocar na tabela (Index Only Scan)
CREATE INDEX IF NOT EXISTS "ObservabilityLog_workspaceId_kind_latency_idx" 
ON "ObservabilityLog" ("workspaceId", "kind", "latencyMs", "createdAt");

-- Índice para busca de Chunks de Documentos do Usuário
CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_ordinal_idx" 
ON "DocumentChunk" ("documentId", "chunkIndex");
