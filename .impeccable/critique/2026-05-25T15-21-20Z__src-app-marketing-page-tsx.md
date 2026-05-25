---
target: homepage JustOS (Lex) — src/app/(marketing)/page.tsx
total_score: 23
p0_count: 1
p1_count: 2
timestamp: 2026-05-25T15-21-20Z
slug: src-app-marketing-page-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Form loading/spinner ok; long page has no progress or "you are here" beyond sticky header |
| 2 | Match System / Real World | 2 | Copy jurídico em PT-BR é forte, mas marca pública ainda é "Lex" enquanto produto evolui para JustOS |
| 3 | User Control and Freedom | 3 | Âncoras, menu mobile, toggle tema; falta atalho para preços ou formulário no topo mobile |
| 4 | Consistency and Standards | 2 | Identidade Lex vs JustOS; padrão card+ícone repetido em 4 seções |
| 5 | Error Prevention | 3 | Beta form com honeypot, consent obrigatório, validação básica |
| 6 | Recognition Rather Than Recall | 2 | 11 cards de recurso + 6 passos exigem memória de scroll; nav não cobre #beta |
| 7 | Flexibility and Efficiency | 2 | CTAs repetidos ajudam, mas não há versão curta nem link direto a /pricing no header |
| 8 | Aesthetic and Minimalist Design | 1 | Página muito longa; muitas superfícies glass/card com mesma gramática visual |
| 9 | Error Recovery | 3 | Toasts em falha de envio; estado de sucesso no formulário |
| 10 | Help and Documentation | 2 | Disclaimer jurídico no rodapé; sem FAQ, chat ou prova social verificável |
| **Total** | | **23/40** | **Needs improvement** |

## Anti-Patterns Verdict

**LLM assessment:** Parcialmente. A copy é específica do domínio jurídico (não é lorem ipsum genérico), o mockup de caso e exemplos "Ex.:" dão credibilidade. Porém a estética cai no template "legal-tech dark + violet glow + glass cards + bento de features + janela fake macOS com métricas 8/14/6". Glassmorphism decorativo (`lex-glass`, `backdrop-blur-xl`) aparece em header, cards e formulário. Grade homogênea de ~20 cards com ícone Lucide + título + corpo + caixa "Ex.:" é o padrão de grid idêntico que Impeccable marca como clichê SaaS.

**Deterministic scan:** Indisponível (`bundled detector not found` em `detect.mjs`). Revisão manual não encontrou `border-left` accent, `background-clip: text`, nem gradient text nos arquivos de marketing.

**Visual overlays:** Não aplicável (injeção live-server não executada).

## Overall Impression

A landing comunica bem o valor jurídico e o tom de "você revisa", mas parece um Lex de 2025 ainda não rebaptizado como JustOS. O maior gap não é falta de polish visual: é densidade narrativa (página de vendas inteira antes do lead converter) e sinal de marca desalinhado com o pivot do produto.

## What's Working

1. **Proposta em linguagem de escritório** — Headline e microcopy falam de caso, fundamentos, protocolo e revisão profissional, não de "AI magic".
2. **Mockup do produto no hero** — A vitrine "Caso #2847" ancora o visitante no fluxo real (abas, IA no caso, pipeline).
3. **Formulário beta maduro** — Honeypot, consent LGPD, intent beta/demo, atribuição UTM; cargo ainda opcional mas estrutura séria.

## Priority Issues

**[P0] Marca pública ainda é Lex, não JustOS**
- **Why:** Visitante que ouviu "JustOS" vê Lex no título, logo "L", metadata OG, footer e checkbox do form; quebra confiança e SEO.
- **Fix:** Renomear shell marketing (header, layout metadata, copy, legal strings) ou landing dedicada JustOS com redirect claro.
- **Suggested command:** `impeccable clarify` + `impeccable craft` (rebrand hero/header)

**[P1] Página excessivamente longa antes da conversão**
- **Why:** 11 feature cards + 6 workflow + 4 audience + 5 security = fadiga; Jordan abandona antes de #beta.
- **Fix:** `distill` para 4-5 pilares; workflow colapsável; mover prova social acima da dobra.
- **Suggested command:** `impeccable distill`

**[P1] Glassmorphism e glow como linguagem default**
- **Why:** Impeccable trata blur/glass decorativo como anti-pattern; competição visual com conteúdo.
- **Fix:** Superfícies sólidas tintadas; reservar glass só no header scrolled ou remover.
- **Suggested command:** `impeccable quieter`

**[P2] Grid de cards idênticos na seção Recursos**
- **Why:** Cada card segue icon + tag + título + descrição + Ex.; leitura vira scan superficial.
- **Fix:** Agrupar por jornada (Captação / Caso / Peça) ou 3 histórias em vez de 11 tiles.
- **Suggested command:** `impeccable layout`

**[P2] Hero stats (1 lugar / Com fontes / Você revisa)**
- **Why:** Vizinho do template hero-metric; valor real já está no copy acima.
- **Fix:** Substituir por uma linha de prova (logos, depoimento, número verificável) ou integrar no mockup.
- **Suggested command:** `impeccable distill`

## Persona Red Flags

**Jordan (First-Timer):** Seção Recursos com 11 opções visíveis de uma vez (>4 por decisão). Nav não inclui "Preços" nem "Solicitar acesso" como rótulo explícito (só botão). Precisa rolar ~3 telas para entender se é software, serviço ou beta fechado.

**Casey (Mobile):** CTA primário no header está alto (thumb zone fraca). Menu hamburger esconde 5 âncoras + login. Formulário beta no final exige muito scroll com teclado aberto.

**Sam (Accessibility):** Mockup do hero é `aria-hidden` (correto decorativo), mas métricas 8/14/6 dentro dele não são anunciadas (ok). Checkbox de consent com `readonly` no snapshot do browser pode confundir leitores de tela. Contraste purple-on-dark nos stats precisa verificação AA em modo claro.

## Minor Observations

- Footer duplica coluna "Recursos" vs nav "Recursos" (IA confusa).
- `Cargo` no beta form não é required enquanto outros campos são.
- Animações `landing-float` e hero pulse respeitam `prefers-reduced-motion` (bom).
- Tema escuro pré-selecionado na captura pode ser preferência do usuário, não default do site.

## Questions to Consider

- E se a home de JustOS tivesse só hero + 3 pilares + formulário, e o resto em /produto?
- A serif no headline comunica tradição jurídica ou parece "startup que quer parecer boutique"?
- O que um sócio gestor precisa ver nos primeiros 8 segundos que não está na dobra hoje (preço, prova, integração tribunal)?
