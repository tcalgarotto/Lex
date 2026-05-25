import type { CrmContact } from "@prisma/client";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

type Props = {
  contacts: CrmContact[];
};

export function CrmContactList({ contacts }: Props) {
  if (contacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum contato ainda. Use o formulário acima ou execute o backfill de clientes.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border">
      {contacts.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div>
            <p className="font-medium">{c.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {[c.phoneE164, c.email].filter(Boolean).join(" · ") || "Sem telefone/e-mail"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{c.kind}</Badge>
            <Badge variant="secondary">{c.pipelineStage}</Badge>
            {c.caseId ? (
              <Link href={`/cases/${c.caseId}`} className="text-xs text-primary hover:underline">
                Caso
              </Link>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
