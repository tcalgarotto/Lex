# Conectores Judiciais Oficiais

## Status beta

- DataJud Publico: ativo para metadados publicos.
- Escritorio Digital: preparado, requer autorizacao oficial.
- MNI: preparado, requer token/autorizacao oficial do tribunal.
- PJe/e-SAJ/eproc/Projudi: planejados apenas por caminho oficial.

## Regras de seguranca

O Lex nao faz scraping, nao armazena senha do advogado, nao burla captcha, MFA, PIN ou certificado digital, e nao automatiza login em portais judiciais. Qualquer conector autenticado deve usar integracao oficial, autorizacao explicita e armazenamento criptografado de token quando aplicavel.

## Modelo atual

`CourtConnection` registra o estado por workspace e provider. `CourtConnectionAuditLog` registra start/revoke e eventos futuros sem gravar segredo.

## Proximos passos

1. Definir tribunal/provedor oficial prioritario.
2. Obter contrato, homologacao ou credencial oficial.
3. Implementar adapter especifico com escopo minimo.
4. Adicionar revisao humana antes de qualquer acao processual sensivel.
