# P0 Commercial Release Report — Lex

> Relatório honesto de release P0 comercial (fluxo caso-cêntrico).
> Última atualização: 2026-05-09.

## 1. Resumo do que mudou

- **F6 (parcial)**: editor/armazenamento de **roteiros de entrevista** (templates) com escopo **Escritório** e **Meu** (usuário).
  - **UI**: `/settings/roteiros` (criar a partir de modelos padrão, editar JSON, excluir).
  - **API**: `/api/interview-templates` + `/api/interview-templates/[id]` (multi-tenant por `workspaceId`, com regras de permissão por escopo).
  - **Integração no caso**: “Trocar roteiro” (entrevista guiada) lista também “Modelos salvos” e permite selecionar por `templateId` do banco.

## 2. Fluxo final (produto)

Novo caso → relato livre / entrevista guiada → estrutura editável (partes/fatos/pedidos/riscos) → documentos → pesquisa jurídica confiável → estratégia → peça → revisão → export → processo judicial (CNJ) se houver.

## 3. Telas alteradas (lista)

- (preencher)

## 4. Arquivos principais

- `docs/UX_FLOW_AUDIT.md`
- `docs/CASE_BRAIN.md`
- `docs/DRAFTING_REVIEW_FLOW.md`
- `docs/SECURITY_REVIEW_P0.md`
- `docs/RETRIEVAL_PIPELINE_AUDIT.md`
- `docs/DEEPINFRA_EMBEDDING_AUDIT.md`

## 5. Bugs corrigidos

- (preencher com evidência)

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

- Export DOCX/PDF (se ainda não implementado; confirmar com evidência)
- (preencher)

## 10. Status final

**Status**: NOT READY

Motivo: este relatório ainda não contém evidência de testes/build/e2e e checklist de segurança P0 não foi confirmado nesta atualização.

## 11. Instruções para testar (manual)

Usar o roteiro de `docs/UX_FLOW_AUDIT.md` e registrar resultados aqui.

