import Link from "next/link";
import { getCaseCrmSummary } from "@/lib/justos/crm/activity-service";
import { isCrmPageAllowed } from "@/lib/justos/crm-page-guard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  workspaceId: string;
  caseId: string;
};

export async function CrmCaseSummary({ workspaceId, caseId }: Props) {
  if (!(await isCrmPageAllowed())) return null;

  const summary = await getCaseCrmSummary(workspaceId, caseId);
  if (summary.contactCount === 0 && summary.recentMessages.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">CRM / Relacionamento</CardTitle>
        <CardDescription>
          {summary.contactCount} contato(s) · {summary.conversationCount} conversa(s)
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {summary.contacts.slice(0, 3).map((c) => (
          <p key={c.id}>
            <span className="font-medium">{c.displayName}</span>
            {c.phoneE164 ? (
              <span className="text-muted-foreground"> — {c.phoneE164}</span>
            ) : null}
          </p>
        ))}
        {summary.recentMessages.slice(0, 2).map((m) => (
          <p key={m.id} className="text-muted-foreground">
            {m.direction === "INBOUND" ? "←" : "→"} {m.contactName}: {m.bodyPreview}
          </p>
        ))}
        <Link href="/crm/contacts" className="text-xs text-primary hover:underline">
          Ver CRM
        </Link>
      </CardContent>
    </Card>
  );
}
