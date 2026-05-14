# Lex — P1 tipografia: varredura e decisões (maio 2026)

Objetivo: **menos `text-[Npx]` arbitrário** nas rotas prioritárias, com tokens `--text-micro` … `--text-readable` e utilitários Tailwind `text-micro` … `text-readable` (ver `globals.css`, `tailwind.config.ts`, [DESIGN_SYSTEM_TYPOGRAPHY.md](./DESIGN_SYSTEM_TYPOGRAPHY.md)).

**Fonte principal:** mantida Atkinson Hyperlegible (+ Inter / sistema). Nenhuma alteração de API, dados ou providers.

---

## 1. Tokens criados (resumo)

| CSS | Tailwind |
|-----|----------|
| `--text-micro` | `text-micro` |
| `--text-caption` (= `--text-xs`, 13px) | `text-caption` |
| `--text-section-title` (= `--text-sm`, 14px) | `text-section` |
| `--text-control` (15px) | `text-control` |
| `--text-body` (= `--text-base`) | `text-body` |
| `--text-readable` (= `--text-md`, 17px) | `text-readable` |

Line-height: `--leading-tight-readable`, `--leading-readable`, `--leading-relaxed-readable`.

---

## 2. Rotas prioritárias — ocorrências `text-[10px]` … `text-[13.5px]` (ação)

Padrão de busca: `text-\[(10|10\.5|11|11\.5|12|13|13\.5)px\]` em `src/**/*.tsx`.

| Área | Ficheiros tocados (P1) | Ação |
|------|------------------------|------|
| Dashboard | `morning-briefing.tsx`, `next-actions-card.tsx`, `dashboard/page.tsx` | Frases / hints / listas → `text-sm` ou `text-caption`; kickers curtos → `text-micro`; badges de fluxo → `text-caption`; CF/ADCT em próximas ações → `text-micro` (2 letras, decorativo). |
| Casos | `cases/*`, `case-progress.tsx`, `fundamental-intake-chrome.tsx`, `legal-form.tsx` | Progresso: rótulo secção → `text-micro`+contraste; contadores mono → `text-caption`; passo / próximo passo → `text-sm`; status pill → `text-caption`; ícone numérico no círculo → `text-micro`. Form: badge passo → `text-caption`. Botões intake → `text-control`. |
| Documentos | `documentos/page.tsx`, `document-upload-button.tsx`, `document-row-actions.tsx`, `document-pdf-thumbnail.tsx` | Quota → `text-caption`; erro → `text-sm`; miniatura overlay → `text-micro`. |
| Processos | `processos/page.tsx`, `processos/[processId]/page.tsx`, `processos/.../documentos/[documentId]/page.tsx`, `process-virtual-list.tsx` | Badges de tags / estado → `text-caption`; filtro span curto uppercase → `text-micro`; meta `text-[11px]` → `text-caption`. |
| Settings integrações | `settings/integracoes/*` | Sem ocorrências do padrão (UI já em escala base). |
| Shell | `app-topbar.tsx`, `theme-toggle.tsx` | Eyebrow / kbd: `text-micro` / `text-caption`; toggle tema → `text-sm` (controlo segmentado). |

---

## 3. Ocorrências mantidas com justificativa (fora do escopo P1 rota-a-rota)

Após o passo acima, **ainda existem** dezenas de ficheiros com `text-[10px]`–`text-[13px]` (ex.: `legal-search-panel.tsx`, `case-overview-tab.tsx`, `retrieved-chunk-card.tsx`, marketing, busca global, etc.). Motivos:

1. **Escopo:** o pedido P1 priorizou sete áreas; o restante fica para migração incremental (ver [DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md](./DESIGN_SYSTEM_TYPOGRAPHY_AUDIT.md)).
2. **SVG / gráficos:** alguns `text-[10px]` em SVG (ex. `precedent-map.tsx`) são anotações densas de diagrama — rever com desenho, não só com classe Tailwind.
3. **Mono / debug:** traces e chunks podem precisar de hierarquia própria; migrar ficheiro a ficheiro evita regressões de layout.

Para contagens atualizadas, correr no repo:

`rg 'text-\[(10|10\.5|11|11\.5|12|13|13\.5)px\]' src --glob '*.tsx'`

---

## 4. Validação (comandos — maio 2026)

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | OK |
| `npm run typecheck` | OK |
| `npm test` | OK (610 testes) |
| `npm run build` | OK |

`npm run build` e `npm run build:clean` usam o **mesmo** pipeline em `package.json` (`clean` + `prisma generate` + `next build` em produção). Com um build verde, `build:clean` não acrescenta verificação extra.

**Verificação visual:** relatório de fecho **sem agenda**: [DESIGN_SYSTEM_TYPOGRAPHY_P1_QA.md](./DESIGN_SYSTEM_TYPOGRAPHY_P1_QA.md). Inventário `text-[Npx]` residual: [DESIGN_SYSTEM_TYPOGRAPHY_P1_REMAINING.md](./DESIGN_SYSTEM_TYPOGRAPHY_P1_REMAINING.md).

**Commit P1 (tipografia):** inclui apenas alterações de classes/tokens e documentação DS acima; **exclui** por defeito `dashboard/page.tsx` (cartões de agenda), `morning-briefing*.tsx/ts`, `documentos/page.tsx` (quota), `processos/page.tsx` (assinatura `getProcessAnalytics`), `settings/integracoes/page.tsx` (CTA extra), `document-dropzone`, pastas `calendar/` e `agenda/`, migrations e governance.

---

## 5. Critérios de aceite (checklist)

| # | Critério | Estado |
|---|----------|--------|
| 1 | Atkinson Hyperlegible mantida | Sim (`globals.css` / `tailwind`) |
| 2 | Texto jurídico funcional nas rotas P1 ≥ 13px (ideal ≥ 14px para frases) | Ajustado nos ficheiros listados na secção 2 |
| 3 | Inputs 16px | Mantido (`input.tsx` / `textarea.tsx`) |
| 4 | Botões legíveis (`text-control` default, `sm` ≥ `text-sm`) | `button.tsx` |
| 5 | Dashboard mais legível | `morning-briefing`, `next-actions-card` |
| 6 | `text-[10px]` só onde micro decorativo justificado | Reduzido nas rotas P1; residual documentado na secção 3 |
| 7 | Documentação | `DESIGN_SYSTEM_TYPOGRAPHY.md` + este ficheiro |
| 8 | Build verde | Ver secção 4 |
