-- =============================================================================
-- Lex — Supabase Storage policies (bucket `documents`)
-- =============================================================================
--
-- OBJETIVO: versionar a política esperada para acesso direto via Supabase Storage
-- (client anon/authenticated + JWT). O app Lex usa Prisma + service_role no servidor;
-- estas policies NÃO protegem queries Prisma — apenas Storage API / PostgREST storage.
--
-- PATH CANÔNICO: `{workspaceId}/{documentId}/{fileName}`
--   Ex.: rt_workspace_a/rt_document_a/redteam-doc-a-fake.pdf
--
-- PRÉ-REQUISITOS (aplicar manualmente no projeto Supabase de staging/prod):
--   1. Bucket `documents` PRIVADO (public = false).
--   2. RLS habilitado em storage.objects: `ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;`
--   3. Usuários Supabase Auth com o MESMO email da tabela `"User"` (sync em /api/auth/sync).
--
-- EXCEÇÃO OPERACIONAL: `service_role` bypassa RLS — usado apenas server-side
-- (`src/lib/storage.ts`). Nunca expor SUPABASE_SERVICE_ROLE_KEY no cliente.
--
-- CHECKLIST PÓS-APLICAÇÃO:
--   [ ] Bucket documents não aparece em listagem anon
--   [ ] Usuário A não baixa objeto com prefixo workspace B
--   [ ] Usuário B baixa apenas objetos do seu workspace
--   [ ] Nenhuma policy permissiva total (sem filtro de tenant) no bucket documents
--   [ ] Rodar: npm run security:red-team:test (storage-policy-remote com env staging)
--
-- =============================================================================

-- Revogar acesso anon explícito (defesa em profundidade).
REVOKE ALL ON storage.objects FROM anon;
REVOKE ALL ON storage.buckets FROM anon;

-- -----------------------------------------------------------------------------
-- Helper: workspace IDs do usuário autenticado (JWT email ↔ Membership)
-- Ajuste se o vínculo Auth for auth.uid() = User.id em vez de email.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.lex_auth_workspace_ids()
RETURNS SETOF text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m."workspaceId"::text
  FROM "Membership" m
  INNER JOIN "User" u ON u.id = m."userId"
  WHERE u.email = (auth.jwt() ->> 'email')
$$;

COMMENT ON FUNCTION public.lex_auth_workspace_ids() IS
  'Workspace IDs do usuário Supabase Auth (via email JWT). Usado em policies do bucket documents.';

-- Primeiro segmento do path = workspaceId
CREATE OR REPLACE FUNCTION public.lex_storage_workspace_prefix(object_name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT split_part(object_name, '/', 1)
$$;

-- Usuário autenticado é membro do workspace do prefixo do objeto
CREATE OR REPLACE FUNCTION public.lex_storage_user_owns_prefix(object_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.lex_storage_workspace_prefix(object_name) IN (
    SELECT public.lex_auth_workspace_ids()
  )
$$;

-- Formato mínimo: workspaceId/documentId/fileName (≥ 3 segmentos, sem ..)
CREATE OR REPLACE FUNCTION public.lex_storage_path_is_valid(object_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    object_name IS NOT NULL
    AND object_name !~ '\.\.'
    AND array_length(string_to_array(object_name, '/'), 1) >= 3
    AND public.lex_storage_workspace_prefix(object_name) ~ '^[a-zA-Z0-9_-]+$'
$$;

-- Remover policies antigas com mesmo nome (idempotente em re-deploy manual)
DROP POLICY IF EXISTS documents_authenticated_select ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_insert ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_update ON storage.objects;
DROP POLICY IF EXISTS documents_authenticated_delete ON storage.objects;

-- SELECT / download / list (listagem filtrada pelo prefixo do workspace)
CREATE POLICY documents_authenticated_select
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.lex_storage_path_is_valid(name)
  AND public.lex_storage_user_owns_prefix(name)
);

-- INSERT / upload (só no prefixo do próprio workspace)
CREATE POLICY documents_authenticated_insert
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND public.lex_storage_path_is_valid(name)
  AND public.lex_storage_user_owns_prefix(name)
);

-- UPDATE (overwrite) — mesma regra que INSERT
CREATE POLICY documents_authenticated_update
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.lex_storage_path_is_valid(name)
  AND public.lex_storage_user_owns_prefix(name)
)
WITH CHECK (
  bucket_id = 'documents'
  AND public.lex_storage_path_is_valid(name)
  AND public.lex_storage_user_owns_prefix(name)
);

-- DELETE — membro do workspace (ajuste fino por role no app; Storage não conhece OWNER/LAWYER)
CREATE POLICY documents_authenticated_delete
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND public.lex_storage_path_is_valid(name)
  AND public.lex_storage_user_owns_prefix(name)
);

-- Nenhuma policy para role `anon` no bucket documents (acesso negado por padrão).
