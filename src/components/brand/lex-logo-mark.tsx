import { cn } from "@/lib/utils";

/**
 * Marca Lex — frontão, coluna e balança em traço contínuo (referência jurídica discreta).
 */
export function LexLogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={cn(
        "shrink-0 text-[color:var(--violet-400)] drop-shadow-[0_1px_10px_rgba(124,58,237,0.22)]",
        className,
      )}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M8 13 L24 5 L40 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M24 13 L24 43"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M9 19 H39"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M12 19v6M36 19v6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5 27h14M29 27h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M5 27a7 7 0 0 0 14 0M29 27a7 7 0 0 0 14 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
