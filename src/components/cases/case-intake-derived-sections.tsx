import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { CaseDisplaySnapshot } from "@/lib/cases/intake/case-intake-context";

export function IntakeOrganizeBanner({
  caseId,
  showOrganizeCta,
}: {
  caseId: string;
  showOrganizeCta?: boolean;
}) {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
      <p>
        Este caso ainda não foi organizado automaticamente. As informações abaixo vêm da entrevista
        salva — não são análise jurídica completa.
      </p>
      {showOrganizeCta ? (
        <Button
          asChild
          variant="outline"
          size="sm"
          className="mt-3 border-violet-500/40 text-violet-100 hover:bg-violet-500/10"
        >
          <Link href={`/cases/${caseId}/entrevista`}>
            <Sparkles className="mr-2 size-4" />
            Organizar com JustOS AI
          </Link>
        </Button>
      ) : null}
    </div>
  );
}

function ReadOnlyList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border border-[color:var(--border-default)]/50 bg-white/[0.02] p-4">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <ul className="list-disc space-y-1 pl-4 text-sm leading-relaxed text-foreground">
        {items.map((item, i) => (
          <li key={`${title}-${i}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function CaseIntakeDerivedSections({ display }: { display: CaseDisplaySnapshot }) {
  const partyLines = display.parties.map((p) =>
    p.detail ? `${p.name} (${p.role}) — ${p.detail}` : `${p.name} (${p.role})`,
  );
  const factLines = display.facts.map((f) => (f.category ? `[${f.category}] ${f.text}` : f.text));
  const requestLines = display.requests.map((r) => r.text);
  const riskLines = display.risks.map((r) => `${r.title}: ${r.detail}`);
  const relationLines = display.partyRelations.map(
    (r) => `${r.from} → ${r.to}: ${r.relation}`,
  );

  const hasStructuredContent =
    partyLines.length > 0 ||
    factLines.length > 0 ||
    requestLines.length > 0 ||
    riskLines.length > 0;

  if (display.insufficient && !hasStructuredContent) {
    return (
      <Card className="border-dashed p-4">
        <p className="text-sm font-medium text-foreground">Informação insuficiente</p>
        <p className="mt-1 text-sm text-muted-foreground">
          A entrevista ainda não traz elementos mínimos para estruturar partes e fatos. Complete o
          relato na aba Entrevista ou organize com JustOS AI.
        </p>
        {display.pendingQuestions.length > 0 ? (
          <ReadOnlyList title="Perguntas pendentes" items={display.pendingQuestions} />
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {display.source === "intake_structured"
          ? "Vista estruturada pela JustOS AI (somente leitura). Confirme itens marcados como sugeridos antes de citar em peça."
          : "Vista derivada da entrevista salva (somente leitura). Organize com JustOS AI para editar em tabelas."}
      </p>

      <ReadOnlyList title="Partes" items={partyLines} />
      <ReadOnlyList title="Fatos" items={factLines} />
      <ReadOnlyList title="Pedidos" items={requestLines} />
      <ReadOnlyList title="Riscos / alertas" items={riskLines} />
      <ReadOnlyList title="Relação entre partes" items={relationLines} />
      <ReadOnlyList title="Provas mencionadas" items={display.evidenceMentioned} />
      <ReadOnlyList title="Lacunas" items={display.gaps} />
      <ReadOnlyList title="Perguntas pendentes" items={display.pendingQuestions} />
      <ReadOnlyList title="Confirmar com o cliente" items={display.needsConfirmation} />
      <ReadOnlyList title="Próximos passos" items={display.nextSteps} />
    </div>
  );
}
