# Free Official Court Stack

O Lex usa o máximo gratuito e oficial possível sem fingir integrações que dependem de credencial, convênio, certificado ou autorização do tribunal.

| Fonte | Gratuita? | Oficial? | API? | Login? | O que entrega | O que não entrega | Pode implementar agora? | Status no Lex |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DataJud | Sim | Sim, CNJ | Sim | API key no servidor | Capa, metadados e movimentações públicas | Autos completos, intimação oficial, peticionamento | Sim | Ativo |
| Escritório Digital | Sim para usuário | Sim, CNJ/PDPJ | Sem API pública SaaS confirmada | Sim/certificado | Acesso assistido a autos, intimações e peticionamento | Login automático, senha armazenada, sessão no Lex | Sim, como bridge | Abertura assistida |
| MNI | Sim quando autorizado | Sim | Integração institucional | Credencial oficial | Interoperabilidade formal | API pública livre para legaltech | Não sem autorização | Oficial-only |
| Domicílio Judicial | Sim para usuário | Sim, CNJ | API credenciada, não pública livre | Sim/gov.br ou credencial habilitada | Comunicações processuais | Consulta automática sem credencial, prazo final automático | Sim, como bridge | Abertura assistida |
| DJEN/PCP | Sim | Sim, CNJ | API para sistemas habilitados | Credencial CNJ Corporativo | Publicações/comunicações | API pública SaaS livre, prazo final automático | Sim, import manual/discovery | Público/manual |
| Diários oficiais | Variável | Sim quando fonte oficial | Variável | Geralmente não | Publicações públicas | Crawler massivo sem autorização | Sim, manual | Disponível/manual |
| Tribunais/PJe/eproc/e-SAJ/Projudi | Variável | Sim | Sem API pública ampla confirmada | Variável | Links e consulta manual | Scraping, captcha bypass, autos protegidos | Sim, links/bridge | Manual bridge |
| Upload/colar texto | Sim | Origem declarada pelo usuário | Não | Não | Organização de documento/comunicação obtida na fonte oficial | Garantia automática de autenticidade ou prazo | Sim | Ativo |

## Regra de produto

DataJud é o único conector automático amplo. Todo o resto entra como abertura assistida, importação manual ou oficial-only até existir OAuth, token, convênio ou credencial oficial com escopos claros.

## Guardrails

- Não armazenar senha, PIN, certificado A1/A3, cookie, sessão de tribunal ou captcha.
- Não automatizar login ou peticionamento sem caminho oficial.
- Não calcular prazo final automaticamente nesta fase.
- Toda comunicação importada manualmente fica marcada para revisão humana.
