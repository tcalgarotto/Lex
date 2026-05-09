"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TokenSeriesPoint = { date: string; tokens: number; costUsd: number };

export function TokenUsageChart({ data }: { data: TokenSeriesPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="lex-tokens" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.5} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis
          dataKey="date"
          stroke="rgba(255,255,255,0.4)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="rgba(255,255,255,0.4)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={(v: number) =>
            v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)
          }
        />
        <Tooltip
          contentStyle={{
            background: "rgba(9,9,11,0.95)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelStyle={{ color: "#e4e4e7" }}
          formatter={(value, name) => {
            const n = typeof value === "number" ? value : Number(value ?? 0);
            if (name === "tokens") return [n.toLocaleString("pt-BR"), "Atividade (referência)"];
            if (name === "costUsd") return [n.toFixed(4), "Economia interna (não é fatura)"];
            return [String(value ?? ""), String(name ?? "")];
          }}
        />
        <Area
          type="monotone"
          dataKey="tokens"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#lex-tokens)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
