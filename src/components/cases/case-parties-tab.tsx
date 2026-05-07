import type { CaseParty } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  AUTHOR: "Autor",
  DEFENDANT: "Réu",
  INTERVENING: "Terceiro",
  OTHER: "Outro",
};

const KIND_LABEL: Record<string, string> = {
  PERSON: "Pessoa Física",
  COMPANY: "Pessoa Jurídica",
  PUBLIC_ENTITY: "Ente Público",
  UNKNOWN: "—",
};

export function CasePartiesTab({ parties }: { parties: CaseParty[] }) {
  if (!parties.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Nenhuma parte cadastrada.</Card>;
  }
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {parties.map((p) => (
        <Card key={p.id} className="p-3">
          <div className="flex items-center justify-between">
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              {ROLE_LABEL[p.role] ?? p.role}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
              {KIND_LABEL[p.kind] ?? p.kind}
            </Badge>
          </div>
          <h3 className="mt-2 text-sm font-medium">{p.name}</h3>
          {p.document ? (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.document}</p>
          ) : null}
        </Card>
      ))}
    </div>
  );
}
