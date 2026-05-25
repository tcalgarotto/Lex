import Link from "next/link";
import { cn } from "@/lib/utils";
import { PRODUCT_NAME } from "@/lib/brand/justos";
import { JustOSLogoMark } from "@/components/brand/justos-logo-mark";

type JustOSLogoProps = {
  href?: string;
  className?: string;
  markClassName?: string;
  showWordmark?: boolean;
  /** Marketing/header: evita violeta neon no scan Impeccable */
  markTone?: "brand" | "neutral";
  /** Rótulo acessível quando o link é só o logo */
  ariaLabel?: string;
};

export function JustOSLogo({
  href = "/#inicio",
  className,
  markClassName,
  showWordmark = true,
  markTone = "brand",
  ariaLabel,
}: JustOSLogoProps) {
  const inner = (
    <>
      <JustOSLogoMark
        tone={markTone}
        className={cn(
          "size-9",
          markTone === "neutral"
            ? "text-[color:var(--text-primary)]"
            : "text-[color:var(--brand-primary)]",
          markClassName,
        )}
      />
      {showWordmark ? (
        <span className="text-readable font-semibold tracking-tight text-[color:var(--text-primary)] md:text-lg">
          {PRODUCT_NAME}
        </span>
      ) : null}
    </>
  );

  const classes = cn(
    "inline-flex items-center gap-2.5 lex-transition hover:opacity-90",
    className,
  );

  if (!href) {
    return <span className={classes}>{inner}</span>;
  }

  return (
    <Link href={href} className={classes} aria-label={ariaLabel ?? `${PRODUCT_NAME} — início`}>
      {inner}
    </Link>
  );
}
