-- Reset canônico do RAG: a tabela legacy `LegalSource` é substituída pelo
-- modelo canônico `LegalNorm` / `LegalNormVersion` / `LegalChunk` /
-- `LegalCitation`. Todo retrieval jurídico passa exclusivamente por
-- `retrieveLegalContext` em cima dessas tabelas.
--
-- Este DROP é destrutivo. Em produção a tabela tem ~11 linhas (todas DEMO).
-- Não há foreign keys que a referenciem.

DROP TABLE IF EXISTS "LegalSource";
