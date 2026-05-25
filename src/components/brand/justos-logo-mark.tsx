import { cn } from "@/lib/utils";

/**
 * Marca JustOS — coluna e balança em traço contínuo (restrained, herda cor do contexto).
 */
export function JustOSLogoMark({
  className,
  tone = "brand",
}: {
  className?: string;
  tone?: "brand" | "neutral";
}) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="4"
        y="4"
        width="32"
        height="32"
        rx="9"
        className={
          tone === "neutral"
            ? "fill-[color:var(--surface-elevated)] stroke-[color:var(--border-default)]"
            : "fill-[color:var(--brand-subtle)] stroke-[color:var(--brand-border)]"
        }
        strokeWidth="1"
      />
      <path
        d="M12 14 L20 10 L28 14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 14 L20 30"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M11 18 H29"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M8 22 H16 M24 22 H32"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M8 22a6 6 0 0 0 8 0M24 22a6 6 0 0 0 8 0"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
