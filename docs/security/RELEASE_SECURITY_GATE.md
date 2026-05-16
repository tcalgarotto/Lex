# Release Security Gate

Checklist objetiva antes de promover build para produção. **Não substitui** revisão humana nem auditoria legal.

Última atualização: 2026-05-16 (pós FASE 3.2).

---

## Pode lançar somente se

| # | Critério | Comando / evidência |
|---|----------|---------------------|
| 1 | Red team sem P0 dinâmico | `npm run security:red-team` |
| 2 | Testes unitários/integração | `npm test` |
| 3 | Lint | `npm run lint` |
| 4 | Typecheck | `npm run typecheck` |
| 5 | Redis configurado em produção | `REDIS_URL` no projeto Vercel/host |
| 6 | `REDIS_REQUIRED=true` em produção | `.env.production.example` |
| 7 | `RATE_LIMIT_FAIL_CLOSED=true` em produção | `.env.production.example` |
| 8 | `RATE_LIMIT_FAIL_OPEN_DEV` **ausente** em produção | Revisar envs Vercel |
| 9 | Policies Storage aplicadas no Supabase remoto | SQL: `supabase/storage/documents_policies.sql` no SQL Editor |
| 10 | Teste remoto anon/JWT bucket `documents` **PASSOU** | `RED_TEAM_CONFIRM_STAGING=1 npm run security:red-team:test` (arquivo `storage-policy-remote`) |
| 11 | Upload magic bytes **PASSOU** | `upload-magic-bytes.test.ts` |
| 12 | Cross-tenant A/B **PASSOU** | `cross-tenant.integration.test.ts` |
| 13 | Rate limit upload com Redis **PASSOU** | `upload-rate-limit-redis.integration.test.ts` + Redis ativo |
| 14 | Ingest tenant guard | `ingest-document-tenant.test.ts` |
| 15 | Sem `service_role` em `NEXT_PUBLIC_*` | `static-p0-patterns.test.ts` |
| 16 | Backup / rollback documentados | Runbook do time |

---

## Não pode lançar se

- Anon key **lista** ou **baixa** objetos do bucket `documents`.
- Usuário do workspace A acessa arquivo do workspace B (app ou Storage direto).
- Redis **ausente** em produção nas rotas caras (upload, IA).
- Rotas IA/upload sem rate limit efetivo.
- `SUPABASE_SERVICE_ROLE_KEY` (ou equivalente) em variável `NEXT_PUBLIC_*`.
- Policies Storage **não aplicadas** no projeto Supabase usado em produção.
- `SUPABASE_TEST_USER_*_PASSWORD` nunca foram usados para validar staging (gate #10 pendente).
- Prompt injection / RAG cross-tenant não testados quando escopo inclui IA.
- Logs ou respostas de erro expõem paths completos, nomes de ficheiros confidenciais ou conteúdo jurídico.

---

## Staging Storage (manual)

1. Abrir projeto Supabase de **staging** (não produção).
2. SQL Editor → colar e executar `supabase/storage/documents_policies.sql`.
3. Confirmar bucket `documents` **privado**.
4. Criar usuários Auth com emails das fixtures (`redteam-common-a@fixture.lex.invalid`, `redteam-common-b@fixture.lex.invalid`) e senhas de teste.
5. Definir no `.env` local (nunca commitar):
   - `RED_TEAM_CONFIRM_STAGING=1`
   - `SUPABASE_TEST_USER_A_PASSWORD` / `SUPABASE_TEST_USER_B_PASSWORD`
6. Rodar: `npm run security:red-team:staging-check` (se script existir) e `RED_TEAM_CONFIRM_STAGING=1 npm run security:red-team:test`.

---

## Status atual (preencher por release)

| Gate | Status |
|------|--------|
| security:red-team | ☐ |
| storage-policy-remote staging | ☐ NÃO EXECUTADO até passwords staging |
| upload-rate-limit-redis | ☐ |
| policies SQL aplicadas no remoto | ☐ manual |

**Release bloqueado** enquanto gate #10 ou #13 estiverem NÃO EXECUTADO ou FALHOU.
