import { cn } from "@/lib/utils";

const GRAD_ID = "lex-wordmark-grad";
const GLOW_ID = "lex-wordmark-glow";

/**
 * Logótipo textual «LEX» em vetor — traços geométricos com cantos redondos,
 * gradiente violeta→ciano (referência IA) e um nó luminoso (sinal discreto).
 */
export function LexWordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 92 22"
      className={cn(
        "h-[1.125rem] w-[4.75rem] shrink-0 drop-shadow-[0_0_14px_rgba(124,58,237,0.18)] md:h-5 md:w-[5.5rem]",
        className,
      )}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <linearGradient id={GRAD_ID} x1="0" y1="0" x2="92" y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#c4b5fd" />
          <stop offset="45%" stopColor="#818cf8" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <filter id={GLOW_ID} x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="0.8" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g
        stroke={`url(#${GRAD_ID})`}
        strokeWidth="3.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        filter={`url(#${GLOW_ID})`}
      >
        <path d="M 4 3.5 V 18.5 H 19" />
        <path d="M 27 3.5 H 44.5 M 27 3.5 V 18.5 H 44.5 M 27 11.25 H 39 M 27 18.5 H 44.5" />
        <path d="M 53.5 3.5 L 69.5 18.5 M 69.5 3.5 L 53.5 18.5" />
      </g>

      <circle cx="82" cy="11" r="2.15" fill={`url(#${GRAD_ID})`} opacity={0.95} />
      <circle cx="82" cy="11" r="4.5" stroke={`url(#${GRAD_ID})`} strokeWidth="0.75" opacity={0.35} fill="none" />
    </svg>
  );
}
