# Validação final — Storage / Auth / Upload

## Estado final consolidado (2026-05-19)

| Item | Status |
|------|--------|
| Storage / Auth / Upload | **PASSOU** |
| SR.1–SR.6 | **PASSOU** |
| `security:storage:hardening-check` | **PASSOU** |
| Senhas red-team | Somente `.env` (gitignored) |

Contagem red-team completa (incl. PI.*, CE.M*): **`npm run security:red-team:test` → 100 passed, 2 skipped** (rodada 2026-05-19).

> Seções abaixo são o procedimento e histórico; resultado autoritativo = tabela acima.

---

## FASE A — SQL (Supabase ou `npm run security:storage:hardening-check`)

Arquivo: `scripts/security-audit/check-supabase-storage-hardening.sql`

| Query | Esperado |
|-------|----------|
| Q1 bucket | 1 linha, `public = false`, `file_size_limit` ≤ 52428800 (50 MB) |
| Q2 policies | Exatamente 4: `documents_authenticated_{select,insert,update,delete}` |
| Q3 legadas | 0 linhas (`*_own_workspace`) |
| Q4 função | `auth.uid()` presente; **sem** `auth.jwt() ->> 'email'` |
| Q5 permissivas | 0 linhas (`USING (true)` / `WITH CHECK (true)`) |
| Q6 anon | 0 policies `documents%` para role `anon` |
| Q7 MIME | Sem `*/*`; sem `application/msword` |

Automatizado (usa `DATABASE_URL`, não imprime secrets):

```bash
RED_TEAM_CONFIRM_STAGING=1 npm run security:storage:hardening-check
```

## FASE B/C — Código (Vitest)

```bash
npm test -- tests/security/storage-hardening-contract.test.ts
npm test -- tests/security/red-team/upload-magic-bytes.test.ts
npm run security:red-team:test
```

## FASE D — Usuários fake

| Variável | Default no código |
|----------|-------------------|
| `RED_TEAM_CONFIRM_STAGING` | `1` (gravado por setup-auth) |
| `SUPABASE_TEST_USER_A_EMAIL` | `redteam-common-a@fixture.lex.invalid` |
| `SUPABASE_TEST_USER_B_EMAIL` | `redteam-common-b@fixture.lex.invalid` |
| `SUPABASE_TEST_USER_A_PASSWORD` | gerado pelo setup-auth (não exibido) |
| `SUPABASE_TEST_USER_B_PASSWORD` | gerado pelo setup-auth (não exibido) |

Setup automatizado (Auth + `.env` + Prisma):

```bash
npm run security:red-team:setup-auth
```

- Cria usuários no **Supabase Auth** com os e-mails acima.
- Grava senhas determinísticas no `.env` (gitignored).
- Mantém usuários Prisma fixture `rt_user_common_*` com e-mail `prisma-only+{id}@fixture.lex.invalid` (FK dos testes mockados).
- Membership do Auth UUID no workspace correto para RLS Storage.

Senhas: apenas em `.env` local — nunca commitar.

## FASE E — Staging-check + remoto

Setup único (Auth + `.env` + alinhamento Membership ↔ `auth.uid()`):

```bash
npm run security:red-team:setup-auth
```

Depois:

```bash
npm run security:red-team:staging-check
npm run security:red-team:test
```

(`RED_TEAM_CONFIRM_STAGING=1` fica no `.env` após o setup-auth.)

Cenários **P0** (parar se falhar): `storage-policy-remote` SR.3/SR.4 — usuário A não lista/baixa objeto do workspace B.

## MIME no painel Supabase (manual)

Recomendado alinhado ao backend (`upload-constraints.ts` + magic bytes):

- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- `text/plain` (produto aceita TXT com validação de conteúdo)

Não incluir: `application/msword`, wildcards, `*/*`.

`application/octet-stream` no painel é **opcional** (scanners); o backend só persiste se magic bytes forem PDF/DOCX/TXT e envia `canonicalMime` no upload.

## Resultado final (2026-05-19)

Comandos executados no ambiente de desenvolvimento (fixtures falsas; senhas red-team **somente no `.env` local**, gitignored):

| Comando | Resultado |
|---------|-----------|
| `npm run security:storage:hardening-check` | **PASSOU** — bucket privado, 50 MB, 4 policies, `auth.uid()`, sem msword |
| `npm test -- tests/security/storage-hardening-contract.test.ts` | **7 passed** |
| `npm test -- tests/security/red-team/upload-magic-bytes.test.ts` | **11 passed** |
| `npm run security:red-team:staging-check` | **OK** (após `setup-auth`) |
| `npm run security:red-team:test` | **PASSOU** (app + SR.1–SR.6 remoto) |

**Storage remoto (P0):**

| ID | Resultado |
|----|-----------|
| SR.1 | anon não lista bucket |
| SR.2 | anon não baixa objeto |
| SR.3 | user A não lista workspace B |
| SR.4 | user A não baixa objeto B |
| SR.5 | user B baixa próprio objeto |
| SR.6 | erros sem vazamento marcador Bravo |

**Decisão `application/octet-stream`:** **manter no painel** (P3 / risco baixo). Backend exige magic bytes válidos e grava MIME canônico (`validate-upload-buffer.ts`); scanners podem enviar octet-stream. Não é P0.

### Histórico

- ~~`application/msword` na allowlist~~ — removido.
- `npm run security:red-team:setup-auth` — Auth + `.env` + Prisma fixture dual (`prisma-only+*` vs Auth UUID).
