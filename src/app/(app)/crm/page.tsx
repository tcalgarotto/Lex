import Link from "next/link";
import { isCrmPageAllowed } from "@/lib/justos/crm-page-guard";
import { getCrmReportsOverview } from "@/lib/justos/crm/reports-service";
import { getWorkspaceContext } from "@/lib/auth/session";
import { CrmProGateEmptyState } from "@/components/crm/crm-pro-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function CrmHomePage() {
  if (!(await isCrmPageAllowed())) {
    return (
      <div className="p-6">
        <CrmProGateEmptyState />
      </div>
    );
  }

  const { workspaceId } = await getWorkspaceContext();
  const report = await getCrmReportsOverview(workspaceId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">JustOS Pro CRM</h1>
          <p className="text-sm text-muted-foreground">Painel operacional do escritório</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/crm/inbox">Inbox</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/crm/contacts">Contatos</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/crm/pipeline">Pipeline</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/crm/automations">Automações</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Mensagens (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{report.messagesLast7Days}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Conversas não lidas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{report.unreadConversations}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aguardando cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{report.contactsWaitingClient}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Funil</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {report.contactsByStage.map((s) => (
              <div key={s.stage} className="flex justify-between">
                <span>{s.stage}</span>
                <span>{s.count}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
