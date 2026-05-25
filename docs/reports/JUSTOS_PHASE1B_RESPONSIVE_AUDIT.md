# JustOS Phase 1B — Rebrand app + responsividade

**Data:** 2026-05-25  
**Escopo:** Fase 1b (UI app) + correções críticas mobile/14"

---

## 1. Rebrand executado

| Área | Status |
|------|--------|
| Topbar + fallback título | ✅ JustOSLogo + `matchPathTitle` → JustOS |
| Login / register | ✅ |
| ~57 arquivos `src/**` copy Lex → JustOS / JustOS AI | ✅ script + fixes manuais |
| Marketing legal (termos, privacidade, manifesto) | ✅ metadata + corpo |
| `factory.ts` X-Title, Inngest name | ✅ |
| Legado técnico | Mantido: rotas `lex-*`, `LexPageFrame`, paths `Projetos/Lex` em dev hints |

**Pendente menor:** `sentry-example-page`, `prompts.test.ts`, comentários de código, `lex-logo-mark` (deprecated).

---

## 2. Responsividade — correções aplicadas

| # | Problema | Correção |
|---|----------|----------|
| 1 | App `ml-[268px]` em mobile | `max-lg:ml-0` no `app-shell` |
| 2 | Sidebar fixa 268px em telefone | Drawer `max-lg:-translate-x-full` + overlay + botão Menu na topbar |
| 3 | Marketing `70vw` estreito em mobile | `lex-marketing-well` 100% &lt;1024px; 70vw só desktop |
| 4 | Poço app 70% em 14" | `@media (max-width:1366px)` → 82% do espaço útil, cap 52rem |
| 5 | Poço app em tablet | `@media (max-width:1023px)` → well ~100% viewport |
| 6 | Intake `--app-main-inset` fixo 268px | `useEffect` + `matchMedia` → 0px &lt; lg |

---

## 3. Verificação manual sugerida

```bash
cd /home/thales/Projetos/Lex && npm run dev
```

| Viewport | URLs |
|----------|------|
| 390×844 | `/`, `/login`, `/dashboard`, `/cases` |
| 1366×768 | `/`, `/dashboard`, `/cases/new` |
| 1920×1080 | regressão desktop |

---

## 4. Próximo no plano mestre

- **Fase 2** distill homepage (após validar 1b em device real)
- **Fase adapt** — `impeccable adapt` em rotas caso a caso (tabelas, intake split)
- Re-critique com score alvo ≥34
