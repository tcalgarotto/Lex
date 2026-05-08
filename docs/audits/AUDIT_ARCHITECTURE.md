# Auditoria de Arquitetura — Projeto Lex

## 1. Visão Geral da Stack
- **Framework:** Next.js 15 (App Router).
- **Linguagem:** TypeScript.
- **Banco de Dados:** PostgreSQL (via Prisma ORM & Supabase).
- **Busca Vetorial:** Qdrant (Hybrid Search: Dense + BM25).
- **Processamento Assíncrono:** Inngest.
- **Cache:** Redis.
- **IA/LLM:** Vercel AI SDK (OpenAI, Anthropic).

## 2. Fluxos Principais

### 2.1 Autenticação e Multi-tenancy
- **Implementação:** Supabase SSR + Next.js Middleware.
- **Mecanismo:** O middleware valida a sessão e injeta headers de segurança (CSP, HSTS).
- **Isolamento:** O `workspaceId` é a chave de isolamento principal.
- **Risco:** O middleware não valida se o usuário tem acesso ao `workspaceId` específico da requisição, apenas se está logado. O isolamento depende de filtros manuais `where: { workspaceId }` em cada query Prisma/Qdrant.

### 2.2 Ingestão de Documentos (RAG)
- **Trigger:** Upload de arquivo -> Evento Inngest `lex/document.ingest`.
- **Pipeline:** 
  1. Extração de texto (Mammoth, PDF.js, Tesseract).
  2. Chunking (Legal-specific chunker).
  3. Embedding (OpenAI/Anthropic).
  4. Indexação (Qdrant + Prisma).
- **Observação:** O texto extraído é truncado em 250k caracteres para persistência no Prisma (`extractedText`), mas o processamento de chunks usa o buffer original.

### 2.3 Retrieval (Busca Híbrida)
Existem duas implementações divergentes:
1. **`retrieveContext` (Hybrid):** Usado para contexto geral/documentos. Usa queries `ILIKE` paralelas no Postgres combinadas com busca vetorial no Qdrant via RRF (Reciprocal Rank Fusion).
2. **`retrieveLegalContext` (Enterprise):** Muito mais complexo. Inclui classificação de intenção, reescrita de query, expansão por grafo, busca BM25 no Postgres (FTS) e rerank via Cross-encoder.
- **Inconsistência:** O sistema sofre de "dupla personalidade" na busca, dependendo de qual orquestrador é chamado.

### 2.4 Legal Workflow (Cases)
- **Orquestrador:** `src/lib/cases/orchestrator.ts`.
- **Etapas:** Intake -> Research -> Drafting -> Review.
- **Estado:** O workflow é linear e persistido na tabela `Case`. Depende fortemente de `retrieveLegalContext` para fundamentação.

## 3. Componentes de Infraestrutura

### 3.1 Qdrant
- **Uso:** Armazena embeddings de documentos de usuários e do corpus jurídico nacional.
- **Namespace:** O isolamento de tenant é feito via payload metadata (`workspaceId`).

### 3.2 Inngest
- **Uso:** Gerencia background jobs (ingestão, sync de corpus, reindexação).
- **Resiliência:** Implementa retries (3x) e tratamento de erros não-recuperáveis (`NonRetriableError`).

### 3.3 Redis
- **Uso:** Cache de retrieval e rate limiting.
- **Status:** Integrado via `ioredis`.

## 4. Pontos de Atenção Imediata
1. **Fragmentação do RAG:** A coexistência de dois retrievers com lógicas totalmente diferentes cria inconsistência nos resultados para o usuário.
2. **Performance do Postgres:** O uso de `ILIKE %pattern%` em tabelas que podem crescer (como `DocumentChunk`) causará gargalos severos de CPU e IO no banco de dados.
3. **Complexidade do Schema:** O `schema.prisma` é excessivamente denso, com muitos Enums e relações que podem dificultar migrations futuras.
4. **Vazamento de Memória/Bundle:** O uso de lazy imports no Inngest (`ingest-document.ts`) é um "workaround" para limitações de build que podem esconder dependências circulares ou problemas de arquitetura.
