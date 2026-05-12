"use client";

import { ClipboardCopy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SENTINEL_JOURNEYS } from "@/lib/test-guide/sentinel-journeys";

export function SentinelJourneysPanel() {
 return (
 <div className="grid gap-3">
 {SENTINEL_JOURNEYS.map((j) => (
 <Card key={j.id} className="p-4">
 <div className="flex flex-wrap items-start justify-between gap-2">
 <div className="min-w-0">
 <p className="text-sm font-medium">{j.label}</p>
 <p className="mt-1 text-xs text-muted-foreground">
 Queries sugeridas: {j.queries.join(" · ")} · Esperado: {j.expect.join(", ")}
 </p>
 </div>
 <Button
 type="button"
 size="sm"
 variant="outline"
 onClick={() => {
 void navigator.clipboard.writeText(j.relato);
 }}
 >
 <ClipboardCopy className="mr-2 size-4" />
 Copiar relato
 </Button>
 </div>
 <pre className="mt-3 whitespace-pre-wrap rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] p-3 text-xs text-muted-foreground">
 {j.relato}
 </pre>
 </Card>
 ))}
 </div>
 );
}
