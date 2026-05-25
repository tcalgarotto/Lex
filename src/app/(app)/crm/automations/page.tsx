import { CrmAutomationsClient } from "@/components/crm/crm-automations-client";

export default function CrmAutomationsPage() {
  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Automações</h1>
        <p className="text-sm text-muted-foreground">
          Regras tipo Salesbot para o escritório — boas-vindas, follow-up e prazos.
        </p>
      </div>
      <CrmAutomationsClient />
    </div>
  );
}
