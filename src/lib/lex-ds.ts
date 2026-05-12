/**
 * Lex Design System — strings de classe partilhadas.
 * Documentação: docs/DESIGN_SYSTEM.md
 */

/** CTA / link em vidro (ex.: “Novo caso”, EmptyState appearance glass). */
export const lexGlassCtaClassName =
  "lex-glass-card inline-flex h-11 shrink-0 items-center justify-center rounded-2xl px-6 text-[15px] font-semibold text-[color:var(--text-primary)] outline-none lex-transition dark:text-white focus-visible:ring-2 focus-visible:ring-[color:var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-base)]";

/** Painel interior (código, sub-blocos) — sem vidro completo. */
export const lexInsetPanelClassName =
  "rounded-xl border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] text-[color:var(--text-secondary)]";

/** Superfície de popover (dropdown, menus). */
export const lexPopoverClassName =
  "border-[0.5px] border-[color:var(--glass-border)] bg-[color:var(--surface-elevated)] text-[color:var(--text-primary)] shadow-lg backdrop-blur-xl";
