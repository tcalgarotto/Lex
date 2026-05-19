# Runbook — Rollback e resposta a incidentes (Lex)

**Não substitui** plano de continuidade formal. Uso operacional em staging/produção.

Última revisão: **2026-05-19**

---

## 1. Reverter deploy (Vercel)

1. Painel Vercel → projeto → **Deployments**.
2. Identificar último deployment **estável** (anterior ao incidente).
3. **⋯** → **Promote to Production** (ou Rollback, conforme UI).
4. Confirmar variáveis de ambiente inalteradas na promoção.
5. Validar: `GET /api/health` e `GET /api/ready` → 200.
6. Smoke: login, listar casos, upload PDF pequeno fake.

---

## 2. Redis indisponível (rotas caras)

Sintoma: upload/IA retornam **503** com `source: fail-closed` (comportamento esperado se `REDIS_REQUIRED` / produção).

1. Restaurar `REDIS_URL` (Upstash/Vercel KV).
2. `npm run redis:check` no ambiente com credenciais (sem colar URL no chat).
3. Se emergência: **não** habilitar `RATE_LIMIT_FAIL_OPEN_DEV` em produção.
4. Opcional temporário: reduzir tráfego desabilitando features IA (ver §3).

---

## 3. Desativar IA temporariamente

1. Vercel env: remover ou esvaziar `DEEPSEEK_API_KEY` (e demais keys de chat) → rotas IA falham com mensagem configurada.
2. Ou feature flag interna: `ENABLE_LEGAL_RETRIEVAL=false` (desliga Qdrant/corpus na health).
3. Comunicar usuários: “IA indisponível para manutenção”.
4. Reverter quando keys/Redis estáveis.

---

## 4. Vazamento de `SUPABASE_SERVICE_ROLE_KEY` (P0)

1. **Rotacionar** key no Supabase → Settings → API → service_role → reset.
2. Atualizar `SUPABASE_SERVICE_ROLE_KEY` na Vercel (Production + Preview conforme política).
3. Redeploy.
4. Revisar logs Vercel/Supabase do período de exposição.
5. Auditar Storage: listagens anômalas no bucket `documents`.
6. Considerar invalidar sessões Auth se comprometimento amplo.

---

## 5. Rotação de outros segredos

| Segredo | Onde rotacionar | Ação pós-rotação |
|---------|-----------------|------------------|
| DeepSeek / OpenAI / Anthropic | Console do provedor | Atualizar env Vercel; redeploy |
| Redis | Upstash / host | Atualizar `REDIS_URL` |
| Inngest signing | Inngest dashboard | `INNGEST_SIGNING_KEY` na Vercel |
| Supabase anon | Supabase API | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (menor impacto que service role) |

Nunca commitar valores novos no git.

---

## 6. Incidente no bucket `documents`

1. **Não** tornar bucket público como “correção”.
2. Revisar policies: `supabase/storage/documents_policies.sql`.
3. Se vazamento confirmado: identificar paths afetados; revogar acesso; rotacionar service role.
4. Bloqueio emergencial: desabilitar upload na app (deploy com flag) + revisar objetos órfãos.
5. Preservar evidências (IDs, timestamps) sem copiar conteúdo jurídico para tickets públicos.

---

## 7. Exportar logs sem vazar dados

1. Preferir IDs: `workspaceId`, `userId`, `documentId`, `requestId`.
2. Usar `scrubSecrets` / política de log do time antes de anexar JSON.
3. Não exportar `observabilityLog.payloadJson` integral para ferramentas externas sem revisão.
4. Sentry: verificar scrubbing de PII nas regras do projeto.

---

## 8. Comunicação interna

1. Canal privado (sem dados de clientes reais).
2. Classificar severidade (P0–P3).
3. Responsável: eng + owner produto.
4. Timeline: detecção → contenção → correção → verificação.
5. Registro em `docs/security/RED_TEAM_AUDIT_REPORT.md` (seção incidente) se pós-mortem formal.

---

## 9. Limpeza pós red-team (staging)

1. Usuários `redteam-common-*@fixture.lex.invalid` podem permanecer em staging.
2. Senhas de teste: rotacionar ou remover do `.env` local.
3. `RED_TEAM_CONFIRM_STAGING=1` apenas em máquinas de teste controladas.
4. Não rodar `security:red-team:seed` em produção.

---

## Referências

- `docs/security/RELEASE_SECURITY_GATE.md`
- `docs/security/STORAGE_HARDENING_VALIDATION.md`
- `docs/SUPABASE_PRODUCTION.md`
