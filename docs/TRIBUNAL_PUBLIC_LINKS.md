# Links Públicos de Tribunais

O Lex gera links profundos ou instruções de abertura assistida para fontes oficiais. Quando a URL pública não é estável, a UI mostra orientação em vez de inventar automação.

## Regras

- Preferir DataJud para metadados automáticos.
- Abrir portal oficial em nova aba.
- Não contornar captcha.
- Não simular sessão autenticada.
- Não baixar autos se houver senha, certificado ou restrição.

## Implementação

A função `buildCourtPublicQueryUrl` fica em `src/lib/court-links`. Ela tenta montar link por tribunal/sistema conhecido e retorna instrução manual quando não houver mapeamento confiável.
