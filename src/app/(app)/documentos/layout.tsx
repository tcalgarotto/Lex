import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default function DocumentosSegmentLayout({ children }: { children: React.ReactNode }) {
  return <LexPageFrame centerWidth="wide">{children}</LexPageFrame>;
}
