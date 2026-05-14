# Lex — Fontes Jurídicas Públicas, API Keys e Plano de Ingestão

> Objetivo: organizar todas as fontes jurídicas que podem alimentar o Lex, separar o que precisa de chave do que é público, e orientar o Cursor a extrair o máximo possível de valor para o corpus indexado, pesquisa jurisprudencial, strategy engine, cockpit e knowledge graph.

> Domínio atual do app: https://lex-navy.vercel.app

---

## 1. Resumo executivo

O Lex já tem a arquitetura necessária para aproveitar essas fontes:

- Corpus jurídico canônico
- LegalNorm / LegalNormVersion / LegalChunk / LegalCitation
- Qdrant
- Postgres FTS
- Retrieval híbrido BM25 + dense
- Graph-aware retrieval
- Reasoning estratégico
- Workflow de casos
- Lawyer Brain
- Cockpit operacional
- Inngest para jobs assíncronos

Agora o foco deve ser maximizar ingestão pública e enriquecer metadados, sem depender de scraping frágil quando houver API oficial.

---

## 2. Fontes e chaves necessárias

| Provider | Chave necessária | Onde pegar | Custo | Cobertura | Prioridade |
|---|---|---|---|---|---|
| FIXTURE | Não | Já está no código | Grátis | Corpus demo: CF/88, CDC, CC, CPC, exemplos | Alta para teste |
| LexML | Não | API pública SRU do LexML | Grátis | Legislação, jurisprudência, proposições, doutrina/metadados | Muito alta |
| DataJud CNJ | Sim: `DATAJUD_API_KEY` | CNJ / DataJud Wiki / formulário de acesso | Grátis | Metadados processuais e movimentações de tribunais brasileiros | Muito alta |
| STF | Não inicialmente | Portal público STF | Grátis | Súmulas, Súmulas Vinculantes, jurisprudência pública | Alta |
| STJ | Não inicialmente | Portal público STJ / SCON | Grátis | Acórdãos, súmulas, decisões monocráticas, informativos | Alta |
| TST | Pode usar DataJud + fontes públicas | DataJud e portal TST | Grátis | Processos e jurisprudência trabalhista | Média/Alta |
| TSE | Pode usar DataJud + fontes públicas | DataJud e portal TSE | Grátis | Processos e jurisprudência eleitoral | Média |
| TJs/TRFs/TRTs/TREs | DataJud API Key | DataJud endpoints por alias | Grátis | Metadados processuais por tribunal | Muito alta |
| Câmara Dados Abertos | Não para endpoints públicos | Dados Abertos Câmara | Grátis | Projetos de lei, deputados, tramitação legislativa | Média |
| Senado Dados Abertos | Não para endpoints públicos | Dados Abertos Senado | Grátis | Matérias legislativas, senadores, normas/metadados | Média |
| Diário Oficial / DJE | Varia por origem | Portais oficiais e Diários | Grátis/público | Publicações, movimentações, intimações | Alta futura |
| Doutrina | Sim/contratos/licenças, se conteúdo integral | Editoras/autores/licenças | Pago ou restrito | Doutrina autoral | Alta, mas com cuidado autoral |

---

## 3. Variáveis de ambiente recomendadas

### DataJud

```env
DATAJUD_API_KEY=
DATAJUD_BASE_URL=https://api-publica.datajud.cnj.jus.br
DATAJUD_DEFAULT_PAGE_SIZE=100
DATAJUD_MAX_PAGES_PER_SYNC=10
DATAJUD_RATE_LIMIT_PER_MINUTE=30
DATAJUD_DEFAULT_ALIAS=api_publica_tjrs
DATAJUD_MODE=live
```

### LexML

```env
LEXML_BASE_URL=https://www.lexml.gov.br/busca/SRU
LEXML_PROVIDER_MODE=live
LEXML_DEFAULT_PAGE_SIZE=50
LEXML_MAX_PAGES_PER_SYNC=20
LEXML_RATE_LIMIT_PER_MINUTE=20
```

### STF

```env
STF_PROVIDER_MODE=live
STF_BASE_URL=https://portal.stf.jus.br
STF_RATE_LIMIT_PER_MINUTE=10
```

### STJ

```env
STJ_PROVIDER_MODE=live
STJ_BASE_URL=https://processo.stj.jus.br
STJ_RATE_LIMIT_PER_MINUTE=10
```

### Corpus indexado

```env
ENABLE_CORPUS_SYNC=true
ENABLE_LEGAL_RETRIEVAL=true
ENABLE_CORPUS_GRAPH=true
ENABLE_DATAJUD=false
ENABLE_STF_PROVIDER=true
ENABLE_STJ_PROVIDER=true
ENABLE_LEXML_PROVIDER=true
```

---

## 4. DataJud — endpoints e aliases

A API Pública do DataJud usa a base:

```txt
https://api-publica.datajud.cnj.jus.br/
```

E cada tribunal possui um alias próprio:

```txt
https://api-publica.datajud.cnj.jus.br/api_publica_<alias>/_search
```

Exemplos:

```txt
api_publica_stj/_search
api_publica_tst/_search
api_publica_tse/_search
api_publica_stm/_search
api_publica_trf1/_search
api_publica_trf2/_search
api_publica_trf3/_search
api_publica_trf4/_search
api_publica_trf5/_search
api_publica_trf6/_search
api_publica_tjsc/_search
api_publica_tjrs/_search
api_publica_tjpr/_search
api_publica_tjsp/_search
api_publica_trt12/_search
api_publica_tre-sc/_search
```

### Uso esperado no Lex

DataJud deve alimentar:

- movimentações processuais
- metadados de processos
- padrões por tribunal
- procedural analytics
- alertas de movimentação
- case timeline
- tendência regional
- cockpit operacional
- knowledge graph cross-case

### Estratégia de ingestão

1. Começar por UF/região prioritária:
   - TJSC
   - TJRS
   - TJPR
   - TRF4
   - TRT12
   - TST
   - STJ
   - STF via fonte própria, não DataJud
2. Ingestão incremental por `search_after`
3. Persistir watermark por:
   - provider
   - alias
   - tribunal
   - query
4. Nunca baixar “tudo” de uma vez.
5. Criar jobs pequenos e idempotentes.

---

## 5. LexML — estratégia de uso

LexML é prioridade máxima para normas porque não precisa de chave e oferece pesquisa SRU/XML.

### Deve alimentar:

- Constituição
- códigos
- leis federais
- leis estaduais
- decretos
- medidas provisórias
- súmulas e documentos jurídicos quando disponíveis
- metadados legislativos
- relações normativas básicas

### Queries iniciais sugeridas

```txt
Constituição Federal 1988
Código Civil Lei 10406 2002
Código de Processo Civil Lei 13105 2015
Código de Defesa do Consumidor Lei 8078 1990
CLT Decreto-Lei 5452 1943
Estatuto da Criança e do Adolescente Lei 8069 1990
Estatuto do Idoso Lei 10741 2003
Lei Maria da Penha Lei 11340 2006
Estatuto da Advocacia Lei 8906 1994
Código de Ética OAB
Lei de Benefícios Previdenciários Lei 8213 1991
Lei do Inquilinato Lei 8245 1991
```

---

## 6. STF

### Sem chave inicialmente

Usar portal público para:

- Súmulas
- Súmulas Vinculantes
- Temas de repercussão geral, se viável
- Informativos, se viável
- Acórdãos, com cuidado para estabilidade

### Uso no Lex

- citation graph
- contradiction detection
- tese dominante
- força constitucional
- divergência STF/STJ
- grounding em estratégia

---

## 7. STJ

### Sem chave inicialmente

Usar SCON / portal público para:

- acórdãos
- súmulas
- decisões monocráticas
- informativos de jurisprudência
- pesquisa pronta

### Uso no Lex

- pesquisa jurisprudencial automática
- precedentes líderes
- entendimento consolidado
- divergência por turma/seção
- grounding para peças cíveis, contratos, família, consumidor, previdenciário etc.

---

## 8. Áreas prioritárias do Lex

O primeiro corpus especializado deve focar em:

1. Direito Civil
2. Contratos
3. Contencioso
4. Extrajudicial
5. Família
6. Previdenciário
7. Trabalho
8. Criança e Adolescente
9. Idoso
10. Maria da Penha
11. Defesa do homem em contexto de Maria da Penha
12. Representação da mulher
13. Estatuto da Advocacia
14. Código de Ética da OAB
15. Prerrogativas do advogado
16. Constituição Federal

---

## 9. Como representar no Lex

### LegalNorm

Usar para:

- Constituição
- códigos
- leis
- decretos
- estatutos
- súmulas
- súmulas vinculantes
- temas
- precedentes qualificados

### LegalNormVersion

Usar sempre que houver:

- data de publicação
- data de vigência
- alteração
- revogação
- versão consolidada

### LegalChunk

Chunk hierárquico com:

- título
- capítulo
- seção
- artigo
- parágrafo
- inciso
- alínea
- ementa
- tese
- dispositivo

### LegalCitation

Registrar:

- citações expressas
- relações entre normas
- súmulas citadas
- artigos citados
- leis correlatas
- decisões relacionadas

### Case / CaseTimeline / CaseAlert

DataJud e DJE devem alimentar:

- movimentações
- alertas
- risco crescente
- prazo
- mudança processual
- atualização de estratégia

---

## 10. Regras de segurança

- Não coletar processos sigilosos.
- Não armazenar dados pessoais desnecessários.
- Não usar dados reais de clientes no teste inicial.
- Sempre respeitar termos de uso dos provedores.
- Implementar rate limit por provider.
- Usar backoff exponencial.
- Identificar User-Agent do Lex, se scraping for inevitável.
- Preferir API oficial a scraping.
- Registrar provenance/sourceUrl em tudo.
- Manter modo dry-run antes de live.
- Não prometer autonomia jurídica; manter supervisão humana.

---

# Prompt para Cursor — Ingestão máxima das fontes jurídicas públicas

```txt
Vamos organizar e maximizar o aproveitamento das fontes jurídicas públicas no Lex, sem depender inicialmente de chaves que ainda não temos.

Contexto:
O Lex já tem:
- LegalNorm
- LegalNormVersion
- LegalChunk
- LegalCitation
- IngestionWatermark
- IngestionJob
- Qdrant
- Postgres FTS
- Retrieval híbrido
- Graph-aware retrieval
- Reasoning estratégico
- Case Workflow
- Cockpit
- Lawyer Brain
- Inngest Cloud funcionando
- produção em https://lex-navy.vercel.app

Fontes disponíveis:
1. FIXTURE — sem chave
2. LexML — sem chave, SRU/XML público
3. STF — sem chave, scraping/API pública do portal quando possível
4. STJ — sem chave, SCON/portal público quando possível
5. DataJud — exige DATAJUD_API_KEY, ainda não temos
6. Câmara/Senado — dados abertos, sem chave para endpoints públicos
7. DataJud XSDs enviados pelo usuário — usar para validar/entender schema de metadados processuais quando aplicável

Links de referência:
- DataJud endpoints: https://datajud-wiki.cnj.jus.br/api-publica/endpoints
- DataJud acesso: https://datajud-wiki.cnj.jus.br/api-publica/acesso
- DataJud exemplo 1: https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo1
- DataJud exemplo 2: https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo2
- DataJud exemplo 3: https://datajud-wiki.cnj.jus.br/api-publica/exemplos/exemplo3
- LexML SRU: https://www.lexml.gov.br/busca/SRU
- Portal LexML/Senado: https://www12.senado.leg.br/dados-abertos/legislativo/legislacao/acervo-do-portal-lexml
- STJ jurisprudência: https://www.stj.jus.br/sites/portalp/paginas/Sob-medida/Advogado/Jurisprudencia/Pesquisa-de-Jurisprudencia.aspx
- STF portal: https://portal.stf.jus.br

Objetivo:
Extrair o máximo possível de valor jurídico dessas fontes, com ingestão incremental, segura, idempotente e rastreável, priorizando o que não precisa de chave agora.

NÃO fazer scraping agressivo.
NÃO quebrar termos de uso.
NÃO baixar volume massivo sem rate limit.
NÃO criar feature visual nova agora.
Foco: providers, ingestion, normalization, metadata, tests, docs e readiness.

FASE 1 — Auditoria do corpus/provider atual
1. Mapear src/lib/corpus/providers/*
2. Mapear scripts/corpus-sync.ts
3. Mapear Inngest corpus-sync e corpus-ingest-norm
4. Mapear LegalNorm/LegalNormVersion/LegalChunk/LegalCitation
5. Mapear quais providers já estão implementados:
   - fixture
   - lexml
   - stf
   - stj
   - datajud
6. Reportar lacunas reais.

FASE 2 — LexML como fonte principal sem chave
Implementar/fortalecer provider LexML:

1. SRU client robusto:
   - query
   - startRecord
   - maximumRecords
   - retry/backoff
   - timeout
   - XML parser seguro
   - normalization Unicode
   - provenance sourceUrl
   - contentHash

2. Queries seed prioritárias:
   - Constituição Federal 1988
   - Código Civil
   - Código de Processo Civil
   - Código de Defesa do Consumidor
   - CLT
   - Estatuto da Criança e do Adolescente
   - Estatuto do Idoso
   - Lei Maria da Penha
   - Estatuto da Advocacia
   - Código de Ética da OAB
   - Lei 8213/1991 previdenciária
   - Lei do Inquilinato
   - Lei de Alimentos
   - Lei de Registros Públicos
   - Lei de Improbidade, se útil
   - LGPD, para base ética e privacidade

3. Criar script:
   npm run corpus:seed:lexml

4. Criar modo dry-run:
   npm run corpus:seed:lexml -- --dry-run

5. Ingestão:
   - dedupe por URN/contentHash
   - versionamento temporal
   - chunking hierárquico
   - citations
   - Qdrant upsert
   - payload indexes existentes

FASE 3 — STF sem chave
Fortalecer provider STF:

1. Súmulas
2. Súmulas Vinculantes
3. Temas de repercussão geral, se houver endpoint ou HTML estável
4. Informativos, se viável
5. Acórdãos apenas se houver parser minimamente confiável

Regras:
- rate limit baixo
- cache HTTP se possível
- parser testável com fixtures HTML
- tolerância a HTML quebrado
- sourceUrl sempre salvo
- sem scraping massivo

Criar:
npm run corpus:seed:stf

FASE 4 — STJ sem chave
Fortalecer provider STJ:

1. Súmulas
2. Acórdãos via SCON quando possível
3. Informativos de jurisprudência
4. Pesquisa pronta, se tecnicamente viável
5. Parser HTML com fixtures

Criar:
npm run corpus:seed:stj

FASE 5 — DataJud preparado, mas sem bloquear
Como ainda não temos DATAJUD_API_KEY:

1. Provider DataJud deve ficar pronto em modo:
   - disabled sem key
   - dry-run com query builder
   - live apenas quando DATAJUD_API_KEY existir

2. Usar a documentação oficial:
   - endpoints por alias
   - search_after
   - exemplos de query
   - autenticação

3. Usar os XSDs enviados pelo usuário para:
   - documentar campos
   - criar tipos auxiliares se fizer sentido
   - validar estrutura conceitual
   - NÃO bloquear build se XSD não for usado em runtime

4. Criar lista de aliases prioritários:
   - api_publica_stj
   - api_publica_tst
   - api_publica_tse
   - api_publica_trf4
   - api_publica_tjsc
   - api_publica_tjrs
   - api_publica_tjpr
   - api_publica_tjsp
   - api_publica_trt12
   - api_publica_tre-sc

5. Criar:
   npm run datajud:check
   npm run datajud:dry-run
   DATAJUD_DEFAULT_ALIAS=api_publica_tjsc npm run datajud:dry-run

6. Quando DATAJUD_API_KEY não existir:
   - não quebrar health
   - mostrar status "not_configured"
   - docs indicam onde solicitar chave

FASE 6 — Câmara/Senado dados abertos
Avaliar fontes públicas úteis para:
- proposições legislativas
- tramitação
- alterações legislativas
- matérias em discussão
- atualização normativa futura

Implementar apenas se for de baixo risco e sem quebrar prioridade LexML/STF/STJ.

FASE 7 — Domain Packs
Criar configuração determinística para áreas prioritárias:

- civil
- contratos
- contencioso
- extrajudicial
- família
- previdenciário
- trabalho
- criança/adolescente
- idoso
- maria-da-penha
- defesa-homem
- representação-mulher
- advocacia-ética-prerrogativas
- constitucional

Cada pack deve definir:
- queries seed
- normas prioritárias
- tribunais prioritários
- retrieval boosts
- templates de research
- issue spotting hints
- risk hints
- prompt hints futuros

FASE 8 — Corpus readiness panel/admin
Sem criar grande UI nova, mas se já houver settings/readiness:
- mostrar provider status:
  - fixture ok
  - lexml ok/not_configured/down
  - stf ok/down
  - stj ok/down
  - datajud not_configured
- mostrar últimas ingestion jobs
- mostrar quantas LegalNorm/LegalChunk por provider
- mostrar falhas recentes

FASE 9 — Scripts e documentação
Criar/atualizar:

docs/LEGAL_PROVIDERS.md
docs/DATAJUD_SETUP.md
docs/CORPUS_SEEDING.md

Documentar:
- quais fontes precisam chave
- quais não precisam
- como rodar seed
- como rodar dry-run
- rate limits
- riscos
- termos de uso
- onde pegar DATAJUD_API_KEY
- como validar corpus
- como limpar/reindexar

Scripts esperados:
- npm run corpus:seed:fixture
- npm run corpus:seed:lexml
- npm run corpus:seed:stf
- npm run corpus:seed:stj
- npm run corpus:seed:all-public
- npm run datajud:check
- npm run datajud:dry-run
- npm run qdrant:init
- npm run corpus:stats

FASE 10 — Testes
Adicionar testes para:
- LexML parser
- LexML pagination
- STF parser fixtures
- STJ parser fixtures
- DataJud query builder
- DataJud disabled without key
- Domain packs
- provider registry
- dry-run scripts
- corpus stats

Rodar:
npm run lint
npm run typecheck
npm test
npm run test:integration
NODE_ENV=production npm run build

FASE 11 — Produção
Garantir que em production:
- falta de DATAJUD_API_KEY não quebra app
- LexML/STF/STJ têm rate limit
- jobs Inngest não rodam loop infinito
- errors são registrados em ObservabilityLog
- cada provider tem timeout
- cada sync tem maxPages
- cada provider respeita dry-run
- health mostra status correto

Critério de pronto:
- conseguimos popular o Lex com o máximo possível de corpus público sem chave
- conseguimos preparar DataJud para quando a chave chegar
- conseguimos ver stats do corpus
- conseguimos rodar retrieval jurídico com fontes novas
- não quebramos produção
- não dependemos de credenciais indisponíveis
```

---

## Checklist manual para DATAJUD_API_KEY

1. Abrir: https://datajud-wiki.cnj.jus.br/api-publica/acesso
2. Seguir instruções de acesso/formulário do CNJ.
3. Solicitar uso para desenvolvimento de sistema jurídico com consulta a metadados públicos.
4. Quando receber:
   - adicionar `DATAJUD_API_KEY` na Vercel.
   - adicionar `ENABLE_DATAJUD=true`.
   - redeploy.
   - rodar `npm run datajud:check`.
   - iniciar com `--dry-run`.
   - só depois rodar sync real limitado.
