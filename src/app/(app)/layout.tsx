import { redirect } from "next/navigation";
import { getAuthUser, getWorkspacesForUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";
import { WorkspaceProvider } from "@/components/app/workspace-context";

export default async function AppGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");
  const workspaceId = await resolveWorkspaceId(user.id);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { onboardingCompleted: true },
  });
  if (ws && !ws.onboardingCompleted) {
    redirect("/onboarding");
  }
  const workspaces = await getWorkspacesForUser();
  return <WorkspaceProvider value={workspaces}>{children}</WorkspaceProvider>;
}
