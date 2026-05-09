import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type EmptyStateAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: "default" | "outline" | "ghost" | "secondary";
};

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: EmptyStateAction;
  secondaryAction?: EmptyStateAction;
  /** Quando true, ocupa toda a coluna disponível com altura mínima maior. */
  fullHeight?: boolean;
  /** Slot abaixo das actions, para componentes custom (ex.: upload button). */
  children?: React.ReactNode;
}

function ActionButton({ action }: { action: EmptyStateAction }) {
  const variant = action.variant ?? "default";
  if (action.href) {
    return (
      <Button asChild variant={variant} size="sm">
        <Link href={action.href}>{action.label}</Link>
      </Button>
    );
  }
  return (
    <Button type="button" variant={variant} size="sm" onClick={action.onClick}>
      {action.label}
    </Button>
  );
}

/**
 * EmptyState — placeholder visual padronizado para listas/tabs vazias.
 *
 * Usado em /cases (sem casos), /documentos (sem upload), /pesquisa-juridica
 * (estado inicial), /editor (sem peças) e nas tabs vazias de /cases/[id].
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  secondaryAction,
  fullHeight = false,
  children,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 px-6 py-10 text-center",
        fullHeight ? "min-h-[320px]" : "min-h-[180px]",
        className,
      )}
      {...rest}
    >
      {icon ? (
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900/80 text-zinc-300">
          {icon}
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-zinc-400">{description}</p>
      ) : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {action ? <ActionButton action={action} /> : null}
          {secondaryAction ? <ActionButton action={secondaryAction} /> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}
