-- Remove application/msword da allowlist do bucket `documents` (read-only seguro).
-- Ajuste o array conforme o que o painel deve manter.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'application/octet-stream'
]::text[]
WHERE id = 'documents';

-- Verificar (esperado has_msword = false):
-- SELECT id, allowed_mime_types FROM storage.buckets WHERE id = 'documents';
