# ADR — Modo temporário de pesquisa jurídica via DeepSeek API

## Status

**Accepted (provisório)** — vigente com sign-off **F-1 (2026-05-10)**. Promoção a produção pública pagante permanece **bloqueada** até owners definitivos de Legal / Security / QA e dupla revisão **Thales (PO) + Cursor (CTO interim)**.

## Contexto

- Feedback real de advogado tester indicou que a entrega comercial não pode depender, no curto prazo, da pesquisa interna quando esta ainda não atinge confiabilidade suficiente para citação e estratégia.
- O motor interno de recuperação de normas e jurisprudência permanece valioso para diagnóstico e evolução, mas **não** deve bloquear demo controlada e piloto interno (F0–Auditoria).

## Decisão

- Expor um **modo de pesquisa jurídica assistida** que usa a **DeepSeek API** como provedor temporário de geração estruturada (`LEGAL_RESEARCH_PROVIDER=deepseek`, variáveis `DEEPSEEK_*`).
- **Não remover** o RAG interno, **não apagar** coleções Qdrant e **não desmontar** o pipeline existente em `src/lib/retrieval/**` — apenas **isolar** o uso desse pipeline da pesquisa jurídica voltada ao usuário final enquanto o modo DeepSeek estiver ativo.
- Toda saída relevante a norma ou jurisprudência candidata permanece **não verificada** até ação humana explícita no produto (`AI_RECOMMENDED_UNVERIFIED` por padrão).

## Consequências

### Positivas

- Entrega mais rápida de valor percebido na pesquisa e recomendação de caso para demo e piloto.
- Kill-switch simples por variável de ambiente e reversão em um único PR documentado.
- Camada de segurança centralizada (avisos, ausência de número de processo, ausência de citação/fonte).

### Negativas

- Dependência de provedor externo (disponibilidade, latência, custo variável).
- Risco de **alucinação** em ementas, números de processo ou URLs — mitigado por avisos obrigatórios na UI (ver `docs/features/LEGAL_RESEARCH_DEEPSEEK_MODE.md`) e por proibição de promoção automática a fundamento aprovado.
- Dados da consulta trafegam para o provedor — implicações de confidencialidade devem constar do termo do escritório e da política interna.

## Alternativas consideradas

1. **Continuar apenas com o RAG interno** até atingir benchmark acordado — rejeitada para o prazo do piloto por bloquear feedback útil de produto.
2. **Trocar para outro provedor LLM** (OpenAI, Anthropic, etc.) — mantida como opção futura; DeepSeek escolhida por alinhamento com stack já usada no chat (`AI_CHAT_PROVIDER`) e custo/latência.
3. **Postergar qualquer pesquisa assistida** — rejeitada por não atender necessidade de demo controlada.

## Rollback

- Definir `LEGAL_RESEARCH_PROVIDER=rag` para forçar o comportamento de stub que informa indisponibilidade da pesquisa interna otimizada (sem acionar o motor real nesta lane).
- Restaurar `LEGAL_RESEARCH_PROVIDER=deepseek` quando o modo externo for novamente desejado.
- Plano operacional detalhado: `docs/plans/P0_DEEPSEEK_LEGAL_RESEARCH_MIGRATION.md`.
