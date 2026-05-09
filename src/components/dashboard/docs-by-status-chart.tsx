"use client";

import type { DocumentStatus } from "@prisma/client";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const COLORS: Record<string, string> = {
  UPLOADED: "#64748b",
  PARSING: "#0ea5e9",
  CHUNKING: "#22d3ee",
  EMBEDDING: "#f59e0b",
  INDEXED: "#10b981",
  FAILED: "#ef4444",
};

export type DocStatusPoint = {
  /** Chave técnica (só para cor). */
  statusKey: DocumentStatus;
  /** Rótulo amigável no eixo X. */
  label: string;
  count: number;
};

export function DocsByStatusChart({ data }: { data: DocStatusPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <XAxis
          dataKey="label"
          stroke="rgba(255,255,255,0.4)"
          fontSize={10}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          width={32}
        />
        <Tooltip
          contentStyle={{
            background: "rgba(9,9,11,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          formatter={(value) => {
            const n = typeof value === "number" ? value : Number(value ?? 0);
            return [n.toLocaleString("pt-BR"), "Documentos"];
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.statusKey} fill={COLORS[d.statusKey] ?? "#a1a1aa"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
