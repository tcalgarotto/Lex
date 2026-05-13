# Painel Processual

O painel processual usa apenas dados persistidos do workspace:

- total de processos DataJud;
- alertas abertos;
- movimentacoes criadas nos ultimos 7 dias;
- erros de sincronizacao recentes;
- distribuicao por tribunal;
- distribuicao por status DataJud.

As consultas ficam em `src/lib/legal-processes/process-analytics.ts` e sao consumidas por `/processos`, `/processos/analytics`, `/dashboard` e `/api/processes/analytics`.

## Uso em beta

Este painel e operacional, nao estatistico oficial. Ele mede o que foi importado/sincronizado pelo Lex, nao o acervo completo dos tribunais.
