# Publicações Oficiais

Esta camada cobre DJEN, comunicações processuais públicas e diários oficiais. A versão atual prioriza importação manual e vínculo ao processo/caso.

## Automação

Nenhum crawler massivo foi implementado. A API PCP/DJEN documentada pelo CNJ exige credenciais do CNJ Corporativo para sistemas habilitados, portanto não é tratada como API pública livre para SaaS.

## Fluxo atual

- `/publicacoes` registra publicação por fonte, tipo, data, resumo e texto colado.
- O registro vira `OfficialCommunication`.
- O status inicial é `NEEDS_REVIEW`.
- A UI sempre orienta conferir no portal oficial.

## Próximo passo

Adicionar conectores reais apenas para fontes oficiais com endpoint público estável, termos permissivos e rate limit claro.
