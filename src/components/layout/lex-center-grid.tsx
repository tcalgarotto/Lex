import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type LexCenterGridProps = {
  children: ReactNode;
  /** Reservado para evolução; hoje só 4 colunas em xl+. */
  columns?: 4;
  className?: string;
};

/**
 * Grelha interna do trilho central (4 colunas em xl+; ver `globals.css` `.lex-layout-center-grid`).
 * Os filhos usam utilitários Tailwind `col-span-*` em breakpoints ≥ xl quando aplicável.
 */
export function LexCenterGrid({ children, columns: _columns = 4, className }: LexCenterGridProps) {
  return <div className={cn("lex-layout-center-grid", className)}>{children}</div>;
}
