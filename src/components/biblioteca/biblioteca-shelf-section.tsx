import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function BibliotecaShelfSection({
  id,
  title,
  subtitle,
  verMaisHref,
  verMaisLabel,
  children,
  className,
}: {
  id?: string;
  title: string;
  subtitle: string;
  verMaisHref: string;
  verMaisLabel: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      className={cn("lex-glass-card rounded-2xl p-4 md:p-5", className)}
    >
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <h2 className="text-lg font-semibold leading-snug tracking-tight text-[color:var(--text-primary)] md:text-xl">
            {title}
          </h2>
          <p className="max-w-2xl text-base leading-relaxed text-[color:var(--text-secondary)]">
            {subtitle}
          </p>
        </div>
        <Link
          href={verMaisHref}
          className="inline-flex h-11 shrink-0 items-center gap-1 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] px-4 text-[15px] font-medium text-[color:var(--text-secondary)] lex-transition hover:border-violet-500/35 hover:bg-violet-500/10 hover:text-[color:var(--text-primary)]"
        >
          {verMaisLabel}
          <ChevronRight className="size-3.5 opacity-70" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

/**
 * Faixa horizontal com várias obras lado a lado (largura ~148–172px cada), scroll em ecrãs estreitos
 * ou quando há muitos itens — igual ao comportamento original da Biblioteca.
 */
export function BibliotecaShelfCarousel({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative -mx-1 min-w-0">
      <div className="grid auto-cols-[minmax(148px,172px)] grid-flow-col gap-4 overflow-x-auto overscroll-x-contain px-1 pb-2 pt-1 [scrollbar-width:thin] snap-x snap-mandatory">
        {children}
      </div>
    </div>
  );
}
