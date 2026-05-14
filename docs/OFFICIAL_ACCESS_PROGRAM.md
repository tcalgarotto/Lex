# Official Access Program

Objetivo: evoluir o Lex de bridges assistidos para integracoes 100% reais, oficiais e autorizadas, sem scraping, sem senha de advogado, sem cookie de sessao, sem bypass de captcha e sem automacao de certificado digital.

## Guardrails

- Tokens oficiais futuros devem ser server-only, criptografados, escopados, revogaveis e auditados.
- O cliente nunca deve receber API key, token, client secret, cookie, sessao, PIN ou certificado.
- Peticionamento, intimações, ciência e prazos finais só podem ser automatizados quando houver API oficial, credencial formal, homologação e termos compatíveis.
- Consulta pública de portal com captcha, login ou certificado permanece bridge assistido.
- DataJud e Comunica PJe/DJEN público não substituem leitura do portal oficial, autos completos ou conferência humana de prazo.

## Matriz de acesso oficial

| Fonte | API pública | API autenticada | Como obter acesso | O que entrega | Status | Risco | Próximo passo |
| --- | --- | --- | --- | --- | --- | --- | --- |
| DataJud CNJ | Sim | Não necessária para metadados públicos | Chave DataJud no servidor | Capa, metadados e movimentações públicas | Ativo | Baixo | Manter aliases e limites monitorados |
| DJEN / Comunica PJe | `GET /api/v1/comunicacao` sem token | Login, inclusão, exclusão e certidões operacionais são para tribunais/credenciais oficiais | Leitura pública por `numeroProcesso`, `texto`, `siglaTribunal`, OAB, parte e datas; produção em `https://comunicaapi.pje.jus.br/api/v1` | Publicações/comunicações públicas para revisão humana | Implementável agora para leitura pública | Médio | Usar só leitura pública com rate limit, sem promessa de prazo |
| Domicílio Judicial Eletrônico | Não para expedientes | Sim, API institucional via client credentials/OAuth2 | Cadastro do CNPJ, aceite de termo, geração de client/secret, tenantId e header `On-behalf-Of` | Comunicações destinadas à instituição, ciência e logs conforme escopo | Requer credencial institucional | Alto | Criar checklist de solicitação e homologação |
| Escritório Digital / MNI 2.2.2 | Não | Sim, via MNI SOAP quando tribunal homologa/autorização CNJ | WSDL em homologação, operações MNI, dados técnicos, credenciais e aprovação | Consulta processual, avisos pendentes e teor de comunicação quando habilitado | Requer homologação | Alto | Abrir trilha institucional CNJ/tribunais |
| TJRS | API de dados abertos e consulta pública/eproc | Dependente de eproc/MNI/autorização | Consulta pública agora; integração real depende de termo/credencial TJRS | Dados abertos, consulta pública e fallback DataJud | Depende do tribunal | Médio | Priorizar pedido formal de API processual autorizada |
| TJSC | Consulta pública eproc | eproc/MNI dependem de login/perfil/autorização | Bridge assistido; automação só com convênio/credencial | Consulta manual, intimações e peticionamento pelo usuário no eproc | Bridge assistido | Médio | Solicitar posição oficial sobre API/MNI para terceiros |
| TJSP | Consulta pública e-SAJ/eproc | MNI/e-SAJ/eproc dependem de credencial/autorização | Bridge assistido; sem captcha bypass | Dados básicos públicos conforme portal oficial | Bridge assistido | Médio | Manter deep link e buscar canal oficial |
| TRF4 | Consulta pública eproc | eproc/MNI dependem de credencial e termos | Consulta pública agora; integração real depende de autorização | Consulta pública, eproc e fallback DataJud | Depende do tribunal | Médio | Priorizar por maturidade eproc/MNI |

## DJEN / Comunica PJe

Auditoria:

- `https://comunica.pje.jus.br/api` é front-end web.
- Swagger oficial: `https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0`.
- Homologação: `https://hcomunicaapi.cnj.jus.br/api/v1`.
- Produção: `https://comunicaapi.pje.jus.br/api/v1`.
- Endpoint público confirmado: `GET /api/v1/comunicacao`.
- Parâmetros públicos documentados/testados: `numeroProcesso`, `numeroOab`, `ufOab`, `nomeAdvogado`, `nomeParte`, `dataDisponibilizacaoInicio`, `dataDisponibilizacaoFim`; a API também respondeu a `siglaTribunal` e `texto`.
- Endpoint de login, inserção (`POST /api/v1/comunicacao`) e exclusão (`DELETE /api/v1/comunicacao/{id}`) ficam oficial-only.

Implementação permitida agora: leitura pública, server-side, com limite de itens e revisão humana obrigatória.

## Domicílio Judicial Eletrônico

Requisitos identificados na documentação PDPJ:

- A API institucional existe para pessoas jurídicas/órgãos consumirem comunicações processuais.
- A instituição precisa estar cadastrada no Domicílio.
- A geração de credenciais API depende do CNPJ e do fluxo oficial do sistema.
- Autenticação usa `client_id`, `client_secret` e `grant_type=client_credentials`.
- Requisições exigem `On-behalf-Of` com CPF do usuário em nome de quem a operação é executada.
- É necessário obter `tenantId` via endpoint oficial.
- Consulta de comunicações aceita filtros como `dataInicio`, `dataFim`, `numeroProcesso`, `tipoComunicacao`, `assunto`, `statusCiente`, `parteInteressada`, paginação e ordenação.

Checklist de solicitação:

1. Confirmar CNPJ institucional e responsável legal.
2. Realizar cadastro oficial no Domicílio.
3. Aceitar termos de uso e política de privacidade.
4. Gerar client/secret pelo fluxo oficial.
5. Definir usuários autorizados para `On-behalf-Of`.
6. Registrar escopos permitidos.
7. Homologar chamadas sem dados reais de cliente.
8. Ativar audit log, rotação e revogação antes de produção.

## Escritório Digital / MNI

O Escritório Digital consome sistemas dos tribunais via MNI 2.2.2. Para integração, a documentação do CNJ exige:

- Implementar `consultarAvisosPendentes`, `consultarTeorComunicacao` e `consultarProcesso`.
- Disponibilizar endpoint SOAP via WSDL do MNI.
- Enviar ao CNJ WSDL de homologação, unidade judiciária, códigos J/TR, responsável técnico, URL e versão de produção e credenciais de homologação.
- Liberar acesso externo à instância MNI de homologação.
- Retornar dados de teste para validação.
- Receber credenciais de homologação e depois aprovação/autorização pública.

Separação funcional:

- Consulta processual: possível via MNI autorizado.
- Peticionamento: não confirmado como API pública para terceiro SaaS; manter oficial-only.
- Intimações/avisos: possível via `consultarAvisosPendentes` e `consultarTeorComunicacao` quando autorizado.
- Prazos: não calcular prazo final sem fonte oficial e regra validada.
- Compartilhamento: depende do desenho do Escritório Digital e autorização institucional.

## Tribunais prioritários

- TJRS: possui API de dados abertos e consulta pública/eproc. Não há confirmação de API processual SaaS ampla para automação; classificar como depende do tribunal.
- TJSC: eproc com consulta, manuais e fluxos para usuários externos. Automação autenticada depende de credencial/convênio; classificar como bridge assistido.
- TJSP: consulta pública e-SAJ/eproc; automação pode envolver captcha/login e não deve ser feita sem canal oficial; classificar como bridge assistido.
- TRF4: eproc, termos publicados e histórico MNI/eproc; bom candidato para priorização institucional, mas ainda depende de autorização.

## Prioridade recomendada

1. DataJud: manter produção.
2. DJEN/Comunica PJe público: ativar leitura pública controlada para publicações.
3. Domicílio Judicial: preparar solicitação institucional e cofre de credenciais.
4. TRF4/TJRS: iniciar contato por maturidade eproc/DataJud.
5. TJSC/TJSP: manter bridge assistido enquanto não houver autorização formal.
