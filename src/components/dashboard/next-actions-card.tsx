import Link from "next/link";
import { AlertTriangle, ArrowRight, Sparkles } from "lucide-react";
import {
 Card,
 CardContent,
 CardDescription,
 CardHeader,
 CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NextActionsBundle, NextActionTone } from "@/lib/dashboard/next-actions";

const TONE_BADGE: Record<NextActionTone, string> = {
 warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
 info: "border-violet-500/30 bg-violet-500/10 text-violet-200",
 ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
 muted: "border-[color:var(--border-default)] bg-white/5 text-muted-foreground",
};

export function NextActionsCard({ bundle }: { bundle: NextActionsBundle }) {
 const totalUrgent = bundle.totals.stalled;
 const totalReady =
 bundle.totals.unlinked +
 bundle.totals.readyForFacts +
 bundle.totals.casesNeedingStrategy;

 const visibleGroups = bundle.groups.filter(
 (g) => g.items.length > 0 || g.emptyText,
 );

 return (
 <Card>
 <CardHeader className="flex flex-row items-start justify-between gap-3">
 <div>
 <CardTitle className="flex items-center gap-2 text-base">
 <Sparkles className="size-4 text-violet-300" /> Próximas ações
 </CardTitle>
 <CardDescription>
 {totalUrgent > 0
 ? `${totalUrgent} item(ns) urgente(s) e ${totalReady} pendência(s) de fluxo.`
 : `${totalReady} pendência(s) no seu fluxo.`}
 </CardDescription>
 </div>
 <BasesAvailability bundle={bundle} />
 </CardHeader>
 <CardContent className="space-y-4">
 {visibleGroups.map((g) => (
 <section key={g.key} className="space-y-1.5">
 <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
 {g.title}
 {g.items.length > 0 ? ` · ${g.items.length}` : null}
 </h4>
 {g.items.length === 0 ? (
 <p className="rounded-md border border-dashed border-[color:var(--border-default)] px-3 py-2 text-[11px] text-muted-foreground">
 {g.emptyText}
 </p>
 ) : (
 <ul className="space-y-1">
 {g.items.map((it) => (
 <li key={it.id}>
 <Link
 href={it.href}
 className="flex items-start justify-between gap-2 rounded-md border border-[color:var(--border-subtle)] px-3 py-2 hover:bg-[color:var(--surface-overlay)]"
 >
 <div className="min-w-0 flex-1">
 <p className="truncate text-sm">
 {it.tone === "warning" ? (
 <AlertTriangle className="mr-1 inline size-3 -translate-y-px text-amber-300" />
 ) : null}
 {it.label}
 </p>
 {it.hint ? (
 <p className="text-[11px] text-muted-foreground">{it.hint}</p>
 ) : null}
 </div>
 <Badge
 variant="outline"
 className={`shrink-0 text-[10px] ${TONE_BADGE[it.tone]}`}
 >
 <ArrowRight className="size-3" />
 </Badge>
 </Link>
 </li>
 ))}
 </ul>
 )}
 </section>
 ))}
 </CardContent>
 </Card>
 );
}

function BasesAvailability({ bundle }: { bundle: NextActionsBundle }) {
 const items: Array<{ label: string; ok: boolean }> = [
 { label: "CF", ok: bundle.baseAvailability.cf },
 { label: "ADCT", ok: bundle.baseAvailability.adct },
 ];
 return (
 <div className="flex flex-wrap gap-1">
 {items.map((b) => (
 <Badge
 key={b.label}
 variant="outline"
 className={`text-[10px] ${
 b.ok
 ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-200"
 : "border-[color:var(--border-default)] text-muted-foreground"
 }`}
 >
 {b.label}
 </Badge>
 ))}
 </div>
 );
}
