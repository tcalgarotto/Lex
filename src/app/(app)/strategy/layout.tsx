import { requireObservabilityViewPage } from "@/lib/auth/session";

export default async function StrategyLayout({ children }: { children: React.ReactNode }) {
  await requireObservabilityViewPage();
  return <>{children}</>;
}
