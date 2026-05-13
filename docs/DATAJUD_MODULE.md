# Modulo DataJud e Processos Judiciais

O modulo de Processos Judiciais usa DataJud como fonte publica ativa para capa processual, metadados e movimentacoes. Ele nao substitui intimacao oficial, autos completos, peticionamento, MNI ou Escritorio Digital.

## Configuracao

- `DATAJUD_API_KEY`: chave publica/credencial DataJud no servidor.
- `DATAJUD_DEFAULT_ALIAS`: fallback tecnico quando o CNJ nao resolve tribunal.
- `DATAJUD_PROVIDER_MODE`: `live`, `mock` ou `off`.
- `DATAJUD_SYNC_DAILY_ENABLED`: habilita sync automatico.
- `DATAJUD_SYNC_DAILY_HOUR`: hora UTC em que o sync diario roda.

O usuario final nunca ve API key, endpoint, alias ou nome de variavel. A UI mostra apenas estados operacionais: ativo, pendente, tribunal identificado, selecione o tribunal ou desativado.

## Fluxo de importacao

1. Usuario informa CNJ.
2. O Lex valida os 20 digitos e o digito verificador.
3. O resolver extrai segmento/tribunal e consulta a registry oficial de aliases.
4. O client DataJud executa `_search` no alias resolvido.
5. O normalizer persiste capa e movimentacoes em `LegalProcess` e `LegalProcessMovement`.
6. Um `Process` legado e um `ChatThread` sao garantidos para preservar `/processos`, documentos, chat e pecas.

## Dados persistidos

- Capa: CNJ, tribunal, ramo, classe, assuntos, orgao julgador, sistema, formato, sigilo e ultima atualizacao.
- Movimentacoes: codigo, nome, data/hora, categoria, hash estavel, complementos e raw JSON.
- Logs: origem do sync, status, erro e contagem.
- Alertas: novas movimentacoes, falhas e sinais operacionais.

## Limitacoes reais

DataJud pode atrasar, ficar indisponivel por tribunal e nao entrega autos completos. Prazos, intimacoes e documentos oficiais precisam de conferencia humana em fonte oficial.
