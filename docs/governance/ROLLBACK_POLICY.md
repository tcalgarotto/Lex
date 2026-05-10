---
title: Rollback Policy — Lex
status: reviewed
owners: [PO, CTO, Owners por subsystem]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/RELEASE_GATES.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/OWNER_MATRIX.md
  - docs/governance/DEFINITION_OF_DONE.md
tier: mvp
---

# Rollback Policy — Lex

> **Documento canônico da política de reverter mudanças.** Toda PR que toque um subsystem Tier-S/A entra com **plano de rollback declarado**. Toda mudança em produção tem um **playbook** correspondente abaixo.

> **Princípio**: rollback é **plan A**, não vergonha. "Vamos forçar a correção em prod" é proibido. Se rollback existe, ele **deve ser executável** sem reunião emergencial.

---

## 1. Princípios

1. **Rollback é planejado** antes do merge, não improvisado depois.
2. **Forward-only não é desculpa para schema irreversível**: migrações são `backwards-compatible` em release N (ver `DEFINITION_OF_DONE` item 03).
3. **Toggles antes de redeploy**: feature flag/env var antes de revert de código em produção quando possível.
4. **Reverter é mais barato** que correr atrás de fix em horário ruim.
5. **Pós-rollback obriga pós-mortem** em 7 dias (Tier-S) ou 14 dias (Tier-A).

---

## 2. Tipos de rollback

| Tipo | Quando usar | Tempo médio aceitável |
|------|-------------|------------------------|
| **Toggle** (env/flag) | Feature flag existe; basta desligar | < 5 min |
| **Revert deploy** (Vercel) | Build OK em release anterior; sem schema break | < 15 min |
| **Revert PR + redeploy** | Mudança específica em código; sem schema | < 30 min |
| **Revert + DB rollforward** | Migration foi forward-only; precisa de PR de reverso | < 2 h |
| **Restore from backup** | Catástrofe (corrupção, dado apagado) | RPO < 1 h, RTO < 4 h (alvo enterprise; alvo MVP: RPO 24 h, RTO 8 h) |

---

## 3. Autoridade para disparar (referenciar [`OWNER_MATRIX.md`](OWNER_MATRIX.md))

| Subsystem | Quem pode disparar **sem** consulta |
|-----------|--------------------------------------|
| arquitetura geral, deploy, infra, banco, APIs, segurança, rollback/governance | CTO |
| LGPD | Legal Lead + Security Lead |
| IA, retrieval, embeddings, chunking, rerank | Owner subsystem **ou** CTO **ou** QA Lead |
| workflow jurídico, exports, documentos, memória | Owner subsystem **ou** PO **ou** Legal Lead |
| UX | Owner subsystem **ou** PO |
| observabilidade, integrações, benchmarks | Owner subsystem **ou** CTO |
| CRM, financeiro, mobile, marketplace | Owner subsystem **ou** PO |

Em **freeze global** (ex.: S-10..S-14 disparado), apenas CTO + Security Lead disparam rollback.

---

## 4. Playbooks por subsystem

### 4.1 Peça (geração de minuta)

**Sintoma**: minutas geradas com placeholders, fundamentos inventados, drafting-guard bypass.

**Passos**:

1. **Toggle**: env `LEX_DRAFTING_ENABLED=false` (ou flag equivalente declarada na RFC) — desabilita botão "Gerar peça" no editor.
2. **Mensagem ao usuário**: banner em `/cases/[id]` "Geração temporariamente indisponível para manutenção; minutas existentes permanecem editáveis".
3. **Fallback**: editor manual segue funcional; export DOCX/PDF segue para minutas existentes.
4. **Investigação**: rodar `pnpm qa:production` + revisar logs Langfuse com `feature=drafting` últimas 24 h.
5. **Revert PR** se a causa for mudança recente em `src/lib/cases/drafting*.ts`, `drafting-guard.ts` ou prompts em `src/lib/ai/prompts/`.
6. **Re-enable** após 1 ciclo de smoke (G-50..G-58) verde + assinatura Legal Lead + IA owner.

**Tempo alvo**: toggle < 5 min; revert < 30 min; re-enable após smoke (~2 h).

### 4.2 Retrieval (pipeline híbrido)

**Sintoma**: hits@5 caindo, `groundingScore` despencando, `fallbackFlags` recorrente, latência p95 > 1.5x baseline.

**Passos**:

1. **Toggle**: env `LEX_RERANK_ENABLED=false` se rerank for suspeito; `LEX_QDRANT_HYBRID_ALPHA` ajustável; `LEX_GRAPH_EXPANSION_ENABLED=false` para desligar 1-hop.
2. **Fallback automático**: pipeline já cai para BM25-only se Qdrant offline (`fallbackFlags` populado). Confirmar que está acontecendo.
3. **Revert** da última PR em `src/lib/retrieval/legal/**` se mudança recente.
4. **Reindex**: se causa for chunking/embedding novo, considerar revert do índice (ver §4.4 e §4.5 antes).
5. **Validação**: `pnpm cf:retrieval:smoke`, `pnpm retrieval:smoke`, `pnpm cf:coverage:audit`, `pnpm legal-retrieval:domains-qa`.
6. **Re-enable** após métricas voltarem ao baseline por 24 h.

**Tempo alvo**: toggle < 5 min; revert < 30 min; reindex pode levar horas (ver §4.5).

### 4.3 Rerank

**Sintoma**: ordem dos chunks indo pior que sem rerank; latência aumentou desproporcionalmente.

**Passos**:

1. **Toggle**: `LEX_RERANK_ENABLED=false`. Pipeline volta a ordenar por RRF.
2. **A/B**: rodar smoke com e sem rerank; comparar métricas.
3. **Revert PR** se mudança recente no caller de rerank.
4. **Re-enable** quando métrica com rerank > sem rerank novamente.

**Tempo alvo**: < 10 min toggle; investigação dentro do dia.

### 4.4 Embedding (provider/model)

**Sintoma**: erro de dimensão (mudou modelo), embeddings inconsistentes, custo explodiu.

**Passos** (cuidado: trocar embedding **invalida** vetores antigos no Qdrant):

1. **Bloquear** novas ingestões: env `LEX_EMBEDDING_INGEST_ENABLED=false`.
2. **Revert PR** que mudou modelo/provider.
3. **Plano de coexistência**: se mudança parcial já indexada, manter coleção paralela (`legal-corpus-v2`) e roteamento por flag até reindex completo.
4. **Reindex completo**: `pnpm corpus:rechunk:articles` + `pnpm corpus:reindex:minimal` + `pnpm qdrant:migrate-hybrid` (cuidado: tempo + custo; coordenar janela).
5. **Re-enable ingestão**.

**Tempo alvo**: bloqueio imediato; reindex pode levar horas/dias dependendo do corpus.

### 4.5 Chunker (legal-chunker-v2)

**Sintoma**: chunks gigantes/microscópicos, parentChunkId quebrado, citações errando posição.

**Passos** (mudança de chunker invalida índice):

1. **Bloquear** ingestão: env `LEX_CHUNKING_INGEST_ENABLED=false`.
2. **Revert PR** que mudou `src/lib/corpus/legal-chunker-v2.ts` ou `normalize.ts`.
3. **Coexistência**: para corpus já indexado com chunker novo, manter coleção paralela.
4. **Rechunk**: `pnpm corpus:rechunk:articles` (corpus oficial) + reingestão de documentos do workspace afetado (`pnpm documents:audit`).
5. **Re-enable**.

**Tempo alvo**: bloqueio imediato; rechunk leva horas; impacto em workspaces ativos exige comunicação.

### 4.6 Prompt (LLM templates)

**Sintoma**: respostas IA degradaram (formato, tom, qualidade jurídica) após mudança em prompts.

**Passos**:

1. **Toggle**: env de versão de prompt (`LEX_PROMPT_VERSION=v3`) volta para versão estável.
2. **Revert PR** em `src/lib/ai/prompts/**` se necessário.
3. **Smoke**: `pnpm qa:production` + spot-check de 5 minutas.
4. **Re-enable** após ajuste + smoke verde.

**Tempo alvo**: < 5 min toggle; revert < 30 min.

### 4.7 Schema (Prisma migration)

**Sintoma**: migration falha em prod, contrato API quebra para clientes, dados inconsistentes.

**Passos**:

1. **Pause** Inngest jobs que dependam da coluna nova (`pnpm inngest:check` para enxergar).
2. **Migration de reverso**: PR `revert: <hash>` aplicando o `down` (declarado em DoD-03).
3. **Coexistência**: se a coluna foi adicionada com fallback no código, manter coluna mas reverter código que a usa.
4. **Drop em PR posterior**: nunca dropar coluna no mesmo release que reverteu o uso (regra anti-dataloss).
5. **Validar**: `pnpm db:migrate:status` (ou equivalente Prisma) + smoke G-50..G-58.

**Tempo alvo**: revert código < 30 min; revert schema < 2 h; estabilização 24 h.

### 4.8 UX (página/fluxo)

**Sintoma**: dead-end, regressão visual, jornada quebrada após release.

**Passos**:

1. **Vercel Instant Rollback**: promover deployment anterior em produção.
2. **Revert PR** em `src/app/**` ou `src/components/**`.
3. **Smoke G-57** (manual) antes de re-promover.

**Tempo alvo**: < 15 min Vercel rollback.

### 4.9 Integração externa (PJe/eSAJ/Projudi/eproc/DOU/DJEN/Email/WhatsApp/Calendar)

**Sintoma**: webhook em loop, custo explodindo, autenticação inválida.

**Passos**:

1. **Toggle adapter**: env `LEX_INTEGRATION_<NAME>_ENABLED=false`.
2. **Revert** PR no adapter.
3. **Re-enable** com fixtures verificados (`smoke-team` ou equivalente do adapter).

**Tempo alvo**: toggle < 5 min.

### 4.10 Inngest job

**Sintoma**: retry-loop, custo subindo, deduplication falhando.

**Passos**:

1. **Pausar** função no painel Inngest.
2. **Revert** PR ou desabilitar trigger.
3. **Reprocessar** a partir de checkpoint declarado.

**Tempo alvo**: pausa imediata; reprocesso depende de carga.

### 4.11 Auth/RBAC

**Sintoma**: sessão indevida, role escalation, RLS rompida.

**Passos** (gatilho **S-13** ativa freeze):

1. **Forçar logout global** (rotacionar cookie secret).
2. **Revert** PR em `src/lib/auth/**` ou middleware.
3. **Auditoria**: revisar últimas 24 h de logs de auth.
4. **Notificação LGPD** se dado tiver sido acessado indevidamente.

**Tempo alvo**: imediato.

### 4.12 Vercel deploy

**Sintoma**: build sem erro mas runtime quebra, region issue, edge config corrompido.

**Passos**:

1. **Vercel CLI**: `vercel rollback` para o último deployment estável (`vercel ls --prod`).
2. **Investigar** logs (`vercel logs --since=1h`).
3. **Re-promover** após fix com smoke verde.

**Tempo alvo**: < 10 min.

---

## 5. Estado e registro

Cada rollback gera entrada em `INCIDENT_LOG.md` (criado em F1) com:

- ID do incidente
- S-id de stop condition correlato (se houver)
- Subsystem afetado
- Tipo de rollback (toggle/revert/restore)
- Início e fim
- Quem disparou
- Pós-mortem (link)

---

## 6. Pós-mortem obrigatório

- Tier-S: 7 dias.
- Tier-A: 14 dias.
- Template em `docs/governance/POSTMORTEM_TEMPLATE.md` (criado em F1).
- Saída: ações de hardening + atualização de RFC/DoD/Stop Conditions/Rollback Policy se aplicável.

---

## 7. Anti-padrões proibidos

- "Vamos só corrigir direto em prod" → **proibido**, sempre via PR + revert se necessário.
- "Faz o redeploy, vai dar certo" → **proibido**, sem evidência de fix.
- "Reverter agora vai assustar o cliente" → **proibido**, reverter > esconder.
- "Apaga a coluna na próxima migration" → **proibido**, drop só após N+2 releases (regra anti-dataloss).
- Rollback sem entrada em `INCIDENT_LOG.md` → **proibido**.

---

## 8. Como aplicar este doc

1. **Hoje**: cada owner Tier-S confirma que entende seu playbook acima.
2. **Próximo PR Tier-S/A**: declarar plano de rollback referenciando seção (ex.: "Rollback: §4.2 — toggle `LEX_RERANK_ENABLED=false`").
3. **Próxima janela de F0/F1**: instrumentar `INCIDENT_LOG.md`, `POSTMORTEM_TEMPLATE.md`, badges de estado.

---

## 9. Override

Override (decidir **não** reverter quando regra recomenda) exige:

1. RFC com 3 alternativas e justificativa.
2. Assinaturas: PO + CTO + Owner subsystem + (Legal Lead se LGPD/qualidade jurídica; Security Lead se segurança).
3. Registro em `OVERRIDES_LOG.md`.
4. Revisão pós-mortem em 7 dias mesmo sem rollback executado.

---

## Veja também

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md), [`RELEASE_GATES.md`](RELEASE_GATES.md), [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md), [`PRIORITY_MATRIX.md`](PRIORITY_MATRIX.md), [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md) (Leva 2).
