# Guardrails do Copiloto Processual

O Copiloto Processual gera um briefing operacional a partir de:

- capa DataJud persistida;
- ultimas movimentacoes;
- alertas abertos;
- saude processual calculada pelo Lex;
- vinculo opcional ao caso.

Ele nao consulta senha, autos completos, portal autenticado ou base externa fora do que esta persistido. A saida deve sempre lembrar que DataJud nao equivale a intimacao oficial, prazo final ou documento integral.

## Recomendacoes permitidas

- revisar nova movimentacao;
- sincronizar novamente em caso de erro;
- conferir autos oficiais antes de agir;
- vincular documentos do escritorio ao processo;
- preparar minuta para revisao humana.

## Recomendacoes proibidas

- afirmar prazo definitivo com base apenas no DataJud;
- prometer peticionamento;
- dizer que o advogado foi intimado oficialmente;
- orientar bypass de captcha/MFA/certificado;
- usar fundamento juridico sem fonte citavel aprovada.
