import { MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { getDashboardViewModel } from "@/lib/dashboard/dashboard-service";
import { JustosDashboardView } from "@/components/dashboard/justos-dashboard-view";
import { devLogLexTiming } from "@/lib/dev/server-timing";

/**
 * Cockpit operacional JustOS — full-width, quadro ágil, sidebar fixa no shell global.
 */
export default async function DashboardPage() {
  const t0 = performance.now();
  const { user, workspaceId, role } = await getWorkspaceContextWithRole();

  const vm = await getDashboardViewModel({
    workspaceId,
    userId: user.id,
    userEmail: user.email ?? "",
    userMetadata: user.user_metadata,
    role: role as MembershipRole | null,
  });

  devLogLexTiming("dashboard.agileViewModel", performance.now() - t0);

  return <JustosDashboardView vm={vm} workspaceId={workspaceId} />;
}
