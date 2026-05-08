# Auditoria de Modelagem de Dados — Projeto Lex

## 1. Integridade e Estrutura

### 1.1 Duplicação de Entidades de Pesquisa (Dívida Técnica)
- **Evidência:** Coexistência de `LegalSource` (legado) e `LegalNorm` (novo motor canônico).
- **Problema:** O `schema.prisma` mantém duas tabelas para armazenar legislação e jurisprudência. 
  - `LegalSource`: Simples, usada pelo `hybrid-retriever.ts` (Geral).
  - `LegalNorm`: Complexa, versionada, usada pelo `retrieveLegalContext` (Legal).
- **Impacto:** Inconsistência de dados. Uma norma pode estar atualizada em `LegalNorm` mas desatualizada ou ausente em `LegalSource`. Dificulta a manutenção e aumenta o custo de armazenamento.

### 1.2 Ambiguidade entre `Process` e `Case`
- **Evidência:** Tabelas `Process` (Linha 184) e `Case` (Linha 938).
- **Problema:** 
  - `Process`: Foca em metadados judiciais (número, vara, tribunal).
  - `Case`: Foca no workflow de IA (fatos, pedidos, riscos, drafts).
- **Impacto:** Embora pareçam complementares, a separação física obriga joins complexos ou redundância de dados. Um "Caso" no Lex deveria ser uma extensão de um "Processo", ou vice-versa. Atualmente, a relação entre eles é implícita ou inexistente no schema.

---

## 2. Flexibilidade vs. Rigidez

### 2.1 Uso Excessivo de tipos `Json`
- **Evidência:** `aiMetaJson`, `contentJson`, `metadataJson`, `onboardingJson`, `hierarchyJson`, `metricsJson`.
- **Problema:** O uso indiscriminado de campos JSON esconde a estrutura de dados do Prisma e do sistema de tipos do TypeScript. 
- **Impacto:** Impossibilidade de realizar queries complexas ou agregações eficientes via SQL sobre esses dados. Dificulta a evolução do schema via migrations controladas.

### 2.2 Enums Gigantes
- **Evidência:** `NormKind` possui 23 variantes; `LegalLayer` possui 6; `CaseStatus` possui 8.
- **Problema:** Enums no Postgres são difíceis de alterar em migrations (requerem `ALTER TYPE ... ADD VALUE`).
- **Impacto:** Travamento de deploys e risco de inconsistência se o código TypeScript e o DB saírem de sincronia.

---

## 3. Performance e Escalabilidade

### 3.1 Índices Multi-tenant
- **Ponto Positivo:** O uso de `@@index([workspaceId])` está bem disseminado, garantindo que queries filtradas por tenant sejam eficientes.
- **Ponto Negativo:** Algumas tabelas de alta cardinalidade, como `DocumentChunk`, possuem índices em `contentHash` e `documentId`, mas não um índice composto `(workspaceId, contentHash)`, o que poderia otimizar o dedupe por workspace.

### 3.2 Estratégias de Deleção (Cascade)
- **Ponto Positivo:** A maioria das relações usa `onDelete: Cascade`.
- **Risco:** A deleção de um `Workspace` disparará uma avalanche de deletes em ~20 tabelas relacionadas. Em workspaces grandes (milhares de documentos), isso pode travar o banco de dados por minutos.
- **Sugestão:** Implementar "Soft Delete" para `Workspace` ou deleção assíncrona via Inngest.
