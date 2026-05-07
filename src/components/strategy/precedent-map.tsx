"use client";

import type { DominantThesisGroup, LeadingPrecedent } from "@/lib/research/types";

type Props = {
  leaders: LeadingPrecedent[];
  groups: DominantThesisGroup[];
};

/** Mapa radial simples: centro = tese dominante, anéis = precedentes líderes. */
export function PrecedentMap({ leaders, groups }: Props) {
  const center = groups[0];
  const w = 340;
  const h = 260;
  const cx = w / 2;
  const cy = h / 2;
  const orbits = leaders.slice(0, 8);

  return (
    <div className="rounded-xl border border-white/10 bg-zinc-950/40 p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Mapa de precedentes
      </h3>
      <svg width={w} height={h} className="mx-auto font-mono text-[9px]">
        <defs>
          <radialGradient id="bgGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(99 102 241 / 0.25)" />
            <stop offset="100%" stopColor="rgb(24 24 27 / 0)" />
          </radialGradient>
        </defs>
        <rect width={w} height={h} fill="url(#bgGrad)" />
        <circle cx={cx} cy={cy} r={56} fill="rgb(63 63 70 / 0.5)" stroke="rgb(99 102 241 / 0.5)" strokeWidth={1} />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="rgb(228 228 231)" className="text-[10px]">
          {center ? center.identifier ?? center.title.slice(0, 24) : "—"}
        </text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="rgb(161 161 170)" className="text-[8px]">
          {center ? `${center.chunkIds.length} trechos` : "sem grupo"}
        </text>

        {orbits.map((p, i) => {
          const angle = (2 * Math.PI * i) / Math.max(orbits.length, 1);
          const r = 110;
          const x = cx + r * Math.cos(angle - Math.PI / 2);
          const y = cy + r * Math.sin(angle - Math.PI / 2);
          return (
            <g key={p.chunkId}>
              <line
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="rgb(99 102 241 / 0.35)"
                strokeWidth={1}
              />
              <circle cx={x} cy={y} r={22} fill="rgb(39 39 42 / 0.9)" stroke="rgb(168 85 247 / 0.45)" />
              <text x={x} y={y - 4} textAnchor="middle" fill="rgb(212 212 216)" className="text-[8px]">
                {p.tribunal ?? "?"}
              </text>
              <text x={x} y={y + 8} textAnchor="middle" fill="rgb(161 161 170)" className="text-[7px]">
                #{p.rank} · {p.score.toFixed(2)}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">
        Visualização determinística do ranking contextual (não substitui leitura integral dos acórdãos).
      </p>
    </div>
  );
}
