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

  const showIntakeFallback =
    !props.intakeStructured && props.intakeDerived && (relationalEmpty || props.intakeDerived.parties.length > 0);

  return (
    <div className="space-y-6">
      {showIntakeFallback ? (
        <>
          <IntakeOrganizeBanner caseId={props.caseId} showOrganizeCta />
          <CaseIntakeDerivedSections display={props.intakeDerived!} />
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
      ) : !showIntakeFallback ? (
        <p className="text-sm text-muted-foreground">
          Nenhum dado em partes, fatos, pedidos ou riscos. Complete a entrevista ou organize com Lex
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
