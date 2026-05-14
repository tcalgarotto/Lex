import { requireObservabilityViewPage } from "@/lib/auth/session";
import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default async function StrategyLayout({ children }: { children: React.ReactNode }) {
  await requireObservabilityViewPage();
  return <LexPageFrame centerWidth="default">{children}</LexPageFrame>;
}
