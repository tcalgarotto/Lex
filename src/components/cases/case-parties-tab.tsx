"use client";

import { useState } from "react";
import type { CaseParty } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff } from "lucide-react";
import {
  CASE_PARTY_KIND_LABEL,
  CASE_PARTY_ROLE_LABEL,
} from "@/lib/cases/labels";
import { maybeMaskDocument, maybeMaskPhone } from "@/lib/format/pii";

function readPhone(p: CaseParty): string | null {
  const m = p.metadataJson as { phone?: unknown } | null | undefined;
  if (m && typeof m === "object" && typeof m.phone === "string") return m.phone;
  return null;
}

function readAddress(p: CaseParty): string | null {
  const m = p.metadataJson as { address?: unknown } | null | undefined;
  if (m && typeof m === "object" && typeof m.address === "string") return m.address;
  return null;
}

export function CasePartiesTab({ parties }: { parties: CaseParty[] }) {
  const [showFull, setShowFull] = useState(false);

  if (!parties.length) {
    return <Card className="p-4 text-sm text-muted-foreground">Nenhuma parte cadastrada.</Card>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowFull((v) => !v)}
          className="text-[11px] text-muted-foreground"
          aria-pressed={showFull}
        >
          {showFull ? (
            <>
              <EyeOff className="mr-1 size-3" /> Ocultar dados sensíveis
            </>
          ) : (
            <>
              <Eye className="mr-1 size-3" /> Mostrar dados completos
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {parties.map((p) => {
          const phone = readPhone(p);
          const address = readAddress(p);
          return (
            <Card key={p.id} className="p-3">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                  {CASE_PARTY_ROLE_LABEL[p.role] ?? p.role}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                  {CASE_PARTY_KIND_LABEL[p.kind] ?? p.kind}
                </Badge>
              </div>
              <h3 className="mt-2 text-sm font-medium">{p.name}</h3>
              {p.document ? (
                <p
                  className="mt-0.5 font-mono text-[11px] text-muted-foreground"
                  data-testid="party-document"
                >
                  {maybeMaskDocument(p.document, showFull)}
                </p>
              ) : null}
              {phone ? (
                <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                  {maybeMaskPhone(phone, showFull)}
                </p>
              ) : null}
              {address ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {showFull ? address : address.replace(/\d/g, "•")}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
