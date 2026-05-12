import { MembershipRole } from "@prisma/client";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/app-shell";
import { requireRole } from "@/lib/auth/session";
import RoteirosSettingsClientPage from "./page.client";

export default async function RoteirosSettingsPage() {
 try {
 await requireRole([MembershipRole.OWNER, MembershipRole.ADMIN, MembershipRole.LAWYER]);
 } catch {
 notFound();
 }

 return (
 <AppShell title="Roteiros de entrevista">
 <RoteirosSettingsClientPage />
 </AppShell>
 );
}

