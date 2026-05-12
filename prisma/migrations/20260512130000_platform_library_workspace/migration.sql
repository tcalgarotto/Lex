-- Workspace fixo para catálogo Lex (SHARED_*), visível a todos os tenants na Biblioteca.
-- Idempotente: não duplica se o slug já existir (ex.: criado por script).

INSERT INTO "Workspace" ("id", "name", "slug", "onboardingCompleted", "createdAt", "updatedAt")
SELECT
  substring(replace(gen_random_uuid()::text, '-', ''), 1, 25),
  'Lex — Catálogo global',
  'lex-platform-catalog',
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "Workspace" WHERE "slug" = 'lex-platform-catalog'
);
