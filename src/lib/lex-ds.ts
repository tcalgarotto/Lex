/**
 * Lex Design System — nomes de classe (estilos em `src/app/globals.css`, @layer components).
 * Documentação: docs/DESIGN_SYSTEM.md · tipografia: docs/DESIGN_SYSTEM_TYPOGRAPHY.md
 *
 * O wrapper `.lex-page-shell` / `.lex-page-inner` é aplicado em `AppChrome` — não repetir nas páginas.
 */

/** Título H1 das páginas de app (Casos, Documentos, Biblioteca, …). */
export const lexPageTitleClassName = "lex-page-title";

/** Parágrafo introdutório sob o título. */
export const lexPageLeadClassName = "lex-page-lead";

/** CTA / link em vidro (ex.: «Novo caso», EmptyState appearance glass). */
export const lexGlassCtaClassName = "lex-glass-cta";

/* —— Tipografia semântica P1 (`text-micro` … `text-readable` + aliases `text-lex-*`) —— */

/** H2 dentro de cartão vidro (ex.: briefing «Casos por fluxo»). */
export const lexTypeSectionHeadingClassName = "text-section font-medium text-[color:var(--text-primary)]";

/** H3 / rótulo de fase em lista (uppercase curto — 11px). */
export const lexTypePhaseHeadingClassName =
  "text-micro font-semibold uppercase tracking-wide text-[color:var(--text-muted)]";

/** Título de bloco no rail direito (Ações rápidas, Consultar, …). */
export const lexTypeRailBlockTitleClassName =
  "text-micro font-medium uppercase tracking-wide text-[color:var(--text-muted)]";

/** Título de item em fila (mínimo 14px). */
export const lexTypeQueueItemTitleClassName = "text-sm font-medium text-[color:var(--text-primary)]";

/** Headline numérico / métrica em cartão pulso (15px). */
export const lexTypeMetricHeadlineClassName =
  "text-control font-semibold leading-snug tracking-tight text-[color:var(--text-primary)]";

/** Linhas de detalhe sob métrica (frases — 14px). */
export const lexTypeMetricDetailClassName = "text-sm leading-snug text-[color:var(--text-secondary)]";

/** Título principal em card de lista (17px → 18px em md). */
export const lexTypeCardTitleClassName =
  "text-readable font-semibold leading-snug tracking-tight text-[color:var(--text-primary)] md:text-lg";

/** Painel interior (código, sub-blocos) — sem vidro completo. */
export const lexInsetPanelClassName =
  "rounded-xl border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-secondary)]";

/**
 * Base sólida para blocos em `loading.tsx` — sem glass; compor com `rounded-*`, padding, layout.
 * Mantém o mesmo “peso” visual dos cartões opacos (evita vidro/desfoque durante o carregamento).
 */
export const lexRouteSkeletonSurfaceClassName =
  "border-[0.5px] border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)]";

/** Cartão de loading padrão (cantos `2xl`, como listas principais). */
export const lexRouteSkeletonPanelClassName = `${lexRouteSkeletonSurfaceClassName} rounded-2xl`;

/** Superfície de popover (dropdown, menus). */
export const lexPopoverClassName =
  "border-[0.5px] border-[color:var(--glass-border)] bg-[color:var(--surface-elevated)] text-[color:var(--text-primary)] shadow-lg backdrop-blur-xl";
