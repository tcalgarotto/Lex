"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUiStore } from "@/stores/ui-store";
import { cn } from "@/lib/utils";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DocumentUploadButton } from "@/components/documents/document-upload-button";
import {
  LegalCurrencyInput,
  LegalDateInput,
  LegalMaskedInput,
  LegalSectionCard,
  LegalSelect,
  LegalTextarea,
  LegalTextInput,
} from "@/components/legal-form/legal-form";
import {
  IntakeMobileActionBar,
  IntakeSidebarPanel,
  IntakeStepper,
  IntakeStepperVertical,
  scrollToIntakeSection,
} from "@/components/cases/fundamental-intake-chrome";
import {
  SECTION_ANCHOR,
  cnjVisualError,
  interviewProgressPercent,
  isReadyForLexStructure,
  lacunaLabels,
  lexStructureBlockedReason,
  nextRecommendedSection,
  pendingRequiredLabels,
  sectionStatuses,
  toggleSectionConfirmed,
  type IntakeSectionId,
} from "@/components/cases/fundamental-intake-helpers";
import {
  createDefaultFundamentalIntakeForm,
  emptyOpposingPartyRow,
  emptyTimelineRow,
  parseFundamentalIntakeForm,
  type FundamentalIntakeForm,
} from "@/lib/cases/fundamental-intake/form-schema";
import { digitsOnly, maskCnpjInput, maskCpfInput, maskDateBrInput, parseBrDateToIso, formatIsoToBrDate } from "@/lib/forms/legal-input-masks";
import type { ZodIssue } from "zod";

function maskPartyDocument(raw: string): string {
  const d = digitsOnly(raw);
  if (d.length <= 11) return maskCpfInput(raw);
  return maskCnpjInput(raw);
}

const SECTION_SCROLL_ORDER: IntakeSectionId[] = [
  "attend",
  "client",
  "opposing",
  "third",
  "narrative",
  "timeline",
  "documents",
  "goals",
  "communication",
];

const NEXT_SECTION_LABEL: Record<IntakeSectionId, string> = {
  attend: "Atendimento",
  client: "Cliente / parte autora",
  opposing: "Parte contrária",
  third: "Terceiros",
  narrative: "Relato",
  timeline: "Linha do tempo",
  documents: "Provas e documentos",
  goals: "Objetivo e riscos",
  communication: "Comunicação",
};

function timelineDateFieldValue(raw: string): string {
  const t = raw?.trim() ?? "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return formatIsoToBrDate(t);
  return t;
}

function onTimelineDateInput(raw: string): string {
  const m = maskDateBrInput(raw);
  const iso = parseBrDateToIso(m);
  return iso || m;
}

function flattenZodIssues(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const p = i.path.join(".");
    if (!out[p]) out[p] = i.message;
  }
  return out;
}

type DocCheckKey = keyof NonNullable<FundamentalIntakeForm["documents"]["checklist"]>;

const DOC_GROUPS: Array<{ title: string; items: Array<{ key: DocCheckKey; label: string }> }> = [
  {
    title: "Identificação",
    items: [
      { key: "personalId", label: "Documento pessoal" },
      { key: "addressProof", label: "Comprovante de endereço" },
    ],
  },
  {
    title: "Contratos e pagamentos",
    items: [
      { key: "contract", label: "Contrato" },
      { key: "paymentProof", label: "Comprovante de pagamento" },
    ],
  },
  {
    title: "Conversas e comunicações",
    items: [
      { key: "whatsappPrints", label: "Prints WhatsApp" },
      { key: "emails", label: "E-mails" },
      { key: "protocols", label: "Protocolos / atendimentos" },
    ],
  },
  {
    title: "Imagens e mídias",
    items: [
      { key: "photos", label: "Fotos" },
      { key: "videos", label: "Vídeos" },
      { key: "audios", label: "Áudios" },
    ],
  },
  {
    title: "Documentos processuais",
    items: [
      { key: "policeReport", label: "BO / ocorrência" },
      { key: "courtOrder", label: "Decisão / intimação" },
      { key: "processNumber", label: "Autos ou peças do processo" },
    ],
  },
  {
    title: "Saúde, escola e outros",
    items: [
      { key: "medicalReport", label: "Laudo / documento médico" },
      { key: "schoolProof", label: "Documentos escolares" },
      { key: "other", label: "Outros documentos" },
    ],
  },
];

function sectionReviewFooter(
  section: IntakeSectionId,
  paths: string[] | undefined,
  onToggle: (on: boolean) => void,
) {
  const key = `section:${section}`;
  const checked = (paths ?? []).includes(key);
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm leading-relaxed text-[color:var(--text-secondary)]">
      <input
        type="checkbox"
        className="mt-1 size-4 shrink-0 rounded border border-[color:var(--border-default)] bg-transparent accent-violet-500"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <span>
        <span className="font-medium text-[color:var(--text-primary)]">Dados revisados pelo advogado</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-[color:var(--text-secondary)]">
          Marcado, o Lex evita sobrescrever estes dados automaticamente em versões futuras da IA.
        </span>
      </span>
    </label>
  );
}

export type FundamentalIntakeFormContentProps = {
  /** Continuação do mesmo caso (rascunho em `metadataJson.intakeForm`). */
  seedCaseId?: string | null;
  seedForm?: FundamentalIntakeForm | null;
  /**
   * `embedded` — formulário dentro de `/cases/[id]/entrevista`: sem coluna `fixed` em viewport
   * (evita sobrepor o rail direito do caso). `standalone` — `/cases/new` com layout completo.
   */
  mode?: "standalone" | "embedded";
};

export default function FundamentalIntakeFormContent(props: FundamentalIntakeFormContentProps = {}) {
  const { seedCaseId = null, seedForm = null, mode = "standalone" } = props;
  const isEmbedded = mode === "embedded";
  const router = useRouter();
  const [form, setForm] = React.useState<FundamentalIntakeForm>(() => createDefaultFundamentalIntakeForm());
  const [caseId, setCaseId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState<"draft" | "structure" | null>(null);
  const [clientErrors, setClientErrors] = React.useState<Record<string, string>>({});
  const [freeNarrativeExpanded, setFreeNarrativeExpanded] = React.useState(false);
  const [activeScrollSection, setActiveScrollSection] = React.useState<IntakeSectionId>("attend");

  const statuses = React.useMemo(() => sectionStatuses(form), [form]);
  const progress = React.useMemo(() => interviewProgressPercent(form), [form]);
  const pending = React.useMemo(() => pendingRequiredLabels(form), [form]);
  const lacunas = React.useMemo(() => lacunaLabels(form), [form]);
  const nextId = React.useMemo(() => nextRecommendedSection(form), [form]);
  const nextLabel = NEXT_SECTION_LABEL[nextId];

  const structureLocked = React.useMemo(() => !isReadyForLexStructure(form), [form]);
  const structureLockTitle = React.useMemo(() => lexStructureBlockedReason(form) ?? undefined, [form]);

  const cnjErr = cnjVisualError(form.attend.cnj);

  React.useEffect(() => {
    if (!seedCaseId && !seedForm) return;
    if (seedCaseId) setCaseId(seedCaseId);
    if (seedForm) {
      const parsed = parseFundamentalIntakeForm(seedForm);
      if (parsed.success) setForm(parsed.data);
    }
  }, [seedCaseId, seedForm]);

  const updateActiveSection = React.useCallback(() => {
    if (typeof window === "undefined") return;
    let best: IntakeSectionId = SECTION_SCROLL_ORDER[0]!;
    const anchorY = window.scrollY + Math.min(240, window.innerHeight * 0.26);
    for (const id of SECTION_SCROLL_ORDER) {
      const el = document.getElementById(SECTION_ANCHOR[id]);
      if (!el) continue;
      const top = el.getBoundingClientRect().top + window.scrollY;
      if (top <= anchorY) best = id;
    }
    setActiveScrollSection(best);
  }, []);

  React.useLayoutEffect(() => {
    updateActiveSection();
    const onScroll = () => updateActiveSection();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [updateActiveSection]);

  const err = React.useCallback(
    (path: string) => clientErrors[path],
    [clientErrors],
  );

  function patchForm(updater: (prev: FundamentalIntakeForm) => FundamentalIntakeForm) {
    setForm((prev) => updater(prev));
  }

  async function submit(action: "draft" | "structure") {
    setClientErrors({});
    const parsed = parseFundamentalIntakeForm(form);
    if (!parsed.success) {
      setClientErrors(flattenZodIssues(parsed.error.issues));
      toast.error("Revise os campos destacados antes de continuar.");
      return;
    }
    const payload = parsed.data;
    if (cnjVisualError(payload.attend.cnj)) {
      setClientErrors({ "attend.cnj": cnjVisualError(payload.attend.cnj)! });
      toast.error("Corrija o número CNJ antes de salvar.");
      return;
    }
    if (action === "structure" && !isReadyForLexStructure(payload)) {
      toast.error(
        lexStructureBlockedReason(form) ?? "Complete o formulário antes de estruturar com a Lex AI.",
      );
      return;
    }
    setLoading(action);
    try {
      const res = await fetch("/api/cases/fundamental-intake", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, caseId: caseId ?? undefined, form: payload }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
        issues?: { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> };
        case?: { id: string };
      };
      if (!res.ok) {
        const fe = body.issues?.fieldErrors;
        if (fe) {
          const flat: Record<string, string> = {};
          for (const [k, v] of Object.entries(fe)) {
            if (Array.isArray(v) && v[0]) flat[k] = v[0]!;
          }
          setClientErrors(flat);
        }
        const msg =
          body.error ??
          (res.status === 401
            ? "Não foi possível confirmar a sessão. Atualize a página ou entre novamente."
            : `Falha ao salvar (${res.status}).`);
        toast.error(msg);
        return;
      }
      router.refresh();
      const id = body.case?.id;
      if (id) setCaseId(id);
      if (action === "draft") {
        toast.success(caseId ? "Rascunho atualizado." : "Rascunho salvo. Você já pode anexar documentos.");
      } else {
        toast.success("Caso estruturado com Lex AI.");
        if (id) router.push(`/cases/${id}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro de rede.");
    } finally {
      setLoading(null);
    }
  }

  const stepperActive = activeScrollSection;

  const sidebarCollapsed = useUiStore((s) => s.sidebarCollapsed);
  /** Alinha com `ml-[268px]` / `ml-[80px]` do AppChrome (só modo standalone). */
  const appMainInset = sidebarCollapsed ? "80px" : "268px";

  return (
    <div
      className={cn("w-full min-w-0", isEmbedded ? "pb-24 md:pb-8" : "pb-28 md:pb-6 lg:pb-10")}
      style={
        (isEmbedded
          ? {
              "--app-main-inset": "0px",
              "--intake-sidebar-w": "280px",
              "--intake-gap": "24px",
              "--intake-shell-w": "min(100%, 56rem)",
            }
          : {
              "--app-main-inset": appMainInset,
              "--intake-sidebar-w": "320px",
              "--intake-gap": "24px",
              "--intake-shell-w": `min(100%, max(0px, calc((100vw - ${appMainInset}) * 0.7)))`,
            }) as React.CSSProperties
      }
    >
      {/* Mobile: stepper horizontal sob o topbar (em md+ o menu vai para o card na coluna direita). */}
      <div className="sticky top-[calc(var(--app-header-h)+0.25rem)] z-40 -mx-4 mb-4 w-full shrink-0 border-b border-[color:var(--border-default)]/30 bg-[color:var(--surface-base)]/95 px-4 pb-2 pt-1 backdrop-blur-md supports-[backdrop-filter]:bg-[color:var(--surface-base)]/85 md:hidden">
        <IntakeStepper
          activeId={stepperActive}
          statuses={statuses}
          onNavigate={(id) => scrollToIntakeSection(id)}
        />
      </div>

      {/* Mobile: coluna 2 (navegação + resumo) logo abaixo do stepper horizontal, sticky — não no fim da página. */}
      <div className="mb-4 space-y-3 md:hidden">
        <div className="sticky top-[calc(var(--app-header-h)+4.25rem)] z-30 max-h-[min(70svh,calc(100svh-var(--app-header-h)-5.5rem))] space-y-3 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
          <IntakeStepperVertical
            activeId={stepperActive}
            statuses={statuses}
            onNavigate={(id) => scrollToIntakeSection(id)}
          />
          <IntakeSidebarPanel
            hideActions
            progress={progress}
            pending={pending}
            lacunas={lacunas}
            nextLabel={nextLabel}
            onDraft={() => {}}
            onStructure={() => {}}
            loading={loading}
            structureLocked={structureLocked}
            structureLockTitle={structureLocked ? structureLockTitle : undefined}
          />
        </div>
      </div>

      <div
        className={cn(
          "flex flex-col gap-6",
          !isEmbedded && "md:block",
          isEmbedded && "md:grid md:grid-cols-[minmax(0,1fr),min(280px,34%)] md:items-start md:gap-6",
        )}
      >
          <div
            className={cn(
              "min-w-0 flex-1 space-y-6 overflow-x-hidden pb-2",
              isEmbedded
                ? "md:mx-0 md:w-full md:max-w-none md:pr-0 md:pb-4"
                : "md:mx-auto md:w-[var(--intake-shell-w)] md:min-w-0 md:max-w-[var(--intake-shell-w)] md:pr-[calc(var(--intake-sidebar-w)+var(--intake-gap))] md:pb-4",
            )}
          >
          <LegalSectionCard
            id={SECTION_ANCHOR.attend}
            step={1}
            title="Atendimento"
            subtitle="Contexto inicial do caso e dados processuais, se houver."
            status={statuses.attend}
            footer={sectionReviewFooter("attend", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({ ...p, userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "attend", on) })),
            )}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <LegalTextInput
                id="attend-suggestedTitle"
                label="Título sugerido do caso"
                value={form.attend.suggestedTitle}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, suggestedTitle: v } }))}
                requirement="required"
                error={err("attend.suggestedTitle")}
              />
              <LegalTextInput
                id="attend-probableLegalArea"
                label="Área jurídica provável"
                value={form.attend.probableLegalArea}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, probableLegalArea: v } }))}
                requirement="optional"
              />
              <LegalSelect
                id="attend-preOrProcess"
                label="Fase"
                value={form.attend.preOrProcess}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, preOrProcess: v } }))}
                requirement="required"
                options={[
                  { value: "pre_processual", label: "Pré-processual / consultivo" },
                  { value: "existing_process", label: "Processo já existente" },
                ]}
              />
              <LegalSelect
                id="attend-clientOrigin"
                label="Origem do cliente"
                value={form.attend.clientOrigin ?? "outro"}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, clientOrigin: v } }))}
                requirement="optional"
                options={[
                  { value: "indicacao", label: "Indicação" },
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "site", label: "Site" },
                  { value: "retorno", label: "Retorno" },
                  { value: "outro", label: "Outro" },
                ]}
              />
              <LegalDateInput
                id="attend-intakeDate"
                label="Data do atendimento"
                isoValue={form.attend.intakeDate ?? ""}
                onIsoChange={(iso) => patchForm((p) => ({ ...p, attend: { ...p.attend, intakeDate: iso } }))}
                requirement="optional"
              />
              <LegalMaskedInput
                id="attend-cnj"
                mask="cnj"
                label="Número CNJ (se já existir processo)"
                value={form.attend.cnj}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, cnj: v } }))}
                placeholder="0000000-00.0000.0.00.0000"
                requirement="optional"
                error={cnjErr ?? err("attend.cnj")}
              />
              <LegalTextInput
                id="attend-tribunalVara"
                label="Tribunal / vara"
                value={form.attend.tribunalVara}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, tribunalVara: v } }))}
                requirement="optional"
              />
              <LegalTextInput
                id="attend-city"
                label="Cidade do caso"
                value={form.attend.city}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, city: v } }))}
                requirement="required"
                error={err("attend.city")}
              />
              <LegalTextInput
                id="attend-uf"
                label="UF"
                value={form.attend.uf}
                onChange={(v) =>
                  patchForm((p) => ({ ...p, attend: { ...p.attend, uf: v.replace(/[^a-zA-Z]/g, "").slice(0, 2) } }))
                }
                placeholder="SP"
                requirement="required"
                className="max-w-[5rem] uppercase"
                error={err("attend.uf")}
              />
              <LegalTextInput
                id="attend-responsibleLawyer"
                label="Advogado(a) responsável"
                value={form.attend.responsibleLawyer}
                onChange={(v) => patchForm((p) => ({ ...p, attend: { ...p.attend, responsibleLawyer: v } }))}
                requirement="optional"
                className="md:col-span-2"
              />
            </div>
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.client}
            step={2}
            title="Cliente / parte autora"
            subtitle="Identifique quem procura o escritório ou quem será representado."
            status={statuses.client}
            footer={sectionReviewFooter("client", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({ ...p, userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "client", on) })),
            )}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={form.clientKind === "PERSON" ? "default" : "secondary"}
                onClick={() => patchForm((p) => ({ ...p, clientKind: "PERSON" }))}
              >
                Pessoa física
              </Button>
              <Button
                type="button"
                size="sm"
                variant={form.clientKind === "COMPANY" ? "default" : "secondary"}
                onClick={() => patchForm((p) => ({ ...p, clientKind: "COMPANY" }))}
              >
                Pessoa jurídica
              </Button>
            </div>

            {form.clientKind === "PERSON" ? (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <LegalTextInput
                  id="client-fullName"
                  label="Nome completo"
                  value={form.clientPerson?.fullName ?? ""}
                  onChange={(v) =>
                    patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, fullName: v } }))
                  }
                  requirement="required"
                  error={err("clientPerson.fullName")}
                  className="md:col-span-2"
                />
                <LegalMaskedInput
                  id="client-cpf"
                  mask="cpf"
                  label="CPF"
                  value={form.clientPerson?.cpf ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, cpf: v } }))}
                  requirement="lacuna"
                  error={err("clientPerson.cpf")}
                />
                <LegalTextInput id="client-rg" label="RG" value={form.clientPerson?.rg ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, rg: v } }))} requirement="optional" />
                <LegalDateInput
                  id="client-birthDate"
                  label="Data de nascimento"
                  isoValue={form.clientPerson?.birthDate ?? ""}
                  onIsoChange={(iso) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, birthDate: iso } }))}
                  requirement="optional"
                />
                <LegalTextInput id="client-nationality" label="Nacionalidade" value={form.clientPerson?.nationality ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, nationality: v } }))} requirement="optional" />
                <LegalTextInput id="client-marital" label="Estado civil" value={form.clientPerson?.maritalStatus ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, maritalStatus: v } }))} requirement="optional" />
                <LegalTextInput id="client-profession" label="Profissão" value={form.clientPerson?.profession ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, profession: v } }))} requirement="optional" />
                <LegalMaskedInput
                  id="client-phone"
                  mask="phone"
                  label="Telefone"
                  value={form.clientPerson?.phone ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, phone: v } }))}
                  requirement="optional"
                  error={err("clientPerson.phone")}
                />
                <LegalTextInput
                  id="client-email"
                  label="E-mail"
                  type="email"
                  value={form.clientPerson?.email ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, email: v } }))}
                  requirement="optional"
                  autoComplete="email"
                  error={err("clientPerson.email")}
                />
                <LegalTextarea
                  id="client-address"
                  label="Endereço"
                  minHeightPx={88}
                  value={form.clientPerson?.address ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, address: v } }))}
                  requirement="optional"
                  className="md:col-span-2"
                />
                <LegalMaskedInput
                  id="client-cep"
                  mask="cep"
                  label="CEP"
                  value={form.clientPerson?.cep ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, cep: v } }))}
                  requirement="optional"
                />
                <LegalTextInput id="client-pcity" label="Cidade (cliente)" value={form.clientPerson?.city ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, city: v } }))} requirement="optional" />
                <LegalTextInput id="client-puf" label="UF (cliente)" value={form.clientPerson?.uf ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, uf: v.replace(/[^a-zA-Z]/g, "").slice(0, 2) } }))} requirement="optional" className="max-w-[5rem] uppercase" />
                <LegalTextInput id="client-legalRep" label="Representante legal (se aplicável)" value={form.clientPerson?.legalRepresentative ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientPerson: { ...p.clientPerson, legalRepresentative: v } }))} requirement="optional" className="md:col-span-2" />
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground md:col-span-2">
                  <input
                    type="checkbox"
                    className="size-4 accent-violet-500"
                    checked={!!form.clientPerson?.isLegalRepresentative}
                    onChange={(e) =>
                      patchForm((p) => ({
                        ...p,
                        clientPerson: { ...p.clientPerson, isLegalRepresentative: e.target.checked },
                      }))
                    }
                  />
                  É representante legal (não é o próprio interessado)
                </label>
              </div>
            ) : (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <LegalTextInput
                  id="co-legalName"
                  label="Razão social"
                  value={form.clientCompany?.legalName ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, legalName: v } }))}
                  requirement="required"
                  error={err("clientCompany.legalName")}
                  className="md:col-span-2"
                />
                <LegalTextInput id="co-trade" label="Nome fantasia" value={form.clientCompany?.tradeName ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, tradeName: v } }))} requirement="optional" />
                <LegalMaskedInput
                  id="co-cnpj"
                  mask="cnpj"
                  label="CNPJ"
                  value={form.clientCompany?.cnpj ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, cnpj: v } }))}
                  requirement="lacuna"
                  error={err("clientCompany.cnpj")}
                />
                <LegalTextInput id="co-stateReg" label="Inscrição estadual" value={form.clientCompany?.stateRegistration ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, stateRegistration: v } }))} requirement="optional" />
                <LegalTextInput id="co-repName" label="Representante legal — nome" value={form.clientCompany?.legalRepName ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, legalRepName: v } }))} requirement="optional" />
                <LegalMaskedInput
                  id="co-repCpf"
                  mask="cpf"
                  label="Representante legal — CPF"
                  value={form.clientCompany?.legalRepCpf ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, legalRepCpf: v } }))}
                  requirement="optional"
                  error={err("clientCompany.legalRepCpf")}
                />
                <LegalTextInput id="co-repRole" label="Cargo" value={form.clientCompany?.legalRepRole ?? ""} onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, legalRepRole: v } }))} requirement="optional" />
                <LegalMaskedInput
                  id="co-phone"
                  mask="phone"
                  label="Telefone"
                  value={form.clientCompany?.phone ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, phone: v } }))}
                  requirement="optional"
                  error={err("clientCompany.phone")}
                />
                <LegalTextInput
                  id="co-email"
                  label="E-mail"
                  type="email"
                  value={form.clientCompany?.email ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, email: v } }))}
                  requirement="optional"
                  error={err("clientCompany.email")}
                />
                <LegalTextarea
                  id="co-address"
                  label="Endereço"
                  minHeightPx={88}
                  value={form.clientCompany?.address ?? ""}
                  onChange={(v) => patchForm((p) => ({ ...p, clientCompany: { ...p.clientCompany, address: v } }))}
                  requirement="optional"
                  className="md:col-span-2"
                />
              </div>
            )}
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.opposing}
            step={3}
            title="Parte contrária / possível réu"
            subtitle="Identifique quem está do outro lado ou marque quando ainda não for possível."
            status={statuses.opposing}
            footer={sectionReviewFooter("opposing", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({
                ...p,
                userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "opposing", on),
              })),
            )}
          >
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-violet-500"
                checked={form.opposing.unknown}
                onChange={(e) =>
                  patchForm((p) => ({
                    ...p,
                    opposing: {
                      ...p.opposing,
                      unknown: e.target.checked,
                      parties: e.target.checked
                        ? []
                        : (p.opposing.parties?.length ?? 0) > 0
                          ? p.opposing.parties!
                          : [emptyOpposingPartyRow()],
                    },
                  }))
                }
              />
              <span>A parte contrária ainda é desconhecida</span>
            </label>

            {!form.opposing.unknown ? (
              <div className="space-y-4 pt-2">
                {(form.opposing.parties ?? []).map((party, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl border border-[color:var(--border-default)]/80 bg-white/[0.02] p-4"
                  >
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Parte contrária {idx + 1}
                      </p>
                      {(form.opposing.parties?.length ?? 0) > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-rose-300"
                          onClick={() =>
                            patchForm((p) => ({
                              ...p,
                              opposing: {
                                ...p.opposing,
                                parties: (p.opposing.parties ?? []).filter((_, i) => i !== idx),
                              },
                            }))
                          }
                        >
                          <Trash2 className="mr-1 size-3" /> Remover
                        </Button>
                      ) : null}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <LegalTextInput
                        id={`opp-name-${idx}`}
                        label="Nome ou razão social"
                        value={party.name}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, name: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                      <LegalFieldMaskedCustom
                        id={`opp-doc-${idx}`}
                        label="CPF ou CNPJ"
                        value={party.document}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, document: maskPartyDocument(v) };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        error={err(`opposing.parties.${idx}.document`)}
                      />
                      <LegalMaskedInput
                        id={`opp-phone-${idx}`}
                        mask="phone"
                        label="Telefone"
                        value={party.phone}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, phone: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        error={err(`opposing.parties.${idx}.phone`)}
                      />
                      <LegalTextInput
                        id={`opp-email-${idx}`}
                        label="E-mail"
                        type="email"
                        value={party.email}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, email: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        error={err(`opposing.parties.${idx}.email`)}
                      />
                      <LegalTextarea
                        id={`opp-addr-${idx}`}
                        label="Endereço"
                        minHeightPx={88}
                        value={party.address}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, address: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                      <LegalTextInput
                        id={`opp-city-${idx}`}
                        label="Cidade"
                        value={party.city}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, city: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                      />
                      <LegalTextInput
                        id={`opp-uf-${idx}`}
                        label="UF"
                        value={party.uf}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, uf: v.replace(/[^a-zA-Z]/g, "").slice(0, 2) };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        className="max-w-[5rem] uppercase"
                      />
                      <LegalTextarea
                        id={`opp-rel-${idx}`}
                        label="Relação com o cliente"
                        minHeightPx={88}
                        value={party.relationToClient}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, relationToClient: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                      <LegalTextarea
                        id={`opp-part-${idx}`}
                        label="Participação no fato"
                        minHeightPx={88}
                        value={party.participation}
                        onChange={(v) =>
                          patchForm((p) => {
                            const parties = [...(p.opposing.parties ?? [])];
                            parties[idx] = { ...parties[idx]!, participation: v };
                            return { ...p, opposing: { ...p.opposing, parties } };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                    </div>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    patchForm((p) => ({
                      ...p,
                      opposing: { ...p.opposing, parties: [...(p.opposing.parties ?? []), emptyOpposingPartyRow()] },
                    }))
                  }
                >
                  <Plus className="mr-1 size-3" /> Adicionar parte contrária
                </Button>
              </div>
            ) : null}
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.third}
            step={4}
            title="Terceiros"
            subtitle="Beneficiários, testemunhas, menores, órgãos públicos ou instituições ligadas ao caso."
            status={statuses.third}
            footer={sectionReviewFooter("third", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({ ...p, userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "third", on) })),
            )}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <LegalTextarea id="tp-ben" label="Beneficiário" minHeightPx={88} value={form.thirdParties.beneficiary} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, beneficiary: v } }))} requirement="optional" />
              <LegalTextarea id="tp-wit" label="Testemunhas" minHeightPx={88} value={form.thirdParties.witnesses} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, witnesses: v } }))} requirement="optional" />
              <LegalTextarea id="tp-min" label="Menores envolvidos" minHeightPx={88} value={form.thirdParties.minors} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, minors: v } }))} requirement="optional" />
              <LegalTextarea id="tp-lr" label="Representação legal (além do cliente)" minHeightPx={88} value={form.thirdParties.legalRep} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, legalRep: v } }))} requirement="optional" />
              <LegalTextarea id="tp-pub" label="Órgão público" minHeightPx={88} value={form.thirdParties.publicBody} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, publicBody: v } }))} requirement="optional" />
              <LegalTextarea id="tp-inst" label="Empresa / instituição" minHeightPx={88} value={form.thirdParties.institution} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, institution: v } }))} requirement="optional" />
              <LegalTextarea id="tp-other" label="Outros terceiros" minHeightPx={88} value={form.thirdParties.other} onChange={(v) => patchForm((p) => ({ ...p, thirdParties: { ...p.thirdParties, other: v } }))} requirement="optional" className="md:col-span-2" />
            </div>
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.narrative}
            step={5}
            title="Relato"
            subtitle="Organize a história em blocos; a Lex AI consolidará fatos e riscos."
            status={statuses.narrative}
            footer={sectionReviewFooter("narrative", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({
                ...p,
                userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "narrative", on),
              })),
            )}
          >
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 size-4 accent-violet-500"
                checked={!!form.freeNarrativeOnly}
                onChange={(e) => patchForm((p) => ({ ...p, freeNarrativeOnly: e.target.checked }))}
              />
              <span>
                Tenho só um relato livre — a Lex AI organiza depois
                <span className="mt-0.5 block text-sm leading-relaxed text-[color:var(--text-secondary)]">
                  Ative para priorizar o campo de relato livre; os demais blocos ficam opcionais neste envio.
                </span>
              </span>
            </label>

            <LegalTextarea
              id="nar-what"
              label="O que aconteceu?"
              minHeightPx={88}
              value={form.narrative.whatHappened}
              onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, whatHappened: v } }))}
              requirement={form.freeNarrativeOnly ? "optional" : "required"}
              error={err("narrative.whatHappened")}
              hint="Descreva o problema com as palavras do cliente. Depois a Lex AI organizará fatos, partes, pedidos e riscos."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <LegalTextarea
                id="nar-when"
                label="Quando?"
                minHeightPx={88}
                value={form.narrative.whenHappened}
                onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, whenHappened: v } }))}
                requirement="optional"
              />
              <LegalTextarea
                id="nar-where"
                label="Onde?"
                minHeightPx={88}
                value={form.narrative.whereHappened}
                onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, whereHappened: v } }))}
                requirement="optional"
              />
            </div>
            <LegalTextarea
              id="nar-who"
              label="Quem participou?"
              minHeightPx={88}
              value={form.narrative.whoParticipated}
              onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, whoParticipated: v } }))}
              requirement="optional"
            />
            <LegalTextarea
              id="nar-tried"
              label="O que o cliente já tentou fazer?"
              minHeightPx={88}
              value={form.narrative.clientTriedResolve}
              onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, clientTriedResolve: v } }))}
              requirement="optional"
            />

            <details className="rounded-lg border border-[color:var(--border-default)]/70 bg-white/[0.02] p-3">
              <summary className="cursor-pointer text-sm font-medium text-foreground/90">Detalhes adicionais do relato (opcional)</summary>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <LegalTextarea id="nar-how" label="Como começou" minHeightPx={88} value={form.narrative.howStarted} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, howStarted: v } }))} requirement="optional" />
                <LegalTextarea id="nar-ask" label="Pedidos / negativas / cobranças" minHeightPx={88} value={form.narrative.askedDeniedCharged} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, askedDeniedCharged: v } }))} requirement="optional" />
                <LegalTextarea id="nar-spoke" label="Quem falou / agiu" minHeightPx={88} value={form.narrative.whoSpoke} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, whoSpoke: v } }))} requirement="optional" />
                <LegalTextarea id="nar-prot" label="Protocolos" minHeightPx={88} value={form.narrative.hasProtocol} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, hasProtocol: v } }))} requirement="optional" />
                <LegalTextarea id="nar-dmg" label="Dano ou prejuízo" minHeightPx={88} value={form.narrative.damage} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, damage: v } }))} requirement="optional" />
                <LegalTextarea id="nar-ong" label="Situação em curso" minHeightPx={88} value={form.narrative.ongoing} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, ongoing: v } }))} requirement="optional" />
                <LegalTextarea id="nar-chg" label="O que mudou desde o início" minHeightPx={88} value={form.narrative.whatChanged} onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, whatChanged: v } }))} requirement="optional" className="md:col-span-2" />
              </div>
            </details>

            <div className="rounded-lg border border-[color:var(--border-default)]/80 bg-white/[0.02] p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-medium text-foreground/90"
                onClick={() => setFreeNarrativeExpanded((x) => !x)}
              >
                Relato livre completo
                <span className="text-xs font-normal text-muted-foreground">{freeNarrativeExpanded ? "Recolher" : "Expandir"}</span>
              </button>
              {(freeNarrativeExpanded || form.freeNarrativeOnly) ? (
                <div className="mt-3">
                  <LegalTextarea
                    id="nar-free"
                    label="Texto contínuo"
                    minHeightPx={140}
                    value={form.narrative.freeText}
                    onChange={(v) => patchForm((p) => ({ ...p, narrative: { ...p.narrative, freeText: v } }))}
                    requirement={form.freeNarrativeOnly ? "required" : "optional"}
                    error={err("narrative.freeText")}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">Use para transcrições longas ou complemento ao relato estruturado.</p>
              )}
            </div>
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.timeline}
            step={6}
            title="Linha do tempo"
            subtitle="Eventos em ordem aproximada fortalecem a minuta e a estratégia."
            status={statuses.timeline}
            footer={sectionReviewFooter("timeline", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({
                ...p,
                userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "timeline", on),
              })),
            )}
          >
            {(form.timeline ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum evento adicionado ainda.</p>
            ) : (
              <div className="space-y-4">
                {(form.timeline ?? []).map((row, idx) => (
                  <div key={idx} className="rounded-xl border border-[color:var(--border-default)]/80 bg-white/[0.02] p-4">
                    <div className="mb-3 flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-rose-300"
                        onClick={() =>
                          patchForm((p) => ({
                            ...p,
                            timeline: (p.timeline ?? []).filter((_, i) => i !== idx),
                          }))
                        }
                      >
                        Remover
                      </Button>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <LegalTextInput
                        id={`tl-date-${idx}`}
                        label="Data do evento"
                        value={timelineDateFieldValue(row.date)}
                        onChange={(v) =>
                          patchForm((p) => {
                            const tl = [...(p.timeline ?? [])];
                            tl[idx] = { ...tl[idx]!, date: onTimelineDateInput(v) };
                            return { ...p, timeline: tl };
                          })
                        }
                        placeholder="dd/mm/aaaa"
                        requirement="optional"
                        hint="Somente números; convertemos para ISO quando a data for válida."
                      />
                      <LegalTextInput
                        id={`tl-who-${idx}`}
                        label="Pessoa / instituição"
                        value={row.who}
                        onChange={(v) =>
                          patchForm((p) => {
                            const tl = [...(p.timeline ?? [])];
                            tl[idx] = { ...tl[idx]!, who: v };
                            return { ...p, timeline: tl };
                          })
                        }
                        requirement="optional"
                      />
                      <LegalTextarea
                        id={`tl-ev-${idx}`}
                        label="Descrição do evento"
                        minHeightPx={88}
                        value={row.event}
                        onChange={(v) =>
                          patchForm((p) => {
                            const tl = [...(p.timeline ?? [])];
                            tl[idx] = { ...tl[idx]!, event: v };
                            return { ...p, timeline: tl };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                      <LegalTextInput
                        id={`tl-doc-${idx}`}
                        label="Prova relacionada"
                        value={row.documentRef}
                        onChange={(v) =>
                          patchForm((p) => {
                            const tl = [...(p.timeline ?? [])];
                            tl[idx] = { ...tl[idx]!, documentRef: v };
                            return { ...p, timeline: tl };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                      <LegalTextarea
                        id={`tl-note-${idx}`}
                        label="Observação"
                        minHeightPx={88}
                        value={row.note}
                        onChange={(v) =>
                          patchForm((p) => {
                            const tl = [...(p.timeline ?? [])];
                            tl[idx] = { ...tl[idx]!, note: v };
                            return { ...p, timeline: tl };
                          })
                        }
                        requirement="optional"
                        className="md:col-span-2"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={() =>
                patchForm((p) => ({ ...p, timeline: [...(p.timeline ?? []), emptyTimelineRow()] }))
              }
            >
              <Plus className="mr-1 size-3" /> Adicionar evento
            </Button>
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.documents}
            step={7}
            title="Provas e documentos"
            subtitle="Marque o que já existe e o que ainda falta reunir."
            status={statuses.documents}
            footer={sectionReviewFooter("documents", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({
                ...p,
                userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "documents", on),
              })),
            )}
          >
            <div className="space-y-5">
              {DOC_GROUPS.map((g) => (
                <div key={g.title}>
                  <p className="mb-2 text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">{g.title}</p>
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map(({ key, label }) => (
                      <label
                        key={key}
                        className="flex cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--border-default)]/80 bg-white/[0.02] px-3 py-2 text-sm transition-colors hover:border-violet-500/30"
                      >
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-violet-500"
                          checked={!!form.documents.checklist?.[key]}
                          onChange={(e) =>
                            patchForm((p) => ({
                              ...p,
                              documents: {
                                ...p.documents,
                                checklist: { ...p.documents.checklist, [key]: e.target.checked },
                              },
                            }))
                          }
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <LegalTextarea
              id="doc-missing"
              label="Documentos ainda faltantes"
              minHeightPx={96}
              value={form.documents.missingNotes}
              onChange={(v) => patchForm((p) => ({ ...p, documents: { ...p.documents, missingNotes: v } }))}
              requirement="optional"
              hint="Liste o que o cliente ainda precisa enviar."
            />
            <div className="rounded-lg border border-dashed border-[color:var(--border-default)] p-4">
              {caseId ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-muted-foreground">Anexe arquivos ao rascunho do caso.</p>
                  <DocumentUploadButton
                    caseId={caseId}
                    label="Anexar documento ao rascunho"
                    variant="secondary"
                    onUploaded={(r) =>
                      patchForm((p) => ({
                        ...p,
                        documents: {
                          ...p.documents,
                          documentIds: [...(p.documents.documentIds ?? []), r.documentId],
                        },
                      }))
                    }
                  />
                </div>
              ) : (
                <p className="text-sm text-amber-100/90">Salve o rascunho para anexar documentos.</p>
              )}
            </div>
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.goals}
            step={8}
            title="Objetivo, urgência e riscos"
            subtitle="O que o cliente busca e quais riscos processuais ou de prazo são relevantes."
            status={statuses.goals}
            footer={sectionReviewFooter("goals", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({ ...p, userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "goals", on) })),
            )}
          >
            <LegalTextarea
              id="goals-wants"
              label="O que o cliente quer alcançar"
              minHeightPx={88}
              value={form.goals.clientWants}
              onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, clientWants: v } }))}
              requirement="optional"
              error={err("goals.clientWants")}
            />
            <div className="grid gap-4 md:grid-cols-2">
              <LegalTextarea id="goals-ideal" label="Resultado ideal" minHeightPx={88} value={form.goals.idealOutcome} onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, idealOutcome: v } }))} requirement="optional" />
              <LegalTextarea id="goals-min" label="Resultado mínimo aceitável" minHeightPx={88} value={form.goals.minimumOutcome} onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, minimumOutcome: v } }))} requirement="optional" />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <LegalSelect
                id="goals-settle"
                label="Aceita acordo / mediação?"
                value={form.goals.wantsSettlement ?? "nao_sei"}
                onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, wantsSettlement: v } }))}
                requirement="optional"
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                  { value: "nao_sei", label: "Não sei" },
                ]}
              />
              <LegalSelect
                id="goals-suit"
                label="Quer ação judicial?"
                value={form.goals.wantsLawsuit ?? "nao_sei"}
                onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, wantsLawsuit: v } }))}
                requirement="optional"
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                  { value: "nao_sei", label: "Não sei" },
                ]}
              />
              <LegalSelect
                id="goals-extra"
                label="Medidas extrajudiciais?"
                value={form.goals.wantsExtrajudicial ?? "nao_sei"}
                onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, wantsExtrajudicial: v } }))}
                requirement="optional"
                options={[
                  { value: "sim", label: "Sim" },
                  { value: "nao", label: "Não" },
                  { value: "nao_sei", label: "Não sei" },
                ]}
              />
            </div>
            <LegalCurrencyInput
              id="goals-value"
              label="Valor econômico envolvido (estimativa)"
              value={form.goals.approximateValue}
              onChange={(v) => patchForm((p) => ({ ...p, goals: { ...p.goals, approximateValue: v } }))}
              requirement="optional"
            />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {(
                [
                  ["urgency", "Urgência"],
                  ["deadlineExpiring", "Prazo crítico"],
                  ["hearingOrSummons", "Audiência ou intimação"],
                  ["immediateDamageRisk", "Risco de dano imediato"],
                  ["prescriptionRisk", "Risco de prescrição"],
                  ["vulnerablePerson", "Pessoa em situação de vulnerabilidade"],
                  ["evidenceLossRisk", "Risco de perda de provas"],
                  ["unfavorableFacts", "Há fatos desfavoráveis ao cliente"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-[color:var(--border-default)]/60 bg-white/[0.02] px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-violet-500"
                    checked={!!form.goals[key]}
                    onChange={(e) =>
                      patchForm((p) => ({ ...p, goals: { ...p.goals, [key]: e.target.checked } }))
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </LegalSectionCard>

          <LegalSectionCard
            id={SECTION_ANCHOR.communication}
            step={9}
            title="Comunicação e próximos passos"
            subtitle="Preferências de contato e combinados internos."
            status={statuses.communication}
            footer={sectionReviewFooter("communication", form.userConfirmedPaths, (on) =>
              patchForm((p) => ({
                ...p,
                userConfirmedPaths: toggleSectionConfirmed(p.userConfirmedPaths, "communication", on),
              })),
            )}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <LegalSelect
                id="com-channel"
                label="Canal preferido"
                value={form.communication.preferredChannel ?? "whatsapp"}
                onChange={(v) => patchForm((p) => ({ ...p, communication: { ...p.communication, preferredChannel: v } }))}
                requirement="optional"
                options={[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "email", label: "E-mail" },
                  { value: "telefone", label: "Telefone" },
                  { value: "outro", label: "Outro" },
                ]}
              />
              <LegalTextInput
                id="com-time"
                label="Melhor horário para contato"
                value={form.communication.preferredTime}
                onChange={(v) => patchForm((p) => ({ ...p, communication: { ...p.communication, preferredTime: v } }))}
                requirement="optional"
              />
              <LegalTextInput
                id="com-meet"
                label="Próxima reunião / retorno"
                value={form.communication.nextMeeting}
                onChange={(v) => patchForm((p) => ({ ...p, communication: { ...p.communication, nextMeeting: v } }))}
                requirement="optional"
              />
              <LegalTextInput
                id="com-task"
                label="Tarefa interna"
                value={form.communication.internalNextTask}
                onChange={(v) => patchForm((p) => ({ ...p, communication: { ...p.communication, internalNextTask: v } }))}
                requirement="optional"
              />
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-violet-500"
                checked={!!form.communication.needsFeeAgreement}
                onChange={(e) =>
                  patchForm((p) => ({
                    ...p,
                    communication: { ...p.communication, needsFeeAgreement: e.target.checked },
                  }))
                }
              />
              Precisa formalizar honorários / contrato
            </label>
            <LegalTextarea
              id="com-pay"
              label="Combinado de pagamento"
              minHeightPx={88}
              value={form.communication.paymentArrangement}
              onChange={(v) => patchForm((p) => ({ ...p, communication: { ...p.communication, paymentArrangement: v } }))}
              requirement="optional"
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-violet-500"
                checked={!!form.communication.clientInformedFees}
                onChange={(e) =>
                  patchForm((p) => ({
                    ...p,
                    communication: { ...p.communication, clientInformedFees: e.target.checked },
                  }))
                }
              />
              Cliente foi informado sobre honorários
            </label>
            <LegalTextarea
              id="com-notes"
              label="Observações internas"
              minHeightPx={96}
              value={form.communication.internalNotes}
              onChange={(v) => patchForm((p) => ({ ...p, communication: { ...p.communication, internalNotes: v } }))}
              requirement="optional"
            />
          </LegalSectionCard>
        </div>

        {/* Standalone: painel à direita em `fixed` na viewport. Embedded: coluna da grelha, sticky dentro do centro. */}
        <div
          className={cn(
            "pointer-events-none hidden md:block",
            isEmbedded
              ? "md:relative md:col-start-2 md:row-start-1 md:self-start md:sticky md:top-4 md:z-10 md:max-h-[min(calc(100vh-6rem),920px)] md:overflow-y-auto md:overscroll-y-contain"
              : "md:fixed md:left-[var(--app-main-inset)] md:right-0 md:top-[calc(var(--app-header-h,5.5rem)+2rem)] md:bottom-4 md:z-30",
          )}
        >
          <div
            className={cn(
              "pointer-events-none mx-auto flex h-full justify-end",
              isEmbedded ? "w-full" : "w-[var(--intake-shell-w)]",
            )}
          >
            <aside className="ml-auto flex h-full min-h-0 w-[var(--intake-sidebar-w)] max-w-full flex-col gap-3 overflow-y-auto overscroll-y-contain pointer-events-auto md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden">
              <IntakeStepperVertical
                activeId={stepperActive}
                statuses={statuses}
                onNavigate={(id) => scrollToIntakeSection(id)}
              />
              <IntakeSidebarPanel
                progress={progress}
                pending={pending}
                lacunas={lacunas}
                nextLabel={nextLabel}
                onDraft={() => submit("draft")}
                onStructure={() => submit("structure")}
                loading={loading}
                structureLocked={structureLocked}
                structureLockTitle={structureLocked ? structureLockTitle : undefined}
              />
            </aside>
          </div>
        </div>
      </div>

      <IntakeMobileActionBar
        onDraft={() => submit("draft")}
        onStructure={() => submit("structure")}
        loading={loading}
        structureLocked={structureLocked}
        structureLockTitle={structureLocked ? structureLockTitle : undefined}
      />
    </div>
  );
}

function LegalFieldMaskedCustom({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-semibold leading-snug text-[color:var(--text-secondary)]">
        {label}
      </label>
      <input
        id={id}
        className="flex min-h-10 w-full rounded-md border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--surface-overlay-strong)] px-3 py-2 font-mono text-[0.9375rem] leading-snug text-[color:var(--text-primary)] shadow-sm outline-none transition-colors placeholder:text-[color:var(--placeholder-foreground)] focus-visible:ring-2 focus-visible:ring-[color:var(--border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface-base)]"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
      />
      {error ? <p className="text-sm font-medium leading-snug text-rose-300">{error}</p> : null}
    </div>
  );
}
