import { MembershipRole } from "@prisma/client";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { hasAtLeast } from "@/lib/auth/permissions";
import { getMorningBriefingData } from "@/lib/dashboard/morning-briefing-data";
import { MorningBriefing } from "@/components/dashboard/morning-briefing";

/**
 * Briefing matinal — página principal do advogado no Lex.
 * Layout e hierarquia inspirados em `docs/model design/lex_home_dashboard_redesign.html`.
 */
export default async function DashboardPage() {
  const { user, workspaceId, role } = await getWorkspaceContextWithRole();
  const data = await getMorningBriefingData({
    workspaceId,
    userId: user.id,
    userEmail: user.email ?? "",
    isAdmin: role != null && hasAtLeast(role, MembershipRole.ADMIN),
  });

  return <MorningBriefing data={data} />;
}
