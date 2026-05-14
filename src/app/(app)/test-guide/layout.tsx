import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default function TestGuideSegmentLayout({ children }: { children: React.ReactNode }) {
  return <LexPageFrame centerWidth="default">{children}</LexPageFrame>;
}
