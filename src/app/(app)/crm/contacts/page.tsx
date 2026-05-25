import Link from "next/link";
import { listCrmContacts } from "@/lib/justos/crm/contact-service";
import { isCrmPageAllowed } from "@/lib/justos/crm-page-guard";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CrmContactForm } from "@/components/crm/crm-contact-form";
import { CrmContactList } from "@/components/crm/crm-contact-list";
import { CrmProGateEmptyState } from "@/components/crm/crm-pro-gate";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CrmContactsPage() {
  if (!(await isCrmPageAllowed())) {
    return (
      <div className="space-y-6 p-6">
        <CrmProGateEmptyState />
      </div>
    );
  }

  const { workspaceId } = await getWorkspaceContext();
  const { items } = await listCrmContacts({ workspaceId, filters: { limit: 100 } });

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Contatos CRM</h1>
          <p className="text-sm text-muted-foreground">
            Relacionamento por escritório — JustOS Pro
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/crm/pipeline">Pipeline</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href="/crm/inbox">Inbox</Link>
          </Button>
        </div>
      </div>
      <CrmContactForm />
      <CrmContactList contacts={items} />
    </div>
  );
}
