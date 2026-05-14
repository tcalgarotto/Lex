import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default function ApresentacaoSegmentLayout({ children }: { children: React.ReactNode }) {
  return <LexPageFrame centerWidth="default">{children}</LexPageFrame>;
}
