# RESUMO EXECUTIVO — Auditoria Técnica Lex

## Panorama Geral
O projeto Lex possui uma fundação técnica extremamente ambiciosa e utiliza tecnologias de ponta (Next.js 15, Inngest, Qdrant Hybrid Search). No entanto, o estado atual é de um **MVP fragmentado**, com riscos críticos de segurança e performance que impedem o lançamento comercial imediato.

---

## Top 10 Problemas Críticos

| ID | Categoria | Descrição | Impacto |
|---|---|---|---|
| 01 | **Segurança** | Endpoint Inngest público sem validação obrigatória de assinatura. | Crítico |
| 02 | **Segurança** | Vazamento potencial de segredos e PII em logs (JSON.stringify). | Crítico |
| 03 | **Performance** | Waterfalls de queries sequenciais em rotas críticas (Search/Chat). | Alto |
| 04 | **Performance** | Uso de `ILIKE` em tabelas de grande volume (Sequential Scan). | Alto |
| 05 | **Busca indexada** | Inconsistência entre dois motores de busca (Geral vs Legal). | Alto |
| 06 | **Segurança** | Deleção de vetores no Qdrant sem filtro de tenant (`workspaceId`). | Alto |
| 07 | **UX** | Funcionalidades "fantasma" (PJe/e-SAJ) prometidas mas não implementadas. | Alto |
| 08 | **Modelagem** | Redundância maciça entre `LegalSource` e `LegalNorm`. | Médio |
| 09 | **Busca indexada** | Corpus jurídico nacional insuficiente/vazio para uso real. | Médio |
| 10 | **UX** | Exposição de jargão técnico (tokens, chunks) para o usuário final. | Médio |

---

## Plano de Ação (Prioridades)

### 1. Quick Wins (Impacto Imediato / Baixo Esforço)
- Configurar `INNGEST_SIGNING_KEY` e mascarar chaves sensíveis no Logger.
- Envolver queries de busca em `Promise.all` para reduzir latência.
- Atualizar a UI do Cockpit para refletir o estado real das integrações ("Coming Soon").

### 2. Estabilização (Próximas 2 semanas)
- Unificar o retrieval na tabela `LegalNorm` e remover `LegalSource`.
- Migrar buscas `ILIKE` para Full-Text Search no Postgres.
- Implementar cache Redis no orquestrador de busca geral.

### 3. Preparação para Onboarding (Blockers Comerciais)
- Ingestão massiva da legislação federal básica.
- Implementação de um guia de "Primeiro Processo" para novos usuários.
- Refatoração da nomenclatura para alinhar "Caso" vs "Processo" em toda a stack.

---

## Conclusão Brutal
O Lex hoje é uma excelente demonstração de engenharia de busca indexada, mas uma **ferramenta jurídica frágil**. A prioridade deve ser consolidar o que já existe (unificar a busca, limpar a dívida técnica) e garantir a segurança do multi-tenancy antes de buscar novos usuários.
