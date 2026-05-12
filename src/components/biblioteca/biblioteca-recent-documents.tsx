"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DocumentRowActions } from "@/components/documents/document-row-actions";
import {
 deriveDocumentDisplayStatus,
 type DocumentDisplayKind,
} from "@/lib/documents/status-display";

type DocRow = {
 id: string;
 originalName: string;
 status: import("@prisma/client").DocumentStatus;
 updatedAt: Date | string;
 processId: string | null;
 caseId: string | null;
 case: { id: string; title: string } | null;
};

type CaseRef = { id: string; title: string };

const KIND_TONE: Record<DocumentDisplayKind, string> = {
 ok: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
 progress: "border-blue-500/30 bg-blue-500/10 text-blue-200",
 warning: "border-amber-500/30 bg-amber-500/10 text-amber-200",
 error: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

export function BibliotecaRecentDocuments({
 documents,
 cases,
}: {
 documents: DocRow[];
 cases: CaseRef[];
}) {
 if (documents.length === 0) {
 return (
 <p className="text-sm text-muted-foreground">
 Nenhum insumo recente.{" "}
 <Link href="/documentos" className="text-violet-300 underline-offset-2 hover:underline">
 Ir para Documentos
 </Link>
 </p>
 );
 }

 return (
 <ul className="space-y-2">
 {documents.map((d) => {
 const status = deriveDocumentDisplayStatus(d);
 return (
 <li key={d.id}>
 <Card className="p-3">
 <div className="flex flex-wrap items-start justify-between gap-3">
 <div className="min-w-0 flex-1 space-y-1">
 <p className="truncate font-medium">{d.originalName}</p>
 <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
 <Badge variant="outline" className={`text-[10px] ${KIND_TONE[status.kind]}`}>
 {status.label}
 </Badge>
 {d.case ? (
 <Link
 href={`/cases/${d.case.id}`}
 className="text-violet-300 hover:underline"
 >
 {d.case.title}
 </Link>
 ) : (
 <Badge variant="outline" className="text-[10px]">
 Sem caso
 </Badge>
 )}
 </div>
 </div>
 <DocumentRowActions
 documentId={d.id}
 processId={d.processId}
 caseId={d.caseId}
 cases={cases}
 />
 </div>
 </Card>
 </li>
 );
 })}
 </ul>
 );
}
