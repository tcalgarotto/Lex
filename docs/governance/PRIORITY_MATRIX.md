---
title: Priority Matrix — P0/P1/P2/P3/P4 + Forbidden Orderings
status: reviewed
owners: [PO, CTO]
audience: [dev, admin, investor]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/RELEASE_GATES.md
  - docs/governance/DEFINITION_OF_DONE.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/OWNER_MATRIX.md
tier: mvp
---

# Priority Matrix — Lex

> **Documento canônico de prioridade.** Define 5 tiers oficiais (P0–P4), regras de classificação testáveis, ordenamentos proibidos (forbidden orderings) e a tabela inicial de classificação de **todas** as features do Lex hoje + planejadas. Substitui qualquer escala P0/P1/P2/P3 anterior dispersa em outros documentos.

---

## 1. Princípio

A prioridade **não é opinião** — é uma **classe** atribuída por critérios objetivos. Toda feature, módulo, integração ou refactor entra na matriz com **um** tier. Mover de tier exige RFC + assinatura PO + CTO.

**Regra absoluta**: nenhum P3/P4 entra em desenvolvimento enquanto P0/P1 dependentes não atingirem `QUALITY_THRESHOLDS` (ver `RELEASE_GATES.md`).

---

## 2. Tiers oficiais

### P0 — Blocker absoluto

**Definição**: sem isso, o produto **não funciona** ou o advogado **não consegue** completar o fluxo principal sem improvisar.

**Critérios objetivos** (≥ 1 verdadeiro):

- A ausência interrompe a jornada caso → documento → pesquisa → peça → revisão → export.
- A presença errada gera **risco jurídico** (artigo inventado, citação incorreta, base ausente).
- A ausência faz o sistema parecer **protótipo** (jargão dev, dead-end, dado não persistido).
- Falha de segurança ou LGPD com risco material.
- Custo IA fora de controle por design (sem cap).

**Exemplos pertencentes a P0** (estado atual + planejado):

- Retrieval híbrido (`src/lib/retrieval/legal/`) — implementado, **estabilidade** = P0.
- Grounding score + `groundingScore` em respostas — implementado, **threshold** = P0.
- Chunking jurídico hierárquico (`legal-chunker-v2.ts`) — implementado, **regressão zero** = P0.
- Rerank (BGE-reranker-v2-m3) — implementado, **fallback graceful** = P0.
- Geração de peças (`drafting.ts`) com `drafting-guard` + `source-sufficiency` — implementado, **anti-hallucination ativo** = P0.
- Guided intake básico (`intake.ts`, `InterviewTemplate`) — parcial, **completude** = P0.
- UX principal (`/cases`, `/cases/[id]`, `/documentos`, `/pesquisa-juridica`, `/editor/[pieceId]`) — implementado, **eliminar jargão dev visível** = P0.
- Export DOCX/PDF (`pdf-lib`, `docx`) — implementado, **qualidade tipográfica** = P0.
- Fluxo Caso ↔ Processo ↔ Documento (`Case.processId`, `Document.caseId`) — implementado, **clareza ao usuário** = P0.
- Explainability mínima (Trust UX em `src/components/trust/*`) — implementado, **legibilidade jurídica** = P0.
- Biblioteca / pesquisa coerente — parcial, **eliminar confusão biblioteca/pesquisa/documentos** = P0.
- Memória contextual mínima (`ApprovedLegalFoundation`, pinned sources) — parcial, **persistência confiável** = P0.
- Filtros nas listas (casos, documentos, pesquisa) — parcial = P0.
- Estabilidade (Redis offline graceful, Qdrant timeouts, fallbacks) — implementado, **monitoramento** = P0.
- Auditoria IA mínima (`CaseTimelineEvent`, `fallbackFlags` em retrieval trace) — implementado, **completude** = P0.
- Validação normativa (norma vigente em data, URN-LEX) — implementado em data model, **uso em peça** = P0.
- Revisão jurídica (`review.ts` + checklist 8 critérios) — implementado, **gating de export** = P0.
- Multi-tenant básico (`workspaceId` scoping em queries críticas) — implementado, **cobertura completa** = P0.
- LGPD mínima (logs sem PII, `pii.ts`, retention default) — implementado, **doc + DPA** = P0.
- Performance básica (timeouts retrieval, cache LRU, Redis) — implementado, **dashboards** = P0.
- Admin gating server-side (não só esconder no menu) — pendente = P0.
- **DeepSeek Legal Research Mode (P0, temporário)** — pesquisa jurídica voltada ao usuário usa **inferência estruturada** via DeepSeek API enquanto o RAG interno é otimizado em ciclo futuro; **kill-switch** por `LEGAL_RESEARCH_PROVIDER`, `DEEPSEEK_LEGAL_RESEARCH_ENABLED` e ausência de chaves; **não** remove RAG nem Qdrant; toda saída permanece **candidata / sugestão** até ação humana (`AI_RECOMMENDED_UNVERIFIED` por padrão). Ver `docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md`.

### P1 — Core comercial

**Definição**: torna o sistema **premium** e **operacional sério** para o escritório que paga.

**Critérios objetivos** (≥ 1 verdadeiro):

- Aumenta retenção mensurável.
- Reduz dependência de outras ferramentas (concorre direto com Astrea/Legal One/CPJ).
- Cria base de dados que **alimenta** P2 (memória, BI, jurimetria).
- Torna colaboração intra-escritório real.

**Exemplos**:

- Timeline processual viva (`CaseTimelineEvent` + UI consolidada).
- Colaboração (`CaseComment`, `CaseAnnotation`, `DraftApproval`) — implementado, **UI premium** = P1.
- Workflow jurídico básico (intake → minuta → review → aprovação → export coordenado).
- Jurimetria básica interna (tempo médio por caso, peças por área, fundamentos mais usados).
- Templates vivos básicos (modelos do escritório, snippets, cláusulas reutilizáveis).
- Revisão avançada (review com checagem cruzada vs `LEGAL_QUALITY_ENGINE` planejado).
- Dashboard útil para o sócio (próxima ação, casos sem responsável, prazos, alertas).
- CRM básico (lead → caso, origem, status).
- WhatsApp básico (ingestion via `whatsappAdapter` mock → live).
- Inteligência contextual (sugestão de próximo passo no caso baseada em fase).
- Memória do escritório (opt-in, `LAWYER_MEMORY_LIVING.md` planejado).
- Analytics relevantes para o escritório (não para dev).
- Equipe + permissões com RBAC fino (`MembershipRole` já existe: OWNER/ADMIN/LAWYER/ASSISTANT/CLIENT).
- Notificações úteis (`Notification` table existe; UI a polir).
- Prazos e calendário (deadline manual + extraído de documento).

### P2 — Premium / diferencial

**Definição**: gera **moat tecnológico** e **retenção** alta. Não vende sozinho, mas é o motivo pelo qual o escritório **não troca** depois de 6 meses.

**Critérios objetivos** (≥ 1 verdadeiro):

- Depende de dados acumulados de P0/P1 (memória, gold-set, eventos).
- Diferencia o Lex de competidores não-IA.
- Reduz custo marginal por escritório à medida que o uso cresce (rede de aprendizado).
- Eleva qualidade jurídica de forma observável.

**Exemplos**:

- Legal graph + ontology (expansão de `LegalCitation`).
- Semantic memory cruzando casos do mesmo escritório.
- Lawyer brain avançado (`src/lib/lawyer-brain/*` evoluído).
- Workflow adaptativo (engine de fase processual com sugestão de próximo passo — F25 transversal).
- AI orchestration multi-model (provider routing, fallback, custo adaptativo — F28 transversal).
- Benchmarking jurídico contínuo (gold-set + drift alerting — F20 transversal).
- Quality engine avançado (detectores: incompatibilidade normativa, fundamento irrelevante, artigo fora de contexto, etc. — F21 transversal).
- Jurimetria avançada (DataJud + tribunais + tempo médio por vara/julgador).
- Reasoning pipelines (`src/lib/legal/reasoning/*` evoluído com strategy + contradiction + issue-spotting visíveis na UI).
- Reusable strategies (estratégia vencedora vira template do escritório).
- Escritório que aprende (memória + estilo + fundamentos curados — F9).
- Agentes especialistas por área (com escopo + fontes permitidas + critérios de revisão).
- Portal do cliente com IA explicadora.
- BI jurídico (F23 transversal).

### P3 — Enterprise

**Definição**: requisitos para **grandes contas** (escritórios > 30 advogados, departamentos jurídicos, contas regulatórias).

**Critérios objetivos** (≥ 1 verdadeiro):

- Exigido por contrato enterprise (SSO, audit imutável, data residency).
- Necessário para SOC2/ISO27001.
- Necessário para deploys dedicados.
- Necessário para escala multi-region.

**Exemplos**:

- RBAC avançado (custom roles, permissions granulares por caso).
- Audit logs enterprise (imutável, append-only, exportável).
- On-premise / deploy dedicado.
- Private embeddings (modelo dedicado por cliente).
- Isolated vector DB (cluster Qdrant dedicado).
- DR avançado (RPO < 1h, RTO < 4h).
- Observabilidade avançada (Datadog/Grafana, traces distribuídos).
- Queues enterprise (DLQ, replay).
- Scaling multi-region.
- Compliance (LGPD avançada, ISO 27001 readiness, SOC2 type II).
- SSO / SAML / SCIM.
- Legal hold (preservação de evidência sob ordem judicial).
- Immutable logs (WORM storage).
- Data residency (escolha de região).

### P4 — Ecossistema / expansão

**Definição**: extensões que **multiplicam** o produto **depois** que core + premium estão sólidos. **Nunca** antes.

**Critérios objetivos** (≥ 1 verdadeiro):

- Depende de tração + base instalada.
- Cria efeito de rede (terceiros enriquecem o produto).
- Aumenta superfície de ataque/regulação.
- Custo de manutenção alto (sandbox, billing terceiros, curadoria).

**Exemplos**:

- Marketplace jurídico.
- White-label / sub-tenants vendidos a fornecedores de tecnologia jurídica.
- Landing pages builder (subdomínio escritorio.lex.com.br).
- E-mail próprio + nuvem própria.
- APIs públicas para terceiros.
- Automações externas (n8n jurídico).
- Plugins (extensões de terceiros).
- Marketplace jurídico.
- Ecossistema de integrações com fornecedores brasileiros.

---

## 3. Forbidden orderings (proibições absolutas)

Resumo executivo (detalhe completo em [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md), criado na Leva 2 de F-1):

1. **Não** implementar P3/P4 antes de P0 e P1 fecharem `DoD` e atingirem `QUALITY_THRESHOLDS`.
2. **Não** abrir marketplace (P4) antes de quality engine (P2) e biblioteca/memória (P0/P1) maduras.
3. **Não** abrir landing pages builder (P4) antes de retrieval (P0) e UX comercial (P0) estáveis.
4. **Não** ativar IA avançada (P2 multi-model) antes de grounding e anti-hallucination (P0) atingirem threshold.
5. **Não** propor SSO/SAML (P3) antes de RBAC básico (P0/P1) e admin gating server-side (P0).
6. **Não** subir features novas (qualquer tier) enquanto `STOP_CONDITIONS` estiver ativa.
7. **Não** anunciar enterprise readiness sem `ENTERPRISE_GATES` verdes.
8. **Não** integrar tribunais "live" (P3) antes da camada mock estar 100% testada (P1) e da consulta DataJud pública (P2).
9. **Não** abrir API pública (P4) antes do quality engine (P2) e billing (P1) estarem prontos.
10. **Não** vender Pro/Enterprise enquanto algum P0 estiver `partial` no FEATURE_MATRIX.

**Override** exige: RFC com 3 alternativas + assinatura PO + CTO + Legal Lead + registro em `OVERRIDES_LOG.md` + revisão pós-mortem em 30 dias.

---

## 4. Tabela de classificação inicial (versão F-1; atualizada em F0)

| Feature / Módulo | Tier | Estado atual | Owner subsystem | Observação |
|------------------|------|--------------|-----------------|------------|
| Retrieval híbrido | P0 | implemented | retrieval | Threshold de qualidade em `QUALITY_THRESHOLDS` |
| Chunker jurídico v2 | P0 | implemented | chunking | Não mudar sem benchmark (X.3) |
| Embeddings BGE-M3 | P0 | implemented | embeddings | Cap de mudança em `EXECUTION_BUDGETS` |
| Rerank | P0 | implemented | rerank | Fallback graceful obrigatório |
| Grounding score | P0 | implemented | retrieval | Threshold ≥ 0.7 em ≥ 80% (alvo) |
| Anti-hallucination guard | P0 | implemented | IA | `drafting-guard.ts`, `source-sufficiency.ts` |
| Geração de peças | P0 | implemented | workflow jurídico | Sem fonte → bloqueio export |
| Review jurídico (8 critérios) | P0 | implemented | workflow jurídico | Gating de export quando reprovar |
| Export DOCX/PDF | P0 | implemented | exports | Qualidade tipográfica em P1 |
| Fluxo Caso ↔ Processo ↔ Documento | P0 | implemented | UX | Clareza ao usuário a polir |
| Guided intake | P0 | partial | workflow jurídico | Roteiros editáveis pendentes |
| UX principal | P0 | partial | UX | Eliminar jargão dev visível |
| Biblioteca / pesquisa coerente | P0 | partial | UX | Eliminar confusão biblioteca/pesquisa/documentos |
| Filtros em listas | P0 | partial | UX | Casos/documentos/pesquisa |
| Memória contextual mínima | P0 | partial | memória | `ApprovedLegalFoundation` ativo |
| Multi-tenant scoping completo | P0 | partial | segurança | Auditoria de cobertura em F0 |
| Admin gating server-side | P0 | pending | segurança | Esconder ≠ proteger |
| LGPD doc + DPA | P0 | pending | LGPD | Pacote security/ |
| Trust UX completo | P0 | implemented | UX | `src/components/trust/*` |
| Auditoria IA mínima | P0 | implemented | observabilidade | `CaseTimelineEvent`, `fallbackFlags` |
| Soft-delete casos/docs/peças | P0 | implemented | banco | Migration `20260509185000` |
| Performance básica + cache | P0 | implemented | observabilidade | `tryRedisCall`, timeouts retrieval |
| Workspace + Membership + roles 5 níveis | P0 | implemented | segurança | OWNER/ADMIN/LAWYER/ASSISTANT/CLIENT |
| Equipe (invites, members) | P1 | implemented | segurança | UI a polir |
| Colaboração (comments/annotations/approvals) | P1 | implemented | workflow jurídico | UI premium |
| Cockpit operacional | P1 | implemented | observabilidade | Foco em visão de sócio |
| Alerts (`CaseAlert`) | P1 | implemented | observabilidade | Idempotência por fingerprint OK |
| Notifications | P1 | implemented | observabilidade | UI a polir |
| Integrações tribunais (mock) | P1 | implemented | integrações | PJe/eSAJ/Projudi/eproc fixtures |
| Diário Oficial adapter | P1 | implemented | integrações | DOU + DJEs |
| Email/WhatsApp/Calendar adapters | P1 | implemented | integrações | Transport-agnostic |
| Calendário ICS | P1 | implemented | integrações | RFC-5545 nativo |
| Templates vivos básicos | P1 | partial | memória | Roteiros existentes; templates de peça pendente |
| Workflow jurídico básico | P1 | partial | workflow jurídico | Coordenação intake→export |
| Inteligência contextual (próximo passo) | P1 | partial | UX | `src/lib/dashboard/next-actions.ts` |
| Memória do escritório (opt-in) | P1 | partial | memória | Migration `office_memory` em 2026-05-09 |
| Jurimetria interna básica | P1 | planned | observabilidade | Depende de eventos consolidados |
| Dashboard sócio | P1 | partial | UX | Métricas dev → métricas operacionais |
| Prazos / Calendário no produto | P1 | planned | workflow jurídico | Adapter pronto; UI pendente |
| CRM básico | P1 | planned | CRM | — |
| WhatsApp ingestion live | P1 | planned | mobile/canais | Mock pronto; live exige secret + compliance |
| Legal graph (expansão) | P2 | partial | retrieval | `graph-expansion.ts` 1-hop |
| Semantic memory cross-cases | P2 | planned | memória | Após F9 |
| Multi-model orchestration | P2 | planned | IA | F28 transversal |
| Quality engine avançado | P2 | planned | IA | F21 transversal |
| Workflow adaptativo (engine de fase) | P2 | planned | workflow jurídico | F25 transversal |
| Benchmark contínuo | P2 | partial | benchmarks | Scripts existem; cadência pendente |
| Reasoning pipelines visíveis na UI | P2 | partial | UX | `legal/reasoning/*` ok no backend |
| BI jurídico (F23) | P2 | planned | observabilidade | Pro/Enterprise |
| Agentes especialistas por área | P2 | planned | IA | Após corpus + memória |
| Portal do cliente | P2 | planned | UX | — |
| Jurimetria avançada (DataJud) | P2 | partial | observabilidade | DataJud adapter ok |
| RBAC avançado (custom roles) | P3 | planned | segurança | Atual: 5 roles fixos |
| Audit logs imutáveis | P3 | planned | segurança | WORM/append-only |
| On-premise / deploy dedicado | P3 | planned | infra | — |
| Private embeddings | P3 | planned | embeddings | — |
| Isolated vector DB | P3 | planned | infra | Qdrant dedicado |
| DR avançado (RPO/RTO) | P3 | planned | infra | Política em F6 |
| Multi-region | P3 | planned | infra | — |
| SSO / SAML / SCIM | P3 | planned | segurança | — |
| Legal hold | P3 | planned | LGPD | — |
| Marketplace jurídico | P4 | planned | marketplace | F8 — após P2 |
| White-label | P4 | planned | infra | — |
| Landing pages builder + subdomínio | P4 | planned | UX | — |
| E-mail próprio | P4 | planned | infra | — |
| Nuvem própria | P4 | planned | infra | — |
| APIs públicas | P4 | planned | APIs | — |
| Automações externas (n8n jurídico) | P4 | planned | integrações | — |
| Plugins de terceiros | P4 | planned | marketplace | — |

---

## 5. Como aplicar este doc

- **Toda RFC nova** declara o **tier proposto**; PO e Owner principal validam.
- **Toda PR** vincula RFC e herda o tier; bot bloqueia merge se tier não está em §4 (atualização da matriz exige PR específico).
- **Toda decisão de roadmap** (`MASTER_ROADMAP.md`) cita este doc para justificar ordem.
- **Toda promessa pública** consulta este doc antes de incluir feature: `planned` não vai para landing.

---

## 6. Revisão e atualização

- Revisão **mensal** com PO + CTO + Owners afetados.
- Mudança de tier é registrada como entrada no PR + comentário "tier-change: <antes> → <depois> (motivo)".
- Tabela §4 fecha a versão F-1; versão F0 é gerada após o inventário completo + base de evidência cruzada.

---

## Veja também

- [`EXECUTION_GOVERNANCE.md`](EXECUTION_GOVERNANCE.md) — quem aprova o quê e em que ritmo.
- [`OWNER_MATRIX.md`](OWNER_MATRIX.md) — donos por subsystem.
- [`RELEASE_GATES.md`](RELEASE_GATES.md) — gates por tier.
- [`DEFINITION_OF_DONE.md`](DEFINITION_OF_DONE.md) — o que conta como "pronto".
- [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md) — gatilhos de freeze automático.
- [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md) — proibições detalhadas (Leva 2).
