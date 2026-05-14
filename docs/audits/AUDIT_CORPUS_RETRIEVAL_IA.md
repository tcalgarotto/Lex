# Auditoria de busca indexada e IA — Projeto Lex

## 1. Qualidade da Recuperação (Retrieval)

### 1.1 Duplicidade de Motores de Busca
- **Evidência:** `src/lib/retrieval/hybrid-retriever.ts` (Geral) vs `src/lib/retrieval/legal/index.ts` (Legal).
- **Problema:** O sistema possui dois fluxos de retrieval totalmente divergentes. O motor "Legal" é avançado (reescrita, expansão por grafo, rerank), enquanto o motor "Geral" é básico e usa `ILIKE` no Postgres.
- **Impacto:** O chat e as ferramentas de estratégia podem dar respostas contraditórias ou ignorar documentos dependendo de qual motor é acionado.

### 1.2 Deduplicação Frágil
- **Evidência:** `src/lib/retrieval/hybrid-retriever.ts`, função `mergeHotAndDedupe`.
- **Problema:** A deduplicação é feita via hash SHA256 dos primeiros 1000 caracteres do chunk.
- **Risco:** Chunks que possuem cabeçalhos diferentes (ex.: metadados de página no início) mas conteúdo idêntico serão tratados como únicos, poluindo o contexto do LLM e desperdiçando tokens.
- **Correção:** Utilizar hashes de conteúdo normalizado (removendo espaços e metadados repetitivos) ou deduplicação semântica.

---

## 2. Processamento de Texto (Chunking)

### 2.1 Fragmentação Semântica via Regex
- **Evidência:** `src/lib/parsers/legal-chunker.ts`.
- **Problema:** A detecção de seções ("DOS FATOS", "DOS PEDIDOS") é baseada em regex simples.
- **Risco:** Documentos com formatação não padrão ou PDFs com OCR ruidoso podem falhar na detecção de seção, resultando em chunks classificados incorretamente como `generic`.
- **Impacto:** O motor de `source-sufficiency` depende dessas tags para validar se a resposta é segura. Uma falha aqui desativa guardrails de segurança da IA.

---

## 3. Confiabilidade e Grounding

### 3.1 Suficiência de Fontes (Source Sufficiency)
- **Evidência:** `src/lib/legal/source-sufficiency.ts`.
- **Pontos Fortes:** O sistema valida se há base documental para tipos específicos de perguntas (ex.: prazos precisam de despacho).
- **Pontos Fracos:** A lógica é puramente heurística. Se um documento for classificado errado no upload, a validação de suficiência falha silenciosamente.

### 3.2 Alucinação Controlada
- **Evidência:** `src/app/api/chat/[threadId]/route.ts`.
- **Observação:** O sistema injeta uma "REGRA DURA" no prompt se as fontes forem insuficientes.
- **Risco:** LLMs potentes (GPT-4/Claude 3.5) tendem a ignorar instruções negativas se o usuário for persuasivo. A "REGRA DURA" está no final do system prompt, onde costuma ter menos peso ("recency bias").

---

## 4. Corpus Jurídico Nacional

### 4.1 "Vazio" Operacional
- **Evidência:** `prisma/schema.prisma` define um motor de corpus complexo, mas a busca híbrida (`api/search/route.ts`) e o chat mostram que a base de legislação/jurisprudência real ainda é mínima ou baseada em fixtures.
- **Impacto:** O sistema hoje funciona mais como um "Document Viewer com IA" do que como um "Assistente Jurídico Inteligente" que conhece a lei. A dependência de uploads manuais é total.

---

## 5. Observabilidade

### 5.1 Langfuse Integrado
- **Observação:** Há integração com Langfuse para rastreamento de traces.
- **Ponto de Atenção:** Não há evidência de uso de "Evaluators" automáticos para medir a precisão das citações (`[fonte:N]`). Sem isso, não há como saber se a IA está citando o trecho correto do PDF ou inventando a fonte.
- **Correção:** Implementar uma etapa de validação de citações pós-geração (Self-correction).
