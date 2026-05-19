-- =============================================================================
-- Lex — Verificação read-only: hardening Supabase Storage (bucket `documents`)
-- =============================================================================
-- Executar no SQL Editor do projeto (staging/prod). Não altera dados.
-- Automatizado: npm run security:storage:hardening-check (usa DATABASE_URL)
--
-- RESULTADOS ESPERADOS (resumo):
--   Q1  → 1 linha, public = false
--   Q2  → exatamente 4 policies (documents_authenticated_*)
--   Q3  → 0 linhas (legadas ausentes)
--   Q4  → função contém auth.uid(); sem auth.jwt() ->> 'email'
--   Q5  → 0 linhas (sem USING/WITH CHECK true)
--   Q6  → 0 linhas (anon sem policy no bucket documents)
--   Q7  → allowed_mime_types sem wildcard; sem msword (se coluna existir)
-- =============================================================================

-- Q1 — Bucket `documents` privado
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets
WHERE id = 'documents' OR name = 'documents';
-- ESPERADO: public = false; file_size_limit = 52428800 (50 MB) se configurado no painel

-- Q2 — Policies ativas em storage.objects (bucket documents)
SELECT
  policyname,
  cmd,
  roles::text AS roles,
  qual IS NOT NULL AS has_using,
  with_check IS NOT NULL AS has_with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND (
    policyname LIKE 'documents_authenticated_%'
    OR policyname LIKE 'documents_%_own_workspace'
  )
ORDER BY policyname;
-- ESPERADO: 4 linhas — select, insert, update, delete (documents_authenticated_*)
-- roles deve incluir authenticated

-- Q3 — Legadas (devem estar ausentes)
SELECT policyname
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname IN (
    'documents_read_own_workspace',
    'documents_write_own_workspace',
    'documents_update_own_workspace',
    'documents_delete_own_workspace'
  );
-- ESPERADO: 0 linhas

-- Q4 — Definição de lex_auth_workspace_ids()
SELECT pg_get_functiondef('public.lex_auth_workspace_ids()'::regprocedure) AS fn_def;
-- ESPERADO: contém auth.uid(); NÃO contém auth.jwt() ->> 'email'

-- Q5 — Policies permissivas (true literal)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'documents%'
  AND (
    qual ~* 'using\s*\(\s*true\s*\)'
    OR with_check ~* 'with\s+check\s*\(\s*true\s*\)'
    OR qual = 'true'
    OR with_check = 'true'
  );
-- ESPERADO: 0 linhas

-- Q6 — Policies para role anon no bucket documents
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND 'anon' = ANY(roles)
  AND (
    qual ILIKE '%documents%'
    OR with_check ILIKE '%documents%'
    OR policyname ILIKE 'documents%'
  );
-- ESPERADO: 0 linhas

-- Q7 — MIME allowlist (painel Supabase)
SELECT
  id,
  allowed_mime_types,
  EXISTS (
    SELECT 1
    FROM unnest(COALESCE(allowed_mime_types, ARRAY[]::text[])) AS t(m)
    WHERE m = '*/*' OR m LIKE '%*%'
  ) AS has_wildcard,
  EXISTS (
    SELECT 1
    FROM unnest(COALESCE(allowed_mime_types, ARRAY[]::text[])) AS t(m)
    WHERE m IN ('application/msword', 'application/vnd.ms-word')
  ) AS has_msword
FROM storage.buckets
WHERE id = 'documents';
-- ESPERADO: has_wildcard = false; has_msword = false
-- Tipos recomendados: application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document
-- text/plain — somente se produto aceitar TXT (Lex aceita + magic bytes)
