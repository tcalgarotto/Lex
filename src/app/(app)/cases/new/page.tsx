import FundamentalIntakeFormContent from "@/components/cases/fundamental-intake-form";
import { LexPageFrame } from "@/components/layout/lex-page-frame";
import { getWorkspaceContext } from "@/lib/auth/session";
import type { FundamentalIntakeForm } from "@/lib/cases/fundamental-intake/form-schema";
import {
  isFundamentalIntakeStructured,
  parseFundamentalIntakeFromMetadata,
} from "@/lib/cases/case-intake-source";
import { loadCaseForWorkspace } from "../[id]/_load-case";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewCasePage({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const raw = sp["continue"];
  const continueId =
    typeof raw === "string" ? raw.trim() : Array.isArray(raw) && typeof raw[0] === "string" ? raw[0].trim() : "";

  let seedCaseId: string | null = null;
  let seedForm: FundamentalIntakeForm | null = null;
  let intakeAlreadyOrganized = false;

  if (continueId.length > 0) {
    const { workspaceId } = await getWorkspaceContext();
    const c = await loadCaseForWorkspace(workspaceId, continueId);
    if (c) {
      const meta = c.metadataJson;
      const parsed = parseFundamentalIntakeFromMetadata(meta);
      if (parsed) {
        seedCaseId = c.id;
        seedForm = parsed;
        intakeAlreadyOrganized = isFundamentalIntakeStructured(meta);
      }
    }
  }

  return (
    <LexPageFrame centerWidth="wide">
      <FundamentalIntakeFormContent
        seedCaseId={seedCaseId}
        seedForm={seedForm}
        intakeAlreadyOrganized={intakeAlreadyOrganized}
      />
    </LexPageFrame>
  );
}
