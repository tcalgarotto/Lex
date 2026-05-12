import { redirect } from "next/navigation";
import { getAuthUserAndSync, getWorkspacesForUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { resolveWorkspaceId } from "@/lib/auth/workspace";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { AppChrome } from "@/components/app/app-shell";

export default async function AppGroupLayout({
 children,
}: {
 children: React.ReactNode;
}) {
 const user = await getAuthUserAndSync();
 if (!user) redirect("/login");
 const workspaceId = await resolveWorkspaceId(user.id);
 
 const [ws, workspaces] = await Promise.all([
   prisma.workspace.findUnique({
     where: { id: workspaceId },
     select: { onboardingCompleted: true },
   }),
   getWorkspacesForUser(),
 ]);

 if (ws && !ws.onboardingCompleted) {
   redirect("/onboarding");
 }

 return (
   <WorkspaceProvider value={workspaces}>
     <AppChrome>{children}</AppChrome>
   </WorkspaceProvider>
 );
}
