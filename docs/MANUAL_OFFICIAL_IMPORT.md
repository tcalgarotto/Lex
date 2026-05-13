# Importação Manual de Fonte Oficial

Quando não há API pública oficial, o Lex oferece uma ponte segura: o advogado obtém o conteúdo na fonte oficial e registra no processo.

## Entradas

- Texto colado de intimação, publicação ou movimentação.
- Documento já obtido pelo advogado e anexado ao processo.
- Datas de publicação, recebimento, leitura e revisão.
- Fonte: Escritório Digital, Domicílio Judicial, DJEN, diário oficial, tribunal ou outra fonte oficial.

## Saídas

- `OfficialCommunication`.
- Registro em `Activity`.
- Evento na timeline do processo.
- Alerta `LegalProcessAlert` quando houver `LegalProcess`.

## Guardrail

Todo registro entra como revisão humana. O Lex não calcula prazo final automaticamente nesta fase.
