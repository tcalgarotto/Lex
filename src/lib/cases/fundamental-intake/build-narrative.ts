import type { FundamentalIntakeForm } from "./form-schema";

/**
 * Texto único enviado ao modelo + gravado em `Case.rawInput` para busca e auditoria.
 * Não inclui tokens técnicos de produto.
 */
export function buildIntakeNarrativeForModel(form: FundamentalIntakeForm): string {
  const lines: string[] = [];

  lines.push("=== ATENDIMENTO ===");
  lines.push(`Título sugerido: ${form.attend.suggestedTitle}`);
  lines.push(`Área provável: ${form.attend.probableLegalArea || "(não informado)"}`);
  lines.push(`Pré-processual ou processo: ${form.attend.preOrProcess}`);
  lines.push(`CNJ: ${form.attend.cnj || "(não informado)"}`);
  lines.push(`Tribunal/vara: ${form.attend.tribunalVara || "(não informado)"}`);
  lines.push(`Cidade/UF do caso: ${form.attend.city} / ${form.attend.uf}`);
  lines.push(`Advogado(a) responsável: ${form.attend.responsibleLawyer || "(não informado)"}`);
  lines.push(`Origem do cliente: ${form.attend.clientOrigin}`);
  lines.push(`Data do atendimento: ${form.attend.intakeDate || "(não informado)"}`);

  lines.push("\n=== CLIENTE / PARTE AUTORA ===");
  lines.push(`Tipo: ${form.clientKind === "PERSON" ? "Pessoa física" : "Pessoa jurídica"}`);
  if (form.clientKind === "PERSON") {
    const p = form.clientPerson ?? {};
    lines.push(`Nome: ${p.fullName || ""}`);
    lines.push(`CPF: ${p.cpf || "(não informado)"}`);
    lines.push(`RG: ${p.rg || "(não informado)"}`);
    lines.push(`Nascimento: ${p.birthDate || "(não informado)"}`);
    lines.push(`Nacionalidade: ${p.nationality || "(não informado)"}`);
    lines.push(`Estado civil: ${p.maritalStatus || "(não informado)"}`);
    lines.push(`Profissão: ${p.profession || "(não informado)"}`);
    lines.push(`Telefone: ${p.phone || "(não informado)"}`);
    lines.push(`E-mail: ${p.email || "(não informado)"}`);
    lines.push(`Endereço: ${p.address || "(não informado)"}`);
    lines.push(`CEP: ${p.cep || "(não informado)"} — Cidade/UF: ${p.city || ""} / ${p.uf || ""}`);
    lines.push(`Representante legal: ${p.legalRepresentative || "(não informado)"}`);
    lines.push(`É representante de terceiro: ${p.isLegalRepresentative ? "sim" : "não"}`);
  } else {
    const c = form.clientCompany ?? {};
    lines.push(`Razão social: ${c.legalName || ""}`);
    lines.push(`Nome fantasia: ${c.tradeName || "(não informado)"}`);
    lines.push(`CNPJ: ${c.cnpj || "(não informado)"}`);
    lines.push(`Inscrição: ${c.stateRegistration || "(não informado)"}`);
    lines.push(`Representante: ${c.legalRepName || "(não informado)"} — CPF: ${c.legalRepCpf || ""} — Cargo: ${c.legalRepRole || ""}`);
    lines.push(`Telefone: ${c.phone || "(não informado)"} — E-mail: ${c.email || "(não informado)"}`);
    lines.push(`Endereço: ${c.address || "(não informado)"}`);
  }

  lines.push("\n=== PARTE CONTRÁRIA ===");
  if (form.opposing.unknown) {
    lines.push("Parte contrária ainda não identificada (lacuna).");
  }
  for (const op of form.opposing.parties ?? []) {
    const head = (op.name ?? "").trim();
    if (!head && !(op.document ?? "").trim()) continue;
    lines.push(`— Nome/Razão: ${op.name || "(não informado)"}`);
    lines.push(`  Documento: ${op.document || "(não informado)"}`);
    lines.push(`  Endereço: ${op.address || "(não informado)"} — ${op.city || ""}/${op.uf || ""}`);
    lines.push(`  Contato: ${op.phone || ""} ${op.email || ""}`);
    lines.push(`  Relação com o cliente: ${op.relationToClient || "(não informado)"}`);
    lines.push(`  Participação no problema: ${op.participation || "(não informado)"}`);
  }

  lines.push("\n=== TERCEIROS ===");
  const t = form.thirdParties;
  lines.push(`Beneficiário: ${t.beneficiary || "(não informado)"}`);
  lines.push(`Testemunhas: ${t.witnesses || "(não informado)"}`);
  lines.push(`Menores: ${t.minors || "(não informado)"}`);
  lines.push(`Responsável legal: ${t.legalRep || "(não informado)"}`);
  lines.push(`Órgão público: ${t.publicBody || "(não informado)"}`);
  lines.push(`Instituição/empresa: ${t.institution || "(não informado)"}`);
  lines.push(`Outros: ${t.other || "(não informado)"}`);

  lines.push("\n=== RELATO ESTRUTURADO ===");
  const n = form.narrative;
  lines.push(`O que aconteceu: ${n.whatHappened || "(não informado)"}`);
  lines.push(`Quando: ${n.whenHappened || "(não informado)"}`);
  lines.push(`Onde: ${n.whereHappened || "(não informado)"}`);
  lines.push(`Quem participou: ${n.whoParticipated || "(não informado)"}`);
  lines.push(`Como começou: ${n.howStarted || "(não informado)"}`);
  lines.push(`Pedido/negativa/cobrança/promessa: ${n.askedDeniedCharged || "(não informado)"}`);
  lines.push(`Tentativa de resolução: ${n.clientTriedResolve || "(não informado)"}`);
  lines.push(`Com quem falou: ${n.whoSpoke || "(não informado)"}`);
  lines.push(`Protocolo/comprovação: ${n.hasProtocol || "(não informado)"}`);
  lines.push(`Prejuízo: ${n.damage || "(não informado)"}`);
  lines.push(`Problema continua: ${n.ongoing ? "sim" : "não / não informado"}`);
  lines.push(`O que mudou: ${n.whatChanged || "(não informado)"}`);
  if ((n.freeText ?? "").trim().length > 0) {
    lines.push("\n--- Relato livre completo ---\n" + n.freeText.trim());
  }

  lines.push("\n=== LINHA DO TEMPO (formulário) ===");
  for (const row of form.timeline ?? []) {
    if (!(row.event ?? "").trim() && !(row.date ?? "").trim()) continue;
    lines.push(
      `* ${row.date || "(s/data)"} — ${row.event || ""} | Quem: ${row.who || ""} | Doc: ${row.documentRef || ""} | Obs: ${row.note || ""}`,
    );
  }

  lines.push("\n=== DOCUMENTOS / PROVAS (checklist) ===");
  const ch = form.documents.checklist ?? {};
  lines.push(JSON.stringify(ch, null, 2));
  lines.push(`Documentos ainda faltantes (notas): ${form.documents.missingNotes || "(não informado)"}`);

  lines.push("\n=== OBJETIVO E URGÊNCIA ===");
  const g = form.goals;
  lines.push(`O que o cliente quer: ${g.clientWants || "(não informado)"}`);
  lines.push(`Resultado ideal: ${g.idealOutcome || "(não informado)"}`);
  lines.push(`Resultado mínimo: ${g.minimumOutcome || "(não informado)"}`);
  lines.push(`Acordo: ${g.wantsSettlement} — Ação judicial: ${g.wantsLawsuit} — Notificação extrajudicial: ${g.wantsExtrajudicial}`);
  lines.push(
    `Urgência: ${g.urgency} | Prazo: ${g.deadlineExpiring} | Audiência/intimação: ${g.hearingOrSummons} | Dano imediato: ${g.immediateDamageRisk} | Prescrição/decadência: ${g.prescriptionRisk}`,
  );
  lines.push(
    `Vulnerável: ${g.vulnerablePerson} | Perda de prova: ${g.evidenceLossRisk} | Fatos desfavoráveis declarados: ${g.unfavorableFacts}`,
  );
  lines.push(`Valor aproximado: ${g.approximateValue || "(não informado)"}`);

  lines.push("\n=== COMUNICAÇÃO E PRÓXIMOS PASSOS ===");
  const c = form.communication;
  lines.push(`Canal preferencial: ${c.preferredChannel}`);
  lines.push(`Horário preferencial: ${c.preferredTime || "(não informado)"}`);
  lines.push(`Próxima reunião: ${c.nextMeeting || "(não informado)"}`);
  lines.push(`Próxima tarefa interna: ${c.internalNextTask || "(não informado)"}`);
  lines.push(`Contrato de honorários: ${c.needsFeeAgreement ? "sim" : "não"}`);
  lines.push(`Cliente informado sobre honorários: ${c.clientInformedFees ? "sim" : "não"}`);
  lines.push(`Forma de pagamento combinada: ${c.paymentArrangement || "(não informado)"}`);
  lines.push(`Observações internas: ${c.internalNotes || "(não informado)"}`);

  if (form.userConfirmedPaths?.length) {
    lines.push("\n=== CAMPOS CONFIRMADOS PELO ADVOGADO (não alterar) ===");
    lines.push(form.userConfirmedPaths.join(", "));
  }

  return lines.join("\n");
}
