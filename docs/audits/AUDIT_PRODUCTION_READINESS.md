# Auditoria de Produção — Prontidão do Projeto Lex

## Diagnóstico Brutal

### 1. O sistema é confiável hoje?
**NÃO.** O sistema apresenta inconsistência nos resultados de busca (dois motores diferentes), possui funcionalidades críticas "mockadas" (integrações) e uma base jurídica nacional insuficiente. Para um advogado, a confiabilidade é binária: se a lei citada não existe ou está desatualizada, o sistema perde o valor.

### 2. O que quebraria com 10 usuários simultâneos?
O banco de dados PostgreSQL provavelmente atingiria picos de CPU e exaustão de conexões. O uso de `ILIKE %pattern%` em tabelas de chunks e a execução de queries sequenciais (waterfalls) em orquestradores são gargalos imediatos.

### 3. O que quebraria com 100 uploads?
O pipeline do Inngest, embora resiliente, geraria um overhead imenso de rede e latência devido ao baixo tamanho do batch (16) e ao alto número de steps (120+ por documento grande). Além disso, o processamento de OCR síncrono pode causar timeouts em ambientes serverless com limites estritos (Vercel Hobby).

### 4. O retrieval jurídico é confiável?
**Parcialmente.** O motor `retrieveLegalContext` é tecnicamente brilhante, mas sem um processo de ingestão robusto e contínuo (o corpus está pequeno), ele é como uma Ferrari sem combustível. O motor `hybrid-retriever` (usado no chat) é rudimentar e propenso a falhas de recall.

### 5. O advogado conseguiria usar sem supervisão?
**NÃO.** O risco de alucinação, embora mitigado por guardrails de "source-sufficiency", ainda é alto. A interface vaza muitos termos técnicos que exigem explicação e o fluxo de trabalho entre "Processos" e "Casos" não é intuitivo.

### 6. Existe risco jurídico/comercial?
**SIM.** O maior risco é o advogado confiar em um score de "Confiabilidade Alta" gerado sobre uma base de dados incompleta. Comercialmente, prometer integrações com PJe/e-SAJ e entregar uma página vazia é um risco reputacional grave.

### 7. O sistema parece produto real ou demo?
No estado atual, o Lex parece um **"Technical Prototype de Luxo"**. Há muita inteligência em componentes isolados, mas falta a coesão de um produto finalizado e pronto para "venda de prateleira".

---

## Os 10 Blocker Absolutos (Prioridade Zero)

1.  **Segurança Inngest:** Garantir `INNGEST_SIGNING_KEY` em produção para evitar injeção de eventos.
2.  **Unificação da busca indexada:** Deletar o motor legado (`LegalSource`) e unificar tudo no motor canônico (`LegalNorm`).
3.  **Performance de Busca:** Substituir `ILIKE` por FTS ou busca puramente vetorial no Qdrant.
4.  **Sinceridade na UI:** Remover ou marcar como "Em breve" as integrações inexistentes no Cockpit.
5.  **Populamento do Corpus:** Ingerir pelo menos a legislação federal base (CF, CC, CPC, CP) antes de qualquer onboarding.
6.  **Higienização de Logs:** Impedir vazamento de segredos via `meta` no logger.
7.  **Isolamento Qdrant:** Adicionar `workspaceId` em todos os filtros de deleção vetorial.
8.  **Simplificação da UI:** Esconder termos como `chunks`, `embeddings` e `tokenEstimate` do usuário final.
9.  **Onboarding Guiado:** Substituir o `/test-guide` por um fluxo de "Primeiro Processo" dentro do Dashboard.
10. **Paralelização de Queries:** Resolver os waterfalls de `await` nos orquestradores de retrieval.
