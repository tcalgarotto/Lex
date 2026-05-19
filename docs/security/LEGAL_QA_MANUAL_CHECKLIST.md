# Checklist — QA manual jurídico (pré-release)

Dados **fictícios** apenas. Marque cada item antes de promover release sensível.

| Campo | Valor |
|-------|--------|
| **Data** | 2026-05-19 |
| **Responsável** | Thales (PO) + Cursor Agent (FASE 5.7) |
| **Ambiente** | local/dev + Vercel (gate); Playwright + red-team |
| **Comando assistido** | `npm run security:legal-qa` |
| **Comando browser** | `set -a && . ./.env && set +a && npx playwright test tests/e2e/security-qa-staging.spec.ts` |
| **Logs externos** | `docs/security/EXTERNAL_LOGS_REVIEW.md` — **PASSOU** (FASE 5.6) |

---

## Resultado

| Resultado | Detalhe |
|-----------|---------|
| **Aprovado para RC** | LQA + Playwright + CE.R* + painéis externos **PASSOU** |
| **Ressalvas** | Peça minuta **PARCIAL** (409/guardas drafting); reamostrar Langfuse após tráfego real |

**Bloqueadores produção sensível:** nenhum (painéis assinados FASE 5.6).

**Não declarar sistema seguro.**

---

## Acesso e workspace

- [x] **1. Login** — auth.setup + Supabase (**PASSOU**).
- [x] **2. Workspace fake** — fixtures red-team (**PASSOU**).
- [x] **3. Troca de workspace** — POST `rt_workspace_b` → **403**; `/api/cases` sem caso Bravo (**PASSOU** Playwright WS.1–WS.2). Usuário A tem só workspace A (troca UI entre dois escritórios não aplicável).

---

## Caso e cliente

- [x] **4. Cliente fake** — LQA (**PASSOU**).
- [x] **5. Caso fake** — LQA (**PASSOU**).

---

## Documentos

- [x] **6. Upload PDF válido** — PDF mínimo `%PDF-1.4` → **200** + metadados (**PASSOU** Playwright API.5).
- [x] **7. Upload PDF falso** — **415** (**PASSOU**).
- [x] **8. Download próprio** — LQA metadados doc A (**PASSOU**).
- [x] **9. Cross-workspace** — doc B → **404** (**PASSOU**).

---

## Pesquisa e IA

- [x] **10. Pesquisa RAG** — sem Bravo (**PASSOU**).
- [x] **11. Estratégia** — caso B → **404** (**PASSOU**).
- [x] **12. Peça** — **PARCIAL** — `POST …/drafts` sem Bravo (Playwright PEÇA.1); geração completa pode retornar **409** (guardas drafting). CE.R* **PASSOU** (completion stream).
- [x] **13. Isolamento** — LQA retrieveContext (**PASSOU**).

---

## Erros e privacidade

- [x] **14. Erro compreensível** — LQA (**PASSOU**).
- [x] **15. Logs DevTools** — Playwright UI.4 + estático LQA.15 (**PASSOU**). Painéis externos: **PASSOU** — `EXTERNAL_LOGS_REVIEW.md` (Vercel, Sentry teste controlado, Langfuse smoke).

---

## Pós-teste

- [x] Fixtures red-team no DB dev/staging.
- [x] Gate em `RELEASE_SECURITY_GATE.md` e `RED_TEAM_AUDIT_REPORT.md` (FASE 5.7).

**Resultado:** ☑ **Aprovado para Release Candidate**  
☐ Bloqueado

> _Histórico resolvido em FASE 5.6:_ versões anteriores listavam painéis externos como bloqueador — **não aplicam**.

---

## Evidências

```bash
npm run security:legal-qa
npm run security:logs:review
npm run security:sample-observability-logs
set -a && . ./.env && set +a && npm run security:red-team:test
set -a && . ./.env && set +a && npx playwright test tests/e2e/security-qa-staging.spec.ts
```
