import type { ReactNode } from "react";

/**
 * Coluna do rail direito do detalhe do caso: empilha cartões/painéis sem grelha local.
 * Para adicionar um novo cartão, inclua-o como irmão dentro de `rightRail` em `cases/[id]/layout.tsx`.
 */
export function CaseDetailRightRail({ children }: { children: ReactNode }) {
  return <div className="flex w-full min-w-0 flex-col gap-4 [&>*]:min-w-0">{children}</div>;
}
