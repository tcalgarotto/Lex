# Feature — Pesquisa jurídica assistida (modo temporário DeepSeek)

## Visão

Modo provisório em que a **pesquisa jurídica** e a **recomendação para caso** podem ser atendidas por respostas **estruturadas em JSON** geradas via **DeepSeek API**, com rótulos de confiança conservadores e avisos explícitos ao usuário final.

## Abrangência

- **Busca global** (`POST /api/legal-research/search`): consulta livre com tipos de resultado (`LAW`, `JURISPRUDENCE`, `THESIS`, `STRATEGY`, `DRAFTING_SUPPORT`).
- **Recomendação de caso** (`POST /api/legal-research/recommend-for-case`): exige `caseId` válido no workspace ativo; reforça o contexto no prompt.
- **Compatibilidade (Lane E)**: `buildRetrievalSearchCompatiblePayload` em `src/lib/legal-research/retrieval-adapter.ts` monta um payload no formato de `GET /api/retrieval/search` **sem alterar** essa rota.

## Limitações (produto)

- Jurisprudência sugerida é **candidata** — pode não existir ou estar imprecisa.
- Fundamentos sem citação clara ou sem URL de referência geram **avisos** automáticos.
- Fixação no caso (`POST .../pin`) e marcação como conferido em fonte oficial (`POST .../mark-verified`) retornam **202** com shim até a Lane B/E persistir em modelo de dados adequado.
- O modo **não substui** conferência humana nem base oficial (tribunal, diário da justiça, banco normativo).

## Copy ao usuário (PARTE 12 — PROMPT MASTER)

Usar exatamente estes textos onde couber (banners, tooltips, rodapé de resultado):

- `Resultado sugerido por IA. Revise antes de usar.`
- `Jurisprudência candidata. Confirme a fonte antes de citar.`
- `O RAG interno está em otimização; esta busca usa DeepSeek temporariamente.`
- `Sugestão de estratégia — valide fatos e provas do seu caso antes de protocolar.`
- `Sem número de processo identificado — não cite como precedente até confirmar.`

## Variáveis relevantes

Ver bloco no final de `.env.example` e o ADR `docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md`.

## Governança

Owners Legal / Security / QA ainda **PROVISÓRIOS** — qualquer PR Tier-S deve carregar nota explícita de que aguarda **dupla revisão Thales (PO) + Cursor (CTO interim)**.
