---
title: Benchmark Strategy — Lex
status: reviewed
owners: [QA Lead, retrieval owner, IA owner, Legal Lead]
audience: [dev, admin]
updated: 2026-05-09
relates_to:
  - docs/governance/EXECUTION_GOVERNANCE.md
  - docs/governance/QUALITY_THRESHOLDS.md
  - docs/governance/RELEASE_GATES.md
  - docs/governance/STOP_CONDITIONS.md
  - docs/governance/EXECUTION_BUDGETS.md
  - docs/governance/ARCHITECTURE_STABILITY_POLICY.md
tier: mvp
---

# Benchmark Strategy — Lex

> **Documento canônico da estratégia de benchmark contínuo.** Define **suítes**, **gold-sets**, **cadência**, **gatilhos de regressão** e **política de atualização de baseline**. Sem benchmark, gates [`RELEASE_GATES.md`](RELEASE_GATES.md) e thresholds [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md) viram opinião.
>
> **Honestidade**: parte dos gold-sets ainda não existe formalmente publicada (apenas implícita nos scripts). Esta versão **declara** a estrutura e referencia os scripts já existentes; a **construção formal** dos gold-sets faz parte de F0/F2.

---

## 1. Princípios

1. **Benchmark é evidência**, não opinião. Mudança em retrieval/IA/embeddings/chunker exige benchmark **antes** e **depois**.
2. **Gold-set é versionado**: cada release usa snapshot conhecido; mudança no gold-set incrementa versão.
3. **Adversarial > otimista**: gold-set inclui casos difíceis e armadilhas (`F-O-10`).
4. **Reprodutível**: qualquer benchmark pode ser re-rodado por qualquer engenheiro com `pnpm <script>`.
5. **Cross-tier**: o mesmo gold-set é usado para gates MVP/Pro/Enterprise; thresholds variam (ver `QUALITY_THRESHOLDS.md`).

---

## 2. Schema de cada benchmark

| Campo | Definição |
|-------|-----------|
| `id` | identificador estável (`BM-X-NN`) |
| `nome` | nome curto |
| `objetivo` | o que mede |
| `fixture` | fonte de dados / queries / casos |
| `comando_existente` | script em `scripts/**` ou planejado |
| `metrica` | métrica medida (referência a `QUALITY_THRESHOLDS.md`) |
| `threshold` | referência a Q-x-yy |
| `owner` | papel responsável |
| `frequencia` | por release / sprint / mensal / cycle |
| `gate_relacionado` | G-id em `RELEASE_GATES.md` |
| `stop_condition_relacionada` | S-id em `STOP_CONDITIONS.md` |

---

## 3. Suíte A — Retrieval benchmark

### BM-A-01 — CF/88 gold-set

- **objetivo**: medir hits@k, MRR, cobertura por capítulo da Constituição Federal de 1988.
- **fixture**: queries reais sobre artigos da CF/88; gold-set inicial: 12 queries (no script existente). **Meta F0**: ≥ 50 queries cobrindo Título I-IX.
- **comando_existente**: `pnpm cf:retrieval:smoke` (`scripts/cf-retrieval-smoke.ts`); `pnpm corpus:audit-cf` (`scripts/cf-coverage-audit.ts`); `pnpm qa:search` (`scripts/cf-retrieval-briefing.ts`).
- **metrica**: Q-A-01 (hits@1), Q-A-02 (hits@3), Q-A-03 (hits@5), Q-A-04 (MRR).
- **threshold**: ver `QUALITY_THRESHOLDS.md` §2.
- **owner**: retrieval owner + QA Lead.
- **frequencia**: por release + benchmark cycle (B-C-03).
- **gate_relacionado**: G-50, G-53.
- **stop_condition**: S-02.

### BM-A-02 — Legislação geral gold-set

- **objetivo**: medir retrieval em códigos federais centrais (CC, CDC, CPC, CPP, CLT, CTN, CP).
- **fixture**: ≥ 60 queries (10/código), focando artigos centrais. **A construir em F0/F2.**
- **comando_existente**: `pnpm retrieval:smoke` (genérico); por código, planejado.
- **metrica**: Q-A-01..Q-A-05.
- **threshold**: ver Q-A-05 (cobertura por domínio).
- **owner**: retrieval owner + Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-51, G-52.
- **stop_condition**: S-02.

### BM-A-03 — Documentos de caso

- **objetivo**: medir retrieval sobre `Document` indexado por workspace (não corpus oficial).
- **fixture**: 5 casos sintéticos × 3 documentos cada × 5 queries por caso = **75 queries**. **A construir em F2.**
- **comando_existente**: parcial em `pnpm documents:audit` (`scripts/documents-audit.ts`).
- **metrica**: hits@5 dentro do escopo do caso; cobertura de fact extraction.
- **threshold**: alvo MVP `hits@5 ≥ 0.85`; **interim_rule**: medir baseline em F2.
- **owner**: documentos owner + retrieval owner + QA Lead.
- **frequencia**: por release que toque documentos/parsing/chunking.
- **gate_relacionado**: G-50.
- **stop_condition**: S-02 (índice por workspace).

### BM-A-04 — Biblioteca (`ApprovedLegalFoundation`)

- **objetivo**: medir retrieval/uso de fundamentos curados pelo workspace.
- **fixture**: ≥ 30 fundamentos sintéticos por workspace × 10 queries.
- **comando_existente**: planejado (não há script dedicado).
- **metrica**: % de queries que retornam ApprovedLegalFoundation pinada como top resultado quando aplicável.
- **threshold**: alvo MVP ≥ 0.80 quando query relevante.
- **owner**: memória owner + retrieval owner.
- **frequencia**: por release que toque biblioteca/library.
- **gate_relacionado**: G-50.
- **stop_condition**: indireta.

### BM-A-05 — Query vaga

- **objetivo**: comportamento do pipeline quando query é genérica ("danos morais", "direitos do consumidor").
- **fixture**: 20 queries vagas com gold "deve retornar artigo central + opções secundárias diversificadas".
- **comando_existente**: a construir.
- **metrica**: diversidade no top-5 + presença do artigo central + coverage de domínio.
- **threshold**: ≥ 70% retorna artigo central + 3 fontes diversas.
- **owner**: retrieval owner + Legal Lead.
- **frequencia**: por release retrieval.
- **gate_relacionado**: G-50.
- **stop_condition**: S-02.

### BM-A-06 — Query jurídica técnica

- **objetivo**: queries com terminologia precisa (tutela de urgência, distinguishing, modulação de efeitos).
- **fixture**: 30 queries técnicas; gold por especialista jurídico.
- **comando_existente**: a construir.
- **metrica**: hits@3 ≥ 0.85.
- **threshold**: ver Q-A-02.
- **owner**: Legal Lead + retrieval owner.
- **frequencia**: por release.
- **gate_relacionado**: G-50, G-58.
- **stop_condition**: S-02, S-03.

### BM-A-07 — Query com artigo específico

- **objetivo**: query menciona artigo (ex.: "Art. 5º, II, CF/88") → retrieval prioriza o artigo exato.
- **fixture**: 30 queries com `articleRef` explícito.
- **comando_existente**: parcialmente coberto por `cf-retrieval-smoke.ts`.
- **metrica**: top-1 com `articleRef` exato em ≥ 0.92 das queries.
- **threshold**: alvo MVP ≥ 0.92.
- **owner**: retrieval owner.
- **frequencia**: por release.
- **gate_relacionado**: G-50.
- **stop_condition**: S-02.

### BM-A-08 — Query com caso contextual

- **objetivo**: query no contexto de um caso (`caseId`) traz documentos do caso + fundamentos pinados + corpus oficial coerentes.
- **fixture**: 5 casos × 5 queries.
- **comando_existente**: a construir; UI de `/cases/[id]` faz isso ad-hoc hoje.
- **metrica**: top-5 misto coerente; nenhum chunk de outro workspace.
- **threshold**: 0% de cross-workspace; ≥ 80% relevância coerente.
- **owner**: workflow jurídico owner + retrieval owner + Security Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-50, G-58, G-19.
- **stop_condition**: S-10 (IDOR).

---

## 4. Suíte B — Legal QA benchmark (adversarial)

> Suíte que **prova ausência de hallucination**. Cada caso é um **prompt-armadilha** que tenta fazer o pipeline inventar.

### BM-B-01 — Fundamento inventado

- **objetivo**: confirmar que o pipeline **não** cria fundamento sem chunk.
- **fixture**: 30 queries cuja base correta inexiste no corpus indexado (ex.: "Lei XYZ/2024 sobre cripto-direitos") + 30 queries cujo fundamento existe.
- **comando_existente**: planejado; manual hoje.
- **metrica**: Q-B-05 (source existence) = 100%; Q-C-02 (unsupported claim) ≤ 3%.
- **threshold**: 100% das queries fictícias devem retornar lacuna; 0% inventar.
- **owner**: Legal Lead + IA owner.
- **frequencia**: por release de IA/drafting/retrieval.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-B-02 — Artigo errado

- **objetivo**: pipeline cita artigo correto da norma certa, sem trocar número.
- **fixture**: 30 queries com gold de `articleRef` exato.
- **comando_existente**: parcial (`cf-retrieval-smoke.ts` + revisão manual).
- **metrica**: Q-C-03 (wrong article rate).
- **threshold**: ≤ 4% MVP.
- **owner**: Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-B-03 — ADCT irrelevante

- **objetivo**: pipeline **não** sugere ADCT (Disposições Transitórias) fora de contexto.
- **fixture**: 30 queries onde ADCT seria atrativo lexicalmente mas inadequado.
- **comando_existente**: a construir.
- **metrica**: Q-C-04 (irrelevant ADCT rate).
- **threshold**: ≤ 5% MVP.
- **owner**: retrieval owner + Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-50.
- **stop_condition**: S-02.

### BM-B-04 — Citação truncada

- **objetivo**: trecho citado preserva sentido (não corta cláusula essencial).
- **fixture**: 20 trechos com gold "citação completa vs truncada" comparados.
- **comando_existente**: revisão manual.
- **metrica**: % de citações truncadas que distorcem sentido.
- **threshold**: ≤ 1% MVP.
- **owner**: Legal Lead.
- **frequencia**: por release de drafting/review.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-B-05 — Jurisprudência ausente

- **objetivo**: quando jurisprudência relevante **não** existe (ou adapter está em scaffold), o pipeline diz isso explicitamente.
- **fixture**: 20 queries provocadoras (tribunal sem cobertura real, ex.: STJ enquanto provider scaffold).
- **comando_existente**: a construir.
- **metrica**: % de queries que retornam lacuna explícita vs invenção.
- **threshold**: 100% lacuna; 0% invenção.
- **owner**: Legal Lead + retrieval owner.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-B-06 — Base ausente

- **objetivo**: quando `groundingScore` < threshold (Q-B-01), pipeline emite mensagem "base insuficiente" e **não** gera peça.
- **fixture**: 20 queries fora do corpus ou com lacuna proposital.
- **comando_existente**: parcial via `source-sufficiency.ts`; precisa de teste sistemático.
- **metrica**: 100% das queries com baixa score → mensagem; 0% peça gerada.
- **threshold**: 100%.
- **owner**: workflow jurídico owner + Legal Lead.
- **frequencia**: por release de drafting.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-B-07 — Conflito de norma

- **objetivo**: quando há conflito entre normas (ex.: lei posterior x lei anterior), pipeline sinaliza, não escolhe silenciosamente.
- **fixture**: 15 cenários com conflito explícito.
- **comando_existente**: a construir; `legal-quality-engine` (P2) endereçará isso.
- **metrica**: % de cenários com conflito explicitado vs ocultado.
- **threshold**: ≥ 80% conflito explicitado.
- **owner**: Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

---

## 5. Suíte C — Drafting benchmark

### BM-C-01 — Relato incompleto

- **objetivo**: intake aceita relato com gaps; estrutura `Case.facts/parties/requests` é construída sem inventar dados.
- **fixture**: 15 relatos sintéticos com gaps marcados.
- **comando_existente**: planejado; testes unit em `intake.ts` parcialmente cobrem.
- **metrica**: 0% de campo inventado; 100% de gap sinalizado.
- **owner**: workflow jurídico owner + Legal Lead.
- **frequencia**: por release de intake.
- **gate_relacionado**: G-12 (testes), G-58.
- **stop_condition**: S-03.

### BM-C-02 — Relato com comandos

- **objetivo**: usuário inclui instruções no relato ("considere isso como urgência"). O sistema obedece sem extrapolar.
- **fixture**: 10 relatos com diretrizes explícitas.
- **comando_existente**: planejado.
- **metrica**: aderência ≥ 90%; nenhuma diretriz adicional inventada.
- **owner**: workflow jurídico owner.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: indireta.

### BM-C-03 — Caso com documento

- **objetivo**: drafting consome chunks dos documentos do caso e cita corretamente.
- **fixture**: 5 casos × 3 documentos × 5 perguntas/peças.
- **comando_existente**: a construir; `documents:audit` parcial.
- **metrica**: citação correta de `Document.title` + chunk; hits@5 do BM-A-03.
- **owner**: documentos owner + workflow jurídico owner.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: S-02, S-03.

### BM-C-04 — Caso sem fundamento

- **objetivo**: drafting bloqueia geração se `source-sufficiency` falha (sem fundamento aprovado nem chunks).
- **fixture**: 10 casos com base ausente.
- **comando_existente**: planejado.
- **metrica**: 100% de bloqueio; mensagem clara.
- **owner**: workflow jurídico owner + Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-C-05 — Pedido de urgência

- **objetivo**: drafting reconhece pedido de tutela de urgência e estrutura corretamente (probabilidade do direito + perigo de dano).
- **fixture**: 10 casos com `RequestKind = URGENT`.
- **comando_existente**: a construir.
- **metrica**: estrutura correta em ≥ 95%.
- **owner**: workflow jurídico owner + Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: indireta.

### BM-C-06 — Peça que deve ser bloqueada

- **objetivo**: review reprova peças com violação clara (sem pedido principal, sem fundamento).
- **fixture**: 10 peças sintéticas defeituosas.
- **comando_existente**: tests em `review.ts`.
- **metrica**: 100% reprovadas pelo `review.ts`.
- **owner**: workflow jurídico owner + Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: S-03.

### BM-C-07 — Peça exportável

- **objetivo**: peça aprovada exporta DOCX/PDF sem erro, com Trust UX renderizado.
- **fixture**: 10 peças aprovadas.
- **comando_existente**: parcial em E2E Playwright.
- **metrica**: 100% export sucesso; tipografia OK; Trust UX presente.
- **owner**: exports owner + UX owner.
- **frequencia**: por release.
- **gate_relacionado**: G-58.
- **stop_condition**: indireta.

---

## 6. Suíte D — UX/workflow benchmark

> Mede a **jornada completa** com dados sintéticos. Cobertura mínima do smoke G-57.

### BM-D-01 — Criar caso

- **objetivo**: `/cases/new` aceita 5 campos básicos e cria `Case`.
- **fixture**: 10 casos sintéticos.
- **comando_existente**: E2E Playwright `cases.spec.ts`.
- **metrica**: 100% sucesso; tempo p50 ≤ 30 s.
- **owner**: UX owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

### BM-D-02 — Entrevista guiada

- **objetivo**: roteiro `InterviewTemplate` flui sem dead-end.
- **fixture**: 5 roteiros × 3 caminhos.
- **comando_existente**: a construir.
- **metrica**: 100% conclusão.
- **owner**: workflow jurídico owner + UX owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

### BM-D-03 — Enviar documento

- **objetivo**: upload + parsing + chunking concluem; status visível.
- **fixture**: 10 PDFs/DOCXs sintéticos.
- **comando_existente**: parcial em `documents:audit`.
- **metrica**: 100% INDEXED; tempo p95 ≤ 60 s para PDF de 10 páginas.
- **owner**: documentos owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

### BM-D-04 — Pesquisar fundamento

- **objetivo**: `/pesquisa-juridica` retorna ≥ 3 fontes citáveis com `groundingScore` válido.
- **fixture**: 20 queries sintéticas.
- **comando_existente**: parcial via `cf-retrieval-smoke`.
- **metrica**: 100% das queries com `chunks.length ≥ 3`; `groundingScore` calculado.
- **owner**: retrieval owner + UX owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

### BM-D-05 — Pinar fundamento

- **objetivo**: `ApprovedLegalFoundation` salva e aparece no caso.
- **fixture**: 10 fundamentos pinados em 5 casos.
- **comando_existente**: a construir.
- **metrica**: 100% persistência; aparece em UI.
- **owner**: memória owner + UX owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

### BM-D-06 — Gerar peça

- **objetivo**: `drafting.ts` produz minuta sem placeholder, com fundamento citado.
- **fixture**: 10 casos com base aprovada.
- **comando_existente**: tests em `drafting.ts`.
- **metrica**: 100% sem placeholder (Q-D-01); ≥ 90% fundamento aprovado (Q-D-04).
- **owner**: workflow jurídico owner + Legal Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-57, G-58.

### BM-D-07 — Revisar

- **objetivo**: `review.ts` retorna verdict; checklist 8 critérios visível.
- **fixture**: 10 peças.
- **comando_existente**: tests em `review.ts`.
- **metrica**: 100% verdict; UI renderiza checklist.
- **owner**: workflow jurídico owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

### BM-D-08 — Exportar

- **objetivo**: DOCX + PDF baixam; Trust UX renderizado.
- **fixture**: 10 peças aprovadas.
- **comando_existente**: parcial em E2E.
- **metrica**: 100% export sucesso.
- **owner**: exports owner.
- **frequencia**: por release.
- **gate_relacionado**: G-57.

---

## 7. Suíte E — Security benchmark

### BM-E-01 — IDOR (Insecure Direct Object Reference)

- **objetivo**: usuário do workspace A **não** acessa recurso do workspace B (caso/documento/peça/integração).
- **fixture**: 10 cenários cross-workspace (GET/PUT/DELETE em recurso de outro workspace).
- **comando_existente**: a construir; planejado em F0/F4.
- **metrica**: 100% retornam 401/403 (ou 404 com info-leak controlado).
- **owner**: Security Lead.
- **frequencia**: por release que toque APIs/auth/RLS.
- **gate_relacionado**: G-19, G-21.
- **stop_condition**: S-10.

### BM-E-02 — Workspace ID scoping

- **objetivo**: toda query Prisma filtra por `workspaceId` quando aplicável.
- **fixture**: análise estática em PRs + testes runtime para ≥ 30 rotas críticas.
- **comando_existente**: planejado.
- **metrica**: 0 queries críticas sem `workspaceId` no diff.
- **owner**: Security Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-19.
- **stop_condition**: S-10.

### BM-E-03 — Admin gating server-side

- **objetivo**: rotas de admin/observability/jobs respondem 403 sem permissão `OWNER`.
- **fixture**: 10 rotas administrativas testadas com role `LAWYER`/`ASSISTANT`/`CLIENT`.
- **comando_existente**: a construir; alguns E2E.
- **metrica**: 100% bloqueio.
- **owner**: Security Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-19, G-22 (`F-O-14`).
- **stop_condition**: S-13.

### BM-E-04 — Logs PII

- **objetivo**: logs novos em produção não vazam PII (CPF, e-mail, telefone, número de processo completo se aplicável).
- **fixture**: amostra de logs ≥ 100 entradas via Langfuse + filtro regex.
- **comando_existente**: planejado; `src/lib/format/pii.ts` é o helper de redação.
- **metrica**: 0 PII em amostra.
- **owner**: LGPD owner + observabilidade owner.
- **frequencia**: por release que toque logger/observability.
- **gate_relacionado**: G-18.
- **stop_condition**: S-11.

### BM-E-05 — Export cross-tenant

- **objetivo**: export de DOCX/PDF nunca contém dado de outro workspace.
- **fixture**: 10 cenários export com isca cross-tenant.
- **comando_existente**: a construir.
- **metrica**: 0 vazamento.
- **owner**: exports owner + Security Lead.
- **frequencia**: por release que toque export.
- **gate_relacionado**: G-19.
- **stop_condition**: S-10.

### BM-E-06 — Storage unauthorized

- **objetivo**: bucket `documents` (RLS por workspace) bloqueia acesso direto sem token válido.
- **fixture**: 10 tentativas de download direto via URL absoluta.
- **comando_existente**: a construir.
- **metrica**: 100% bloqueio.
- **owner**: Security Lead.
- **frequencia**: por release.
- **gate_relacionado**: G-19.
- **stop_condition**: S-10.

---

## 8. Suíte F — Cost / Performance benchmark

### BM-F-01 — Latência p95

- **objetivo**: medir p50/p95 de retrieval, drafting, export.
- **fixture**: ≥ 500 traces em janela 7 dias.
- **comando_existente**: log + Langfuse; planejado dashboard.
- **metrica**: Q-F-01..Q-F-04.
- **threshold**: ver `QUALITY_THRESHOLDS.md` §7.
- **owner**: observabilidade owner + retrieval owner + IA owner.
- **frequencia**: por release + janela contínua.
- **gate_relacionado**: G-72.
- **stop_condition**: S-21.

### BM-F-02 — Custo por query

- **objetivo**: custo médio por chamada `retrieveLegalContext` + LLM se houver síntese.
- **fixture**: agregação por dia/workspace em janela 7 dias.
- **comando_existente**: planejado (Langfuse cost).
- **metrica**: Q-G-01.
- **threshold**: ver `QUALITY_THRESHOLDS.md` §8.
- **owner**: IA owner.
- **frequencia**: contínuo.
- **gate_relacionado**: G-73.
- **stop_condition**: S-05.

### BM-F-03 — Custo por peça

- **objetivo**: custo médio por geração + review + export.
- **fixture**: agregação por draftId.
- **comando_existente**: planejado.
- **metrica**: Q-G-02.
- **threshold**: ver §8.
- **owner**: IA owner.
- **frequencia**: contínuo.
- **gate_relacionado**: G-73.
- **stop_condition**: S-05.

### BM-F-04 — Spike detection

- **objetivo**: detectar spike de custo > 2× baseline em 24 h.
- **fixture**: agregação contínua por workspace.
- **comando_existente**: planejado.
- **metrica**: Q-G-05.
- **threshold**: spike ≤ 2× MVP.
- **owner**: IA owner + CTO.
- **frequencia**: contínuo.
- **gate_relacionado**: G-73.
- **stop_condition**: S-05.

### BM-F-05 — Fallback rate

- **objetivo**: % de queries com `fallbackFlags` populado.
- **fixture**: log contínuo.
- **comando_existente**: existe (estruturado em retrieval).
- **metrica**: Q-A-07.
- **threshold**: ver §2 (≤ 8% MVP).
- **owner**: retrieval owner + observabilidade owner.
- **frequencia**: contínuo.
- **gate_relacionado**: G-71.
- **stop_condition**: S-04.

---

## 9. Gold-set mínimo inicial (entrega F0)

> Construção formal dos gold-sets é parte de F0. Esta versão **declara o conteúdo mínimo** de cada gold-set; sem ele, gates Tier-S não podem ser enforced.

| Gold-set | Conteúdo mínimo (F0) | Donos da curadoria |
|----------|----------------------|--------------------|
| `gold-cf88-v1` | ≥ 50 queries cobrindo CF/88 Títulos I-IX, com gold por query (URN+articleRef) | retrieval owner + Legal Lead |
| `gold-codigos-v1` | ≥ 60 queries (10/código): CC, CDC, CPC, CPP, CLT, CTN | retrieval owner + Legal Lead |
| `gold-jurisprudencia-v1` | ≥ 30 súmulas STF/STJ/TST com URN | Legal Lead |
| `gold-adversarial-v1` | ≥ 50 queries-armadilha (Suíte B) | Legal Lead + IA owner |
| `gold-cases-v1` | 5 casos sintéticos completos com 3 docs cada | workflow jurídico owner + UX owner |
| `gold-security-v1` | 10 cenários IDOR + 10 cenários PII + 10 cenários admin gating | Security Lead |

Cada gold-set:
- Versionado em `docs/benchmarks/<gold-set-id>.md`.
- Re-curado a cada **6 meses** (ou quando taxonomia jurídica mudar).
- Mudança no gold-set incrementa a versão (`v1 → v2`); release que muda gold-set não pode usar isso para "validar" mudança no pipeline (regra anti-trapaça).

---

## 10. Gold-set adversarial

Bloco da Suíte B + cenários extras:

- "Lei XYZ/2024 dispõe que…" (lei fictícia).
- "A jurisprudência majoritária do STJ entende que…" (sem fonte).
- "Conforme o Art. 999 do CPP…" (artigo inexistente).
- "Doutrina dominante…" (sem citação).
- "Em decisão recente, o STF…" (sem caso real).

**Critério adversarial**: pipeline **não** pode preencher essas afirmações; deve devolver lacuna ou sugestão sem fundamento citável.

---

## 11. Regression suite

> Combinação de subconjuntos das Suítes A–F que roda **a cada release** sem custo proibitivo.

| Componente | Frequência | Tempo estimado |
|------------|------------|----------------|
| BM-A-01 (CF/88) full | toda release | 5–10 min |
| BM-A-02 (códigos) subset | toda release | 5 min |
| BM-A-07 (artigo específico) | toda release | 3 min |
| BM-B-01..03 (adversarial chave) | toda release | 5 min |
| BM-C-01..02 (intake) | toda release | 3 min |
| BM-D-* completo | toda release (E2E Playwright) | 10–15 min |
| BM-E-01..03 (security crítico) | toda release | 5 min |
| BM-F-* dashboard snapshot | toda release | 1 min |
| **Total** | toda release | **30–45 min** |

Suítes maiores (BM-A-02 full, BM-A-04, BM-B-04..07, BM-C-03..07, BM-E-04..06) entram no **benchmark cycle** (B-C-03).

---

## 12. Baseline update policy

- **Quando atualizar baseline**:
  - Após release `stable` (ver `DEFINITION_OF_DONE.md` §4) **e** sem regressão por 14 dias.
  - Após mudança intencional em pipeline com benchmark aprovado.
- **Como atualizar**:
  - Snapshot em `docs/benchmarks/baselines/<YYYY-MM-DD>.md`.
  - Promover métrica de `interim` para `enforced` em `QUALITY_THRESHOLDS.md` §10.
  - Sign-off QA Lead + retrieval owner + Legal Lead.
- **Anti-trapaça**:
  - Se regressão for "aceita" (ex.: trocou modelo barato e perdeu 2% hits@5), só com RFC + assinaturas.
  - Não é permitido "ajustar baseline para parecer ok" sem RFC.

---

## 13. Benchmark cadence

| Tipo | Frequência |
|------|-----------|
| Regression suite (§11) | toda release (G-50..G-58) |
| Suíte completa A–F | benchmark cycle (B-C-03) → a cada 8 semanas |
| Suíte E (security) completa | a cada hardening cycle (B-C-04) → a cada 12 semanas |
| Adversarial expansion | trimestral (Legal Lead + IA owner) |
| Gold-set re-curadoria | semestral |

---

## 14. Dashboard futuro (planejado F1/F2)

- **Painel `/observability/benchmarks`** (admin/dev only — `F-O-14`).
- **Linhas**: cada métrica com baseline + última medição + tendência (7d/30d/90d).
- **Cores**: verde (≥ threshold MVP), amarelo (entre `interim` e MVP), vermelho (< `interim`).
- **Alertas**: webhook para Slack/Discord quando regressão > banda.
- **Histórico**: snapshot em `docs/benchmarks/snapshots/` versionado.

---

## 15. Como aplicar este doc

1. **Hoje**: scripts existentes (cf-retrieval-smoke, retrieval-smoke, cf-coverage-audit, cf-semantic-validate, qa-production, qa:retrieval:domains, documents-audit) são a **regression suite v0**; usar como gate G-50..G-58.
2. **F0**: construir gold-sets formais (§9); publicar baselines iniciais.
3. **F1**: instrumentar dashboard (§14); promover primeiras métricas de `interim` → `enforced`.
4. **F2**: expandir Suíte B/C/E para cobertura completa.
5. **A cada release**: rodar regression suite; bloquear promote se algum BM-*-* aplicável estiver vermelho.

---

## 16. Override

Override de threshold em benchmark exige RFC + assinaturas conforme escopo:

- A: retrieval owner + QA Lead.
- B: Legal Lead + IA owner + QA Lead.
- C: workflow jurídico owner + Legal Lead + QA Lead.
- D: PO + UX owner + QA Lead.
- E: Security Lead + CTO + QA Lead.
- F: CTO + IA owner + observabilidade owner + QA Lead.

Override frequente (≥3/trimestre/mesma BM-*-*) dispara revisão da regra ou do gold-set.

---

## Veja também

- [`QUALITY_THRESHOLDS.md`](QUALITY_THRESHOLDS.md), [`RELEASE_GATES.md`](RELEASE_GATES.md), [`STOP_CONDITIONS.md`](STOP_CONDITIONS.md), [`EXECUTION_BUDGETS.md`](EXECUTION_BUDGETS.md), [`ARCHITECTURE_STABILITY_POLICY.md`](ARCHITECTURE_STABILITY_POLICY.md), [`OWNER_MATRIX.md`](OWNER_MATRIX.md), [`PRODUCT_SURVIVAL_MODE.md`](PRODUCT_SURVIVAL_MODE.md), [`TRUTH_HIERARCHY.md`](TRUTH_HIERARCHY.md), [`FORBIDDEN_ORDERINGS.md`](FORBIDDEN_ORDERINGS.md).
