import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default function ProcessosSegmentLayout({ children }: { children: React.ReactNode }) {
  return <LexPageFrame centerWidth="wide">{children}</LexPageFrame>;
}
