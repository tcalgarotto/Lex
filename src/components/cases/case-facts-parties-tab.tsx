import type { CaseFact, CaseParty, CaseRequest, CaseRisk } from "@prisma/client";
import type { CaseDisplaySnapshot } from "@/lib/cases/intake/case-intake-context";
import { CaseFactsTab } from "./case-facts-tab";
import { CasePartiesTab } from "./case-parties-tab";
import { CaseRequestsTab } from "./case-requests-tab";
import { CaseRisksTab } from "./case-risks-tab";
import {
  CaseIntakeDerivedSections,
  IntakeOrganizeBanner,
} from "./case-intake-derived-sections";

/**
 * Aba agrupada "Fatos & Partes" — combina os 4 sub-componentes que antes
 * tinham abas próprias. Mantém os componentes existentes intactos.
 */
export function CaseFactsPartiesTab(props: {
  caseId: string;
  facts: CaseFact[];
  parties: CaseParty[];
  requests: CaseRequest[];
  risks: CaseRisk[];
  intakeStructured?: boolean;
  intakeDerived?: CaseDisplaySnapshot | null;
}) {
  const relationalEmpty =
    props.facts.length === 0 &&
    props.parties.length === 0 &&
    props.requests.length === 0 &&
    props.risks.length === 0;

  const derived = props.intakeDerived;
  const showIntakeFallback =
    !props.intakeStructured && derived && (relationalEmpty || derived.parties.length > 0 || derived.facts.length > 0);

  return (
    <div className="space-y-6">
      {derived?.insufficient && relationalEmpty ? (
        <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <p className="font-medium text-foreground">Informação insuficiente</p>
          <p className="mt-1 text-muted-foreground">
            Complete a entrevista ou organize com JustOS AI para estruturar partes, fatos e lacunas.
          </p>
          {derived.pendingQuestions.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-amber-100/90">
              {derived.pendingQuestions.slice(0, 8).map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {showIntakeFallback ? (
        <>
          <IntakeOrganizeBanner caseId={props.caseId} showOrganizeCta />
          <CaseIntakeDerivedSections display={derived!} />
        </>
      ) : null}

      {!relationalEmpty ? (
        <>
          <Section title={`Fatos · ${props.facts.length}`}>
            <CaseFactsTab facts={props.facts} />
          </Section>
          <Section title={`Partes · ${props.parties.length}`}>
            <CasePartiesTab parties={props.parties} />
          </Section>
          <Section title={`Pedidos · ${props.requests.length}`}>
            <CaseRequestsTab requests={props.requests} />
          </Section>
          <Section title={`Riscos · ${props.risks.length}`}>
            <CaseRisksTab risks={props.risks} />
          </Section>
        </>
      ) : !showIntakeFallback && !derived?.insufficient ? (
        <p className="text-sm text-muted-foreground">
          Nenhum dado em partes, fatos, pedidos ou riscos. Complete a entrevista ou organize com JustOS AI
          AI.
        </p>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}
