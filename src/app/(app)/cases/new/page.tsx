import FundamentalIntakeFormContent from "@/components/cases/fundamental-intake-form";
import { LexPageFrame } from "@/components/layout/lex-page-frame";

export default function NewCasePage() {
  return (
    <LexPageFrame centerWidth="wide">
      <FundamentalIntakeFormContent />
    </LexPageFrame>
  );
}
