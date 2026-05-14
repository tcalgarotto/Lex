import Link from "next/link";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { BibliotecaPdfCover } from "@/components/biblioteca/biblioteca-pdf-cover";

function isPdfMime(mimeType: string, fileName: string): boolean {
  const mt = mimeType.toLowerCase();
  return mt.includes("pdf") || fileName.toLowerCase().endsWith(".pdf");
}

function shortKind(mimeType: string, fileName: string): string {
  if (isPdfMime(mimeType, fileName)) return "PDF";
  const mt = mimeType.toLowerCase();
  if (mt.includes("word") || fileName.toLowerCase().endsWith(".docx")) return "DOCX";
  if (mt.includes("text/plain") || fileName.toLowerCase().endsWith(".txt")) return "TXT";
  return "Arquivo";
}

export function BibliotecaOfficeDocumentCard({
  href,
  documentId,
  title,
  mimeType,
  caseTitle,
  publishedAt,
  thumbnailVersion,
  topBadge,
  showCaseRow = true,
  lqipLoading = "eager",
}: {
  href: string;
  documentId: string;
  title: string;
  mimeType: string;
  caseTitle: string | null;
  publishedAt: Date;
  /** Invalida cache do browser quando o registo do documento muda. */
  thumbnailVersion?: number;
  /** Se definido, substitui o rótulo da faixa (ex.: catálogo partilhado ou “Privado”). */
  topBadge?: string;
  /** Quando falso, não mostra linha de caso (ex.: catálogo sem vínculo). */
  showCaseRow?: boolean;
  /** Por omissão `eager` na biblioteca para o LQIP começar com o esqueleto; use `lazy` em grelhas muito grandes. */
  lqipLoading?: "eager" | "lazy";
}) {
  const pdf = isPdfMime(mimeType, title);
  const fileKind = shortKind(mimeType, title);
  const badgeLabel = topBadge ?? fileKind;
  const dateStr = publishedAt.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  /** Abrir PDF no leitor nativo noutro separador; evita prefetch de ficheiros grandes. */
  const openNativePdf = href.includes("/api/documents/") && href.endsWith("/file");

  return (
    <Link
      href={href}
      prefetch={openNativePdf ? false : undefined}
      target={openNativePdf ? "_blank" : undefined}
      rel={openNativePdf ? "noopener noreferrer" : undefined}
      title={openNativePdf ? "Abre no leitor do navegador (novo separador)" : undefined}
      className={cn(
        "group block min-w-0 w-full snap-start rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60",
      )}
    >
      <div className="lex-inset aspect-[3/4] w-full overflow-hidden rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay-strong)] shadow-inner">
        {pdf ? (
          <BibliotecaPdfCover
            documentId={documentId}
            label={title}
            className="size-full"
            thumbnailVersion={thumbnailVersion}
            lqipLoading={lqipLoading}
          />
        ) : (
          <div
            className="flex size-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-violet-600/30 via-slate-600/20 to-indigo-800/35 p-3 text-white/90"
            aria-hidden
          >
            <FileText className="size-10 opacity-85" />
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-90">{fileKind}</span>
          </div>
        )}
      </div>
      <div className="mt-3 min-w-0 space-y-1">
        <span className="inline-flex rounded-md bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200/95">
          {badgeLabel}
        </span>
        <p className="line-clamp-2 min-h-[3rem] text-sm font-semibold leading-snug text-[color:var(--text-primary)] group-hover:underline">
          {title}
        </p>
        {showCaseRow ? (
          caseTitle ? (
            <p className="line-clamp-1 text-xs text-muted-foreground">Caso: {caseTitle}</p>
          ) : (
            <p className="text-xs text-muted-foreground">Sem caso vinculado</p>
          )
        ) : null}
        <p className="text-xs text-muted-foreground">Adicionado em {dateStr}</p>
      </div>
    </Link>
  );
}
