import type { CaseFact, CaseParty, CaseRequest, CaseRisk } from "@prisma/client";
import { CaseFactsTab } from "./case-facts-tab";
import { CasePartiesTab } from "./case-parties-tab";
import { CaseRequestsTab } from "./case-requests-tab";
import { CaseRisksTab } from "./case-risks-tab";

/**
 * Aba agrupada "Fatos & Partes" — combina os 4 sub-componentes que antes
 * tinham abas próprias. Mantém os componentes existentes intactos.
 */
export function CaseFactsPartiesTab(props: {
  facts: CaseFact[];
  parties: CaseParty[];
  requests: CaseRequest[];
  risks: CaseRisk[];
}) {
  return (
    <div className="space-y-6">
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
