import { z } from "zod";
import { isValidBrazilPhone, isValidCnpj, isValidCpf, isValidEmail, onlyDigits } from "./br-validators";

const optionalTrimmed = z.string().max(20_000).optional().default("");

const timelineRowSchema = z.object({
  date: z.string().max(40).optional().default(""),
  event: z.string().max(2000).optional().default(""),
  who: z.string().max(500).optional().default(""),
  documentRef: z.string().max(500).optional().default(""),
  note: z.string().max(2000).optional().default(""),
});

const docChecklistSchema = z.object({
  personalId: z.boolean().optional().default(false),
  addressProof: z.boolean().optional().default(false),
  contract: z.boolean().optional().default(false),
  paymentProof: z.boolean().optional().default(false),
  whatsappPrints: z.boolean().optional().default(false),
  emails: z.boolean().optional().default(false),
  protocols: z.boolean().optional().default(false),
  photos: z.boolean().optional().default(false),
  videos: z.boolean().optional().default(false),
  audios: z.boolean().optional().default(false),
  policeReport: z.boolean().optional().default(false),
  medicalReport: z.boolean().optional().default(false),
  schoolProof: z.boolean().optional().default(false),
  processNumber: z.boolean().optional().default(false),
  courtOrder: z.boolean().optional().default(false),
  other: z.boolean().optional().default(false),
});

const opposingPartySchema = z.object({
  name: z.string().max(500).optional().default(""),
  document: z.string().max(30).optional().default(""),
  address: z.string().max(1000).optional().default(""),
  city: z.string().max(120).optional().default(""),
  uf: z.string().max(2).optional().default(""),
  phone: z.string().max(40).optional().default(""),
  email: z.string().max(200).optional().default(""),
  relationToClient: z.string().max(1000).optional().default(""),
  participation: z.string().max(2000).optional().default(""),
});

export const fundamentalIntakeFormSchema = z
  .object({
    /** Caminhos de campos que o usuário marcou como confirmados — a IA não sobrescreve. */
    userConfirmedPaths: z.array(z.string().max(200)).max(400).optional().default([]),

    attend: z.object({
      suggestedTitle: z.string().min(2, "Título sugerido é obrigatório.").max(200),
      probableLegalArea: z.string().max(200).optional().default(""),
      preOrProcess: z.enum(["pre_processual", "existing_process"]),
      cnj: z.string().max(40).optional().default(""),
      tribunalVara: z.string().max(200).optional().default(""),
      city: z.string().min(1, "Cidade do caso é obrigatória.").max(120),
      uf: z
        .string()
        .length(2, "UF com 2 letras.")
        .transform((s) => s.toUpperCase()),
      responsibleLawyer: z.string().max(200).optional().default(""),
      clientOrigin: z.enum(["indicacao", "whatsapp", "site", "retorno", "outro"]).optional().default("outro"),
      intakeDate: z.string().max(40).optional().default(""),
    }),

    clientKind: z.enum(["PERSON", "COMPANY"]),

    clientPerson: z
      .object({
        fullName: z.string().max(200).optional().default(""),
        cpf: z.string().max(20).optional().default(""),
        rg: z.string().max(40).optional().default(""),
        birthDate: z.string().max(40).optional().default(""),
        nationality: z.string().max(80).optional().default(""),
        maritalStatus: z.string().max(80).optional().default(""),
        profession: z.string().max(120).optional().default(""),
        phone: z.string().max(40).optional().default(""),
        email: z.string().max(200).optional().default(""),
        address: z.string().max(1000).optional().default(""),
        cep: z.string().max(20).optional().default(""),
        city: z.string().max(120).optional().default(""),
        uf: z.string().max(2).optional().default(""),
        legalRepresentative: z.string().max(200).optional().default(""),
        isLegalRepresentative: z.boolean().optional().default(false),
      })
      .optional()
      .default({}),

    clientCompany: z
      .object({
        legalName: z.string().max(300).optional().default(""),
        tradeName: z.string().max(300).optional().default(""),
        cnpj: z.string().max(22).optional().default(""),
        stateRegistration: z.string().max(80).optional().default(""),
        legalRepName: z.string().max(200).optional().default(""),
        legalRepCpf: z.string().max(20).optional().default(""),
        legalRepRole: z.string().max(120).optional().default(""),
        phone: z.string().max(40).optional().default(""),
        email: z.string().max(200).optional().default(""),
        address: z.string().max(1000).optional().default(""),
      })
      .optional()
      .default({}),

    opposing: z
      .object({
        unknown: z.boolean().optional().default(false),
        parties: z.array(opposingPartySchema).max(12).optional().default([]),
      })
      .default({ unknown: false, parties: [{}] }),

    thirdParties: z
      .object({
        beneficiary: optionalTrimmed,
        witnesses: optionalTrimmed,
        minors: optionalTrimmed,
        legalRep: optionalTrimmed,
        publicBody: optionalTrimmed,
        institution: optionalTrimmed,
        other: optionalTrimmed,
      })
      .default({}),

    narrative: z.object({
      whatHappened: optionalTrimmed,
      whenHappened: optionalTrimmed,
      whereHappened: optionalTrimmed,
      whoParticipated: optionalTrimmed,
      howStarted: optionalTrimmed,
      askedDeniedCharged: optionalTrimmed,
      clientTriedResolve: optionalTrimmed,
      whoSpoke: optionalTrimmed,
      hasProtocol: optionalTrimmed,
      damage: optionalTrimmed,
      ongoing: optionalTrimmed,
      whatChanged: optionalTrimmed,
      freeText: optionalTrimmed,
    }),

    timeline: z.array(timelineRowSchema).max(80).optional().default([]),

    documents: z
      .object({
        checklist: docChecklistSchema.optional().default({}),
        missingNotes: optionalTrimmed,
        documentIds: z.array(z.string().cuid()).max(30).optional().default([]),
      })
      .default({ checklist: {}, missingNotes: "", documentIds: [] }),

    goals: z
      .object({
        clientWants: optionalTrimmed,
        idealOutcome: optionalTrimmed,
        minimumOutcome: optionalTrimmed,
        wantsSettlement: z.enum(["sim", "nao", "nao_sei"]).optional().default("nao_sei"),
        wantsLawsuit: z.enum(["sim", "nao", "nao_sei"]).optional().default("nao_sei"),
        wantsExtrajudicial: z.enum(["sim", "nao", "nao_sei"]).optional().default("nao_sei"),
        urgency: z.boolean().optional().default(false),
        deadlineExpiring: z.boolean().optional().default(false),
        hearingOrSummons: z.boolean().optional().default(false),
        immediateDamageRisk: z.boolean().optional().default(false),
        prescriptionRisk: z.boolean().optional().default(false),
        vulnerablePerson: z.boolean().optional().default(false),
        evidenceLossRisk: z.boolean().optional().default(false),
        unfavorableFacts: z.boolean().optional().default(false),
        approximateValue: optionalTrimmed,
      })
      .default({}),

    communication: z
      .object({
        preferredChannel: z.enum(["whatsapp", "email", "telefone", "outro"]).optional().default("whatsapp"),
        preferredTime: optionalTrimmed,
        nextMeeting: optionalTrimmed,
        internalNextTask: optionalTrimmed,
        needsFeeAgreement: z.boolean().optional().default(false),
        paymentArrangement: optionalTrimmed,
        clientInformedFees: z.boolean().optional().default(false),
        internalNotes: optionalTrimmed,
      })
      .default({}),

    /** Fluxo “só relato livre”: preenche narrative.freeText e pode omitir outros blocos. */
    freeNarrativeOnly: z.boolean().optional().default(false),
  })
  .superRefine((data, ctx) => {
    const cpf = onlyDigits(data.clientPerson?.cpf ?? "");
    if (cpf.length > 0 && !isValidCpf(data.clientPerson?.cpf ?? "")) {
      ctx.addIssue({ code: "custom", path: ["clientPerson", "cpf"], message: "CPF inválido." });
    }
    const cnpj = onlyDigits(data.clientCompany?.cnpj ?? "");
    if (cnpj.length > 0 && !isValidCnpj(data.clientCompany?.cnpj ?? "")) {
      ctx.addIssue({ code: "custom", path: ["clientCompany", "cnpj"], message: "CNPJ inválido." });
    }
    const repCpf = onlyDigits(data.clientCompany?.legalRepCpf ?? "");
    if (repCpf.length > 0 && !isValidCpf(data.clientCompany?.legalRepCpf ?? "")) {
      ctx.addIssue({ code: "custom", path: ["clientCompany", "legalRepCpf"], message: "CPF do representante inválido." });
    }
    const em = (data.clientPerson?.email ?? "").trim();
    if (em.length > 0 && !isValidEmail(em)) {
      ctx.addIssue({ code: "custom", path: ["clientPerson", "email"], message: "E-mail inválido." });
    }
    const emc = (data.clientCompany?.email ?? "").trim();
    if (emc.length > 0 && !isValidEmail(emc)) {
      ctx.addIssue({ code: "custom", path: ["clientCompany", "email"], message: "E-mail inválido." });
    }
    const ph = data.clientPerson?.phone ?? "";
    if (ph.replace(/\D/g, "").length > 0 && !isValidBrazilPhone(ph)) {
      ctx.addIssue({ code: "custom", path: ["clientPerson", "phone"], message: "Telefone inválido (mín. 10 dígitos)." });
    }
    const phc = data.clientCompany?.phone ?? "";
    if (phc.replace(/\D/g, "").length > 0 && !isValidBrazilPhone(phc)) {
      ctx.addIssue({ code: "custom", path: ["clientCompany", "phone"], message: "Telefone inválido (mín. 10 dígitos)." });
    }
    const cnj = onlyDigits(data.attend.cnj);
    if (data.attend.cnj.trim().length > 0 && cnj.length !== 20) {
      ctx.addIssue({ code: "custom", path: ["attend", "cnj"], message: "CNJ deve ter 20 dígitos." });
    }

    const clientName =
      data.clientKind === "PERSON"
        ? (data.clientPerson?.fullName ?? "").trim()
        : (data.clientCompany?.legalName ?? "").trim();
    if (clientName.length < 2) {
      ctx.addIssue({
        code: "custom",
        path: data.clientKind === "PERSON" ? ["clientPerson", "fullName"] : ["clientCompany", "legalName"],
        message: "Nome do cliente (pessoa ou empresa) é obrigatório.",
      });
    }

    const hasNarrativeBlock =
      (data.narrative.whatHappened ?? "").trim().length >= 10 ||
      (data.narrative.freeText ?? "").trim().length >= 20;
    const hasTimelineFact = (data.timeline ?? []).some((r) => (r.event ?? "").trim().length >= 8);
    if (!data.freeNarrativeOnly && !hasNarrativeBlock && !hasTimelineFact) {
      ctx.addIssue({
        code: "custom",
        path: ["narrative", "whatHappened"],
        message: "Descreva o que aconteceu, use o relato livre ou inclua ao menos um evento na linha do tempo.",
      });
    }
    if (data.freeNarrativeOnly && (data.narrative.freeText ?? "").trim().length < 20) {
      ctx.addIssue({
        code: "custom",
        path: ["narrative", "freeText"],
        message: "Relato livre deve ter pelo menos 20 caracteres.",
      });
    }

    for (let i = 0; i < (data.opposing.parties?.length ?? 0); i += 1) {
      const p = data.opposing.parties[i]!;
      const doc = onlyDigits(p.document);
      if (doc.length === 11 && !isValidCpf(p.document)) {
        ctx.addIssue({ code: "custom", path: ["opposing", "parties", i, "document"], message: "CPF da parte contrária inválido." });
      }
      if (doc.length === 14 && !isValidCnpj(p.document)) {
        ctx.addIssue({ code: "custom", path: ["opposing", "parties", i, "document"], message: "CNPJ da parte contrária inválido." });
      }
      const pe = (p.email ?? "").trim();
      if (pe.length > 0 && !isValidEmail(pe)) {
        ctx.addIssue({ code: "custom", path: ["opposing", "parties", i, "email"], message: "E-mail inválido." });
      }
    }
  });

export type FundamentalIntakeForm = z.infer<typeof fundamentalIntakeFormSchema>;

export function createDefaultFundamentalIntakeForm(): FundamentalIntakeForm {
  const todayIso = new Date().toISOString().slice(0, 10);
  return fundamentalIntakeFormSchema.parse({
    attend: {
      suggestedTitle: "Novo caso",
      probableLegalArea: "",
      preOrProcess: "pre_processual",
      cnj: "",
      tribunalVara: "",
      city: "Cidade do caso",
      uf: "SP",
      intakeDate: todayIso,
    },
    clientKind: "PERSON",
    clientPerson: {
      fullName: "Nome completo do cliente",
      cpf: "",
      phone: "",
      email: "",
    },
    narrative: {
      whatHappened:
        "Descreva o problema com as palavras do cliente. Depois o DeepSeek organizará fatos, partes, pedidos e riscos.",
    },
    timeline: [],
  });
}

export function emptyOpposingPartyRow(): z.infer<typeof opposingPartySchema> {
  return opposingPartySchema.parse({});
}

export function emptyTimelineRow(): z.infer<typeof timelineRowSchema> {
  return timelineRowSchema.parse({});
}

export function parseFundamentalIntakeForm(input: unknown) {
  return fundamentalIntakeFormSchema.safeParse(input);
}
