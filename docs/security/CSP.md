# Content-Security-Policy (CSP) — Lex

Implementação: `src/proxy.ts` → `applySecurityHeaders()` em todas as respostas.

## Estado atual (produção)

| Diretiva | Valor | Avaliação |
|----------|--------|-----------|
| `script-src` | `'self' 'nonce-…' 'strict-dynamic'` | **Forte** — scripts inline só com nonce; filhos de scripts confiáveis permitidos |
| `script-src` (dev) | + `'unsafe-eval'` | Necessário para Turbopack/HMR |
| `style-src` | `'self' 'unsafe-inline'` | **Compromisso aceito** — Tailwind, Radix, Tiptap e estilos React inline |
| `connect-src` | self + Supabase + provedores IA + Sentry + Vercel vitals | Restrito a hosts conhecidos |
| `object-src` | `'none'` | Bom |
| `frame-ancestors` | `'none'` | Anti-clickjacking |
| `img-src` | `'self' data: blob: https:` | `https:` amplo (avatars OAuth); restringir depois se houver allowlist fixa |

Nonce: gerado no proxy, repassado em `x-nonce` e usado no script de tema em `src/app/layout.tsx`.

## Por que mantemos `unsafe-inline` em styles

Remover exige uma destas abordagens (custo alto no Next + Tailwind):

1. Nonce em **todos** os `<style>` injetados pelo runtime (suporte parcial no App Router).
2. Migrar para CSS externo apenas (sem estilos inline de componentes).
3. `style-src` com hashes por build — frágil a cada deploy.

**Risco:** injeção de CSS malicioso (exfiltração limitada vs XSS em script). Scripts continuam protegidos por nonce + `strict-dynamic`.

## Por que **não** usamos `unsafe-inline` em scripts (prod)

- Tema inicial: `<script nonce={nonce}>` em `layout.tsx`.
- Bundles Next: carregados via tags com nonce ou via `strict-dynamic` a partir do script nonced.

## Checklist FASE 5.1 (confirmado em `src/proxy.ts`)

| # | Requisito | Status |
|---|-----------|--------|
| 1 | Produção **sem** `unsafe-eval` em `script-src` | **OK** (só dev) |
| 2 | Produção **sem** `unsafe-inline` em `script-src` | **OK** |
| 3 | `script-src` nonce + `strict-dynamic` | **OK** |
| 4 | `style-src 'unsafe-inline'` | **P2 aceito** (Tailwind/Radix/Tiptap) |
| 5 | `object-src 'none'` | **OK** |
| 6 | `frame-ancestors 'none'` | **OK** |
| 7 | `connect-src` só origens necessárias | **OK** (lista explícita) |
| 8 | `img-src https:` amplo | **Documentado** — melhoria futura |
| 9 | `Content-Security-Policy-Report-Only` | **Futuro** — ver abaixo |

## Melhorias futuras (P2/P3)

- [ ] `style-src` com nonce quando o pipeline de estilos do Next suportar 100% dos chunks.
- [ ] Restringir `img-src` a domínios de avatar (Google, GitHub, Supabase storage público se houver).
- [ ] **`Content-Security-Policy-Report-Only`** em staging (endpoint de relatório) antes de endurecer `style-src` / `img-src`.
- [ ] Revisar `https:` em `img-src` após inventário de origens reais.

## Verificação manual

1. Abrir app autenticado → DevTools → Console: não deve haver erros CSP em fluxos normais (tema, upload, editor).
2. Resposta HTTP → header `Content-Security-Policy` presente.
3. Produção: sem `'unsafe-eval'` no `script-src`.
