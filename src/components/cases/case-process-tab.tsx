"use client";

import Link from "next/link";
import { Scale } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { isCasePreProcessual } from "@/lib/cases/labels";
import type { Case } from "@prisma/client";

export type CaseLinkedProcess = {
  id: string;
  processId: string | null;
  cnjFormatted: string;
  tribunalAcronym: string | null;
  classeNome: string | null;
  dataJudStatus: string | null;
  movementCount: number;
  alertCount: number;
};

type CaseProcessTabProps = {
  caseId: string;
  caseRecord: Pick<Case, "title" | "processNumber" | "processId" | "metadataJson">;
  legalProcesses: CaseLinkedProcess[];
};

/**
 * Processo judicial é opcional: só vincular CNJ/tribunal/vara quando já existir autos.
 */
export function CaseProcessTab({ caseId, caseRecord, legalProcesses }: CaseProcessTabProps) {
  const pre = isCasePreProcessual(caseRecord);
  const importHref = `/processos?returnCase=${caseId}`;

  if (legalProcesses.length === 0) {
    return (
      <EmptyState
        icon={<Scale className="size-5" />}
        title={pre ? "Caso pré-processual" : "Nenhum processo vinculado"}
        description={
          pre
            ? "Este caso ainda não tem número CNJ. Quando o cliente ajuizar ou já houver autos, importe o processo aqui — sem obrigar no cadastro inicial."
            : "Vincule um processo existente pelo número CNJ para acompanhar movimentações e prazos neste caso."
        }
      >
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Button asChild size="sm">
            <Link href={importHref}>Importar ou vincular CNJ</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/cases/${caseId}/entrevista`}>Atualizar entrevista</Link>
          </Button>
        </div>
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">
            Processos judiciais ligados a este caso. O caso continua válido mesmo sem CNJ.
          </p>
          {pre ? (
            <Badge variant="outline" className="text-[10px]">
              Pré-processual · CNJ opcional
            </Badge>
          ) : null}
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href={importHref}>Vincular outro CNJ</Link>
        </Button>
      </div>

      <ul className="grid gap-3 sm:grid-cols-1">
        {legalProcesses.map((process) => {
          const href = `/processos/${process.processId ?? process.id}`;
          return (
            <li key={process.id}>
              <Card className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <Link href={href} className="font-medium hover:underline">
                      {process.cnjFormatted}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {process.tribunalAcronym ?? "Tribunal não informado"}
                      {process.classeNome ? ` · ${process.classeNome}` : ""}
                    </p>
                    {process.dataJudStatus ? (
                      <p className="mt-1 text-caption text-muted-foreground">Status: {process.dataJudStatus}</p>
                    ) : null}
                    <p className="mt-2 text-caption text-muted-foreground">
                      {process.movementCount} movimentação(ões) · {process.alertCount} alerta(s)
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={href}>Abrir processo</Link>
                  </Button>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
