import Link from "next/link";
import { isCrmPageAllowed } from "@/lib/justos/crm-page-guard";
import { CrmProGateEmptyState } from "@/components/crm/crm-pro-gate";
import { CrmInboxClient } from "@/components/crm/crm-inbox-client";

export const dynamic = "force-dynamic";

export default async function CrmInboxPage() {
  if (!(await isCrmPageAllowed())) {
    return (
      <div className="p-6">
        <CrmProGateEmptyState />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">Inbox</h1>
          <p className="text-sm text-muted-foreground">WhatsApp do escritório — JustOS Pro CRM</p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link href="/crm/contacts" className="text-primary hover:underline">
            Contatos
          </Link>
          <Link href="/crm/pipeline" className="text-primary hover:underline">
            Pipeline
          </Link>
        </div>
      </div>
      <CrmInboxClient />
    </div>
  );
}
