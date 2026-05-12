/**
 * Lex Design System — nomes de classe (estilos em `src/app/globals.css`, @layer components).
 * Documentação: docs/DESIGN_SYSTEM.md
 *
 * O wrapper `.lex-page-shell` / `.lex-page-inner` é aplicado em `AppChrome` — não repetir nas páginas.
 */

/** Título H1 das páginas de app (Casos, Documentos, Biblioteca, …). */
export const lexPageTitleClassName = "lex-page-title";

/** Parágrafo introdutório sob o título. */
export const lexPageLeadClassName = "lex-page-lead";

/** CTA / link em vidro (ex.: «Novo caso», EmptyState appearance glass). */
export const lexGlassCtaClassName = "lex-glass-cta";

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
