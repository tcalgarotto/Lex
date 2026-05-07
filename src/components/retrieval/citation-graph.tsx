"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

type Node = { id: string; label: string; kind: string; group?: number };
type Edge = { from: string; to: string; kind: "in" | "out" | "rerank" };

type CitationGraphProps = {
  nodes: Node[];
  edges: Edge[];
  /** id do nó "principal" (em destaque). */
  rootId?: string;
};

/**
 * Grafo de citações renderizado como SVG nativo, sem dependências.
 *
 * Layout: nó raiz no centro, vizinhos em órbita radial (com pequena variação
 * de raio por kind pra dar hierarquia visual). É leve, determinístico e
 * acessível (cada nó vira um <g>).
 */
export function CitationGraph({ nodes, edges, rootId }: CitationGraphProps) {
  const layout = useMemo(() => computeRadialLayout(nodes, rootId), [nodes, rootId]);
  if (nodes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">
        Nenhuma norma para mapear ainda.
      </div>
    );
  }

  const W = 560;
  const H = 360;
  return (
    <div className="relative overflow-hidden rounded-xl border bg-card/40 backdrop-blur-sm">
      <div className="border-b border-white/5 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cadeia normativa
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[360px] w-full">
        <defs>
          <marker
            id="arrow-out"
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="rgb(56 189 248)" />
          </marker>
          <marker id="arrow-in" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 Z" fill="rgb(244 114 182)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const a = layout.find((n) => n.id === e.from);
          const b = layout.find((n) => n.id === e.to);
          if (!a || !b) return null;
          const stroke =
            e.kind === "out" ? "rgb(56 189 248 / 0.7)" : e.kind === "in" ? "rgb(244 114 182 / 0.7)" : "rgb(148 163 184 / 0.5)";
          const marker = e.kind === "out" ? "url(#arrow-out)" : e.kind === "in" ? "url(#arrow-in)" : undefined;
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={stroke}
              strokeWidth={1.4}
              markerEnd={marker}
            />
          );
        })}

        {layout.map((n) => {
          const isRoot = n.id === rootId;
          const fill = isRoot ? "rgb(99 102 241)" : "rgb(30 41 59 / 0.85)";
          const stroke = isRoot ? "rgb(165 180 252)" : kindStrokeColor(n.kind);
          const r = isRoot ? 22 : 16;
          return (
            <g key={n.id}>
              <circle cx={n.x} cy={n.y} r={r} fill={fill} stroke={stroke} strokeWidth={2} />
              <text
                x={n.x}
                y={n.y + r + 12}
                textAnchor="middle"
                className="fill-current"
                style={{ fontSize: 10, fontWeight: 600, fill: isRoot ? "rgb(199 210 254)" : "rgb(203 213 225)" }}
              >
                {trimLabel(n.label, 22)}
              </text>
              <title>{`${n.label} (${n.kind})`}</title>
            </g>
          );
        })}
      </svg>
      <Legend />
    </div>
  );
}

function trimLabel(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function kindStrokeColor(kind: string): string {
  if (kind.startsWith("SUMULA")) return "rgb(245 158 11)"; // amber
  if (kind.startsWith("JURISPRUDENCE")) return "rgb(244 114 182)"; // rose
  if (kind === "CONSTITUTION") return "rgb(99 102 241)"; // indigo
  return "rgb(148 163 184)"; // slate
}

function computeRadialLayout(nodes: Node[], rootId?: string): Array<Node & { x: number; y: number }> {
  const cx = 280;
  const cy = 180;
  const radiusOuter = 130;
  const radiusInner = 70;

  const root = rootId ? nodes.find((n) => n.id === rootId) ?? null : null;
  const others = nodes.filter((n) => n !== root);

  const positioned: Array<Node & { x: number; y: number }> = [];
  if (root) positioned.push({ ...root, x: cx, y: cy });

  others.forEach((n, i) => {
    const angle = (i / Math.max(1, others.length)) * Math.PI * 2;
    const r = n.kind.startsWith("SUMULA") || n.kind === "CONSTITUTION" ? radiusOuter : radiusInner + 30 * (i % 2);
    positioned.push({
      ...n,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
  });

  return positioned;
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/5 px-4 py-2 text-[11px] text-muted-foreground">
      <LegendDot color="rgb(99 102 241)" label="raiz / query" />
      <LegendDot color="rgb(56 189 248)" label="cita →" />
      <LegendDot color="rgb(244 114 182)" label="← citada por" />
      <LegendDot color="rgb(245 158 11)" label="súmula" />
    </div>
  );
}
function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("inline-block size-2.5 rounded-full")} style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
