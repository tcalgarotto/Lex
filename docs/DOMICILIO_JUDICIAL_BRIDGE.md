# Domicílio Judicial Bridge

O Domicílio Judicial Eletrônico é oficial, mas acesso automatizado depende de habilitação/credencial oficial. No Lex, a primeira versão é abertura assistida e import manual.

## Fluxo

1. Advogado abre o Domicílio Judicial no portal oficial.
2. Lê ou baixa a comunicação.
3. Registra no Lex como citação, intimação, ofício, audiência ou outro.
4. Lex cria `OfficialCommunication` com status `NEEDS_REVIEW`.
5. Se houver processo DataJud vinculado, Lex cria alerta de revisão.

## Limite jurídico

O Lex sugere revisão e organização. Não confirma ciência oficial nem calcula prazo final automaticamente.
