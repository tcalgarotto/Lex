import { requireObservabilityViewPage } from "@/lib/auth/session";

export default async function CockpitLayout({ children }: { children: React.ReactNode }) {
  await requireObservabilityViewPage();
  return <>{children}</>;
}
