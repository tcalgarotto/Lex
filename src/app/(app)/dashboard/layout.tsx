import { LexCenterGrid } from "@/components/layout/lex-center-grid";
import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default function DashboardSegmentLayout({ children }: { children: React.ReactNode }) {
  return (
    <LexPageFrame centerWidth="wide">
      <LexCenterGrid>{children}</LexCenterGrid>
    </LexPageFrame>
  );
}
