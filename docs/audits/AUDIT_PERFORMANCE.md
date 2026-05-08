# Auditoria de Performance — Projeto Lex

## 1. Gargalos de Banco de Dados (Prisma/Postgres)

### 1.1 Waterfalls em Orquestradores
- **Evidência:** `src/lib/retrieval/hybrid-retriever.ts` e `src/app/api/search/route.ts`.
- **Problema:** Diversas queries ao banco são executadas de forma sequencial (await após await) em vez de paralelas.
- **Exemplo:** Em `api/search/route.ts`, as buscas em `Process`, `LegalPiece`, `Document` e `LegalSource` são feitas uma após a outra.
- **Impacto:** Latência acumulada. Se cada query levar 50ms, o usuário espera 200ms+ apenas de overhead de rede/DB, sem contar o processamento de IA.
- **Correção:** Utilizar `await Promise.all([...])` para disparar todas as queries de busca simultaneamente.

### 1.2 Uso de `ILIKE` em Tabelas Grandes
- **Evidência:** `src/lib/retrieval/hybrid-retriever.ts` utiliza `ILIKE %pattern%` na tabela `DocumentChunk`.
- **Problema:** O operador `ILIKE` com curinga no início inviabiliza o uso de índices B-Tree padrão, forçando um "Sequential Scan" em toda a tabela.
- **Impacto:** Conforme o número de documentos cresce, a CPU do banco de dados irá saturar, tornando a busca lenta e instável.
- **Correção:** Migrar para Full-Text Search (FTS) nativo do Postgres (tsvector/tsquery) ou delegar a busca textual inteiramente para o Qdrant (que já suporta busca por texto).

### 1.3 Overfetching de Dados (Select *)
- **Evidência:** Diversos pontos utilizam `findMany` ou `findFirst` sem a cláusula `select`.
- **Exemplo:** `hybrid-retriever.ts` carrega o objeto `LegalPiece` completo (incluindo o `contentJson` que pode ser massivo) apenas para exibir um preview no resultado da busca.
- **Impacto:** Desperdício de memória no Node.js e aumento do payload transferido entre o DB e o App Server.
- **Correção:** Definir explicitamente as colunas necessárias (`id`, `title`, `slug`, etc.) em todas as queries de listagem e busca.

---

## 2. Processamento Assíncrono (Inngest)

### 2.1 Fragmentação Excessiva de Steps
- **Evidência:** `src/lib/inngest/functions/ingest-document.ts` usa um `BATCH = 16`.
- **Problema:** Para um documento de 500 chunks, o Inngest executará ~62 iterações. Cada iteração gera 2 chamadas de `step.run`. Isso resulta em 124 estados persistidos pelo Inngest.
- **Impacto:** Overhead de rede entre o Inngest Cloud e a aplicação. Risco de atingir limites de "Step count" ou aumentar o custo operacional.
- **Correção:** Aumentar o tamanho do batch (ex.: 50 ou 100) e considerar o uso de `Promise.all` dentro de uma única `step.run` para upserts vetoriais.

---

## 3. RAG e IA

### 3.1 Busca Vetorial Sequencial
- **Evidência:** `src/lib/retrieval/legal/index.ts`.
- **Problema:** O loop de variantes de query (`queries.slice(0, 3)`) executa buscas `searchDense` e `searchBm25` uma por uma.
- **Impacto:** A latência do retrieval jurídico (que já é complexo) aumenta linearmente com o número de variantes.
- **Correção:** Executar as buscas de todas as variantes em paralelo.

### 3.2 Ausência de Cache em Hot Paths
- **Evidência:** Embora exista um `src/lib/retrieval/legal/cache.ts`, o retrieval geral (`hybrid-retriever.ts`) não parece utilizar cache de resultados frequentes.
- **Impacto:** Requisições idênticas para o mesmo processo disparam novamente todo o pipeline de embedding e busca.
- **Correção:** Implementar cache de 60-300 segundos no Redis para queries repetidas dentro de um mesmo `processId`.

---

## 4. Frontend (Next.js)

### 4.1 Client Components Pesados
- **Observação:** O editor de documentos (`Tiptap`) e os gráficos (`Recharts`) são componentes pesados.
- **Risco:** Se não forem carregados via `dynamic(() => import(...), { ssr: false })`, podem degradar o FCP (First Contentful Paint) e aumentar o bundle inicial.
- **Correção:** Verificar se todos os componentes pesados de UI estão utilizando code-splitting e lazy loading.
