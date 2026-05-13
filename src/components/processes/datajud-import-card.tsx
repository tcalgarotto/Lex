"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatCnj } from "@/lib/cnj";

type AutocompleteResult = {
  id: string;
  processId: string | null;
  cnjFormatted: string;
  tribunalAcronym: string;
  classeNome: string | null;
  orgaoJulgadorNome: string | null;
  remote?: boolean;
};

export function DataJudImportCard({ returnCaseId }: { returnCaseId?: string | null }) {
  const router = useRouter();
  const [cnj, setCnj] = React.useState("");
  const [tribunal, setTribunal] = React.useState("");
  const [status, setStatus] = React.useState<string>("Informe o CNJ para identificar o tribunal.");
  const [results, setResults] = React.useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const digits = cnj.replace(/\D+/g, "");

  React.useEffect(() => {
    const timer = window.setTimeout(async () => {
      if (digits.length < 7) {
        setResults([]);
        setStatus("Informe ao menos 7 dígitos para buscar.");
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/processes/autocomplete-cnj", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: digits, tribunalAcronym: tribunal || undefined }),
        });
        const json = (await res.json()) as { results?: AutocompleteResult[]; remoteChecked?: boolean };
        setResults(json.results ?? []);
        setStatus(json.remoteChecked ? "DataJud consultado." : "Busca local pronta. DataJud será consultado na importação.");
      } catch {
        setStatus("Não foi possível consultar sugestões agora.");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [digits, tribunal]);

  async function importByCnj() {
    if (digits.length !== 20) {
      setStatus("Informe um CNJ com 20 dígitos.");
      return;
    }
    setImporting(true);
    try {
      const res = await fetch("/api/processes/import-by-cnj", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cnj: digits,
          caseId: returnCaseId || undefined,
          tribunalAcronym: tribunal || undefined,
        }),
      });
      const json = (await res.json()) as { processId?: string; error?: string; tribunal?: string; importedMovements?: number };
      if (!res.ok || !json.processId) {
        setStatus(json.error ?? "Falha ao importar processo.");
        return;
      }
      setStatus(`Tribunal identificado: ${json.tribunal}. Movimentações importadas: ${json.importedMovements ?? 0}.`);
      router.push(`/processos/${json.processId}`);
      router.refresh();
    } catch {
      setStatus("Falha ao importar processo.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importar processo via DataJud</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <Label htmlFor="datajud-cnj">Número CNJ</Label>
          <Input
            id="datajud-cnj"
            value={cnj}
            onChange={(event) => setCnj(event.target.value)}
            onBlur={(event) => setCnj(formatCnj(event.currentTarget.value))}
            placeholder="0000000-00.0000.0.00.0000"
            inputMode="numeric"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="datajud-tribunal">Tribunal manual (opcional)</Label>
          <Input
            id="datajud-tribunal"
            value={tribunal}
            onChange={(event) => setTribunal(event.target.value.toUpperCase())}
            placeholder="TJRS, TRF4, TRT12..."
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={importByCnj} disabled={importing}>
            {importing ? "Importando..." : "Importar do DataJud"}
          </Button>
          <Badge variant="outline">{loading ? "Buscando..." : status}</Badge>
        </div>
        {results.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase text-muted-foreground">Sugestões</p>
            {results.slice(0, 6).map((result) => (
              <button
                key={`${result.remote ? "remote" : "local"}-${result.id}`}
                type="button"
                onClick={() => {
                  setCnj(formatCnj(result.cnjFormatted));
                  if (result.tribunalAcronym) setTribunal(result.tribunalAcronym);
                }}
                className="w-full rounded-lg border border-[color:var(--border-default)] p-3 text-left text-sm hover:bg-[color:var(--surface-overlay)]"
              >
                <span className="font-medium">{formatCnj(result.cnjFormatted)}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {result.tribunalAcronym} {result.remote ? "DataJud" : "local"}
                </span>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[result.classeNome, result.orgaoJulgadorNome].filter(Boolean).join(" · ") || "Sem detalhes adicionais"}
                </p>
              </button>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
