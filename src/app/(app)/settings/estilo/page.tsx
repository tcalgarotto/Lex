import { getWorkspaceContext } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { triggerStyleRecomputeAction } from "@/app/(app)/processos/actions";

export default async function EstiloPage() {
 const { workspaceId } = await getWorkspaceContext();
 const profile = await prisma.styleProfile.findFirst({ where: { workspaceId } });

 return (
 <Card className="w-full ">
 <CardHeader className="flex flex-row items-center justify-between">
 <CardTitle className="text-base">Style profile (JSON)</CardTitle>
 <form action={triggerStyleRecomputeAction}>
 <Button type="submit" size="sm" variant="secondary">
 Recalcular via Inngest
 </Button>
 </form>
 </CardHeader>
 <CardContent>
 <pre className="max-h-[480px] overflow-auto rounded-lg bg-[color:var(--surface-overlay-strong)] p-4 text-xs text-[color:var(--text-secondary)]">
 {JSON.stringify(profile?.profileJson ?? {}, null, 2)}
 </pre>
 {profile?.recurringPhrases?.length ? (
 <p className="mt-4 text-sm text-muted-foreground">
 Frases recorrentes: {profile.recurringPhrases.join(", ")}
 </p>
 ) : null}
 </CardContent>
 </Card>
 );
}
