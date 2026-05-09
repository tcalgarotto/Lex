# P0 Commercial Release Report — Lex

> Relatório honesto de release P0 comercial (fluxo caso-cêntrico).
> Última atualização: 2026-05-09.

## 1. Resumo do que mudou

- **F6 (parcial)**: editor/armazenamento de **roteiros de entrevista** (templates) com escopo **Escritório** e **Meu** (usuário).
  - **UI**: `/settings/roteiros` (criar a partir de modelos padrão, editar JSON, excluir).
  - **API**: `/api/interview-templates` + `/api/interview-templates/[id]` (multi-tenant por `workspaceId`, com regras de permissão por escopo).
  - **Integração no caso**: “Trocar roteiro” (entrevista guiada) lista também “Modelos salvos” e permite selecionar por `templateId` do banco.

- **F7.1–F7.3 (parcial com evidência)**: reforços no retrieval jurídico (intent → search plan → rerank explicável) e guardrails de chunking v3 (inclui Art. 208, inciso IV isolado).

- **F8/F9 (parcial)**: drafting passa a consumir somente `ApprovedLegalFoundation[]` (fontes aprovadas). Review ganhou bloqueios explícitos para ADCT irrelevante e “promessa de protocolo”.

- **F10 (parcial)**: export de **minuta do caso** em **DOCX/PDF/Markdown** via endpoint dedicado com validação obrigatória `workspaceId/caseId/draftId` + teste de integração multi-tenant.

- **F11 (parcial)**: base de **soft delete** e filtros iniciais em **Casos**.
  - **DB**: `archivedAt/deletedAt` em `Case`, `Document`, `LegalPiece` (migração aplicada).
  - **UI**: `/cases` ganhou busca simples + alternância para ver arquivados.
  - **API**: arquivar/restaurar (`POST/DELETE /api/cases/[id]/archive`) e exclusão definitiva com confirmação (`DELETE /api/cases/[id]/delete?confirm=1`) com validação por `workspaceId` e limpeza best-effort (Qdrant + Storage) de documentos vinculados.

## 2. Fluxo final (produto)

Novo caso → relato livre / entrevista guiada → estrutura editável (partes/fatos/pedidos/riscos) → documentos → pesquisa jurídica confiável → estratégia → peça → revisão → export → processo judicial (CNJ) se houver.

## 3. Telas alteradas (lista)

- `/cases/[id]` (aba “Peças” / drafts) — botões de export DOCX/PDF/MD.
- `/test-guide` — atualizado com 6 jornadas sentinela copiáveis.

## 4. Arquivos principais

- `docs/UX_FLOW_AUDIT.md`
- `docs/CASE_BRAIN.md`
- `docs/DRAFTING_REVIEW_FLOW.md`
- `docs/SECURITY_REVIEW_P0.md`
- `docs/RETRIEVAL_PIPELINE_AUDIT.md`
- `docs/DEEPINFRA_EMBEDDING_AUDIT.md`

## 5. Bugs corrigidos

- `npm test` voltava a falhar por import runtime de Prisma no provider Câmara; corrigido para type-only.
- Export de minuta do caso inexistente: agora existe `GET /api/cases/[id]/drafts/[draftId]/export`.

## 6. Riscos remanescentes

- **Segurança P0**: ver `docs/SECURITY_REVIEW_P0.md` (se checklist não estiver ✅, release não pode ser marcada READY).
- **Retrieval**: ver `docs/RETRIEVAL_PIPELINE_AUDIT.md` (QA por domínios).
- **Performance**: busca global/retrieval cold pode ser ~3s (ver `docs/UX_FLOW_AUDIT.md`).

## 7. Testes rodados (comandos + resultados)

> Não preencher sem evidência. Se não rodou, declarar explicitamente.

- `npm run lint` → **OK** (2026-05-09)
- `npm run typecheck` → **OK** (2026-05-09)
- `npx prisma generate` → **OK** (2026-05-09)
- `npm run db:migrate:deploy` → **OK** (2026-05-09)
- `npm test` → **OK** (532 tests) (2026-05-09)
- `npm run test:integration` → **OK** (33 tests) (2026-05-09)
- `npm run test:e2e` → **OK** (78 tests) (2026-05-09)
- `npm run qa:retrieval:domains` → **OK** (10/10) (2026-05-09)
- `NODE_ENV=production npm run build` → **OK** (2026-05-09)

## 8. Falhas encontradas

- (preencher com evidência)

## 9. Itens adiados

- **F11–F13**: Biblioteca real, separação Documento/Peça/Biblioteca e fluxo completo (UI) de arquivar/restaurar/excluir definitivo por entidade ainda pendentes (F11 iniciou apenas base + casos).
- **F15–F20**: Jobs em Admin (cobertura total), Pesquisa Jurídica como busca avançada com filtros completos, Dashboard final comercial, Memória opt-in multi-escopo e painel “Origem dos dados” ainda pendentes.
- **F21–F23**: auditorias completas por evidência (uploads/downloads/exports + PII/logs/perf/caches) ainda pendentes.

## 10. Status final

**Status**: NOT READY

Motivo: apesar de **todos os checks** estarem verdes nesta rodada, ainda faltam entregas grandes do P0 comercial (F11–F23) e a auditoria de superfície de segurança/performance não está completa por evidência.

## 11. Instruções para testar (manual)

Usar o roteiro de `docs/UX_FLOW_AUDIT.md` e registrar resultados aqui.

