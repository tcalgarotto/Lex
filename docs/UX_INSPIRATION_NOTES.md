# UX Inspiration Notes — Lex

> Anotações rápidas de referências e padrões de UX para orientar o acabamento do Lex.
> Última atualização: 2026-05-09.

## 1. Objetivo

Padronizar linguagem e padrões visuais para que o Lex pareça **produto SaaS jurídico** e oriente o advogado em cada passo.

## 2. Princípios de copy (produto jurídico)

- Preferir termos do trabalho do advogado: **Caso, Processo, Documento, Peça, Pesquisa jurídica, Prova, Modelo, Revisão, Exportar**.
- Evitar termos técnicos na UX final: embeddings, vetores, sparse/dense, intent, grounding, Qdrant, jobs, tokens.
- Promessas honestas: se a base/corpus não contém uma norma, isso vira **lacuna**, não “fundamento”.

## 3. Padrões de navegação e contexto

- “Caso” é o centro: CTAs não devem tirar o usuário do caso sem opção in-place.
- Processo judicial é opcional: mostrar “Pré-processual — ainda sem número CNJ” quando aplicável.
- Separar “Processos (judiciais)” de “Processamentos (técnicos)”.

## 4. Empty states (padrão)

Cada empty state deve ter:
- título (o que falta)
- 1–2 linhas do porquê importa
- CTA principal (próxima ação real)
- CTA secundário (opcional: “ver exemplo”, “importar documento”, etc.)

## 5. Estados de confiança (Trust UX)

- Se houver score/confiança, sempre explicar o que significa e suas limitações.
- Evitar “Alta/Média/Baixa” sem contexto (risco jurídico).

## 6. Responsividade mínima

- Garantir 1366×768 e 1920×1080 sem tabs quebradas e sem CTAs fora da tela.

