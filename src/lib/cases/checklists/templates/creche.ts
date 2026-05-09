/**
 * Checklist guiado: "Constitucional — vaga em creche".
 *
 * Cobre o atendimento típico de demanda por vaga em educação infantil
 * (CF/88 art. 208 IV, art. 205, art. 227; ECA art. 53-54). Estruturado
 * para que o advogado conduza entrevista com a cliente sem omitir
 * pergunta crítica para a peça processual (mandado de segurança ou
 * ação de obrigação de fazer contra Município).
 *
 * Versionado — incrementar `version` ao alterar IDs de campos.
 */

import type { ChecklistTemplate } from "../registry";

export const CRECHE_CHECKLIST: ChecklistTemplate = {
  id: "constitucional.educacao.creche",
  label: "Constitucional — vaga em creche",
  version: 1,
  area: ["Constitucional", "Educação", "Infância"],
  triggers: {
    keywords: [
      "vaga em creche",
      "creche",
      "educação infantil",
      "matrícula creche",
      "secretaria de educação",
      "berçário",
      "pré-escola",
    ],
    brainHints: ["educação", "infância", "criança", "constitucional"],
  },
  sections: [
    {
      id: "identificacao",
      title: "1. Identificação",
      description:
        "Cadastre responsável e criança beneficiária. Vínculo e idade são cruciais para a tese constitucional.",
      fields: [
        { id: "guardian_name", label: "Nome do responsável", kind: "text", required: true, brainPath: "parties[role=assisted_party].name" },
        { id: "guardian_cpf", label: "CPF do responsável", kind: "cpf", required: false, brainPath: "parties[role=assisted_party].document" },
        { id: "guardian_phone", label: "Telefone de contato", kind: "phone", required: false, brainPath: "parties[role=assisted_party].contact" },
        { id: "address", label: "Endereço completo", kind: "text", required: true, brainPath: "parties[role=assisted_party].address" },
        { id: "city_uf", label: "Cidade / UF", kind: "text", required: true, helpText: "Município competente para a obrigação." },
        { id: "child_name", label: "Nome da criança", kind: "text", required: true, brainPath: "parties[role=child_or_dependent].name" },
        { id: "child_birthdate", label: "Data de nascimento da criança", kind: "date", required: true, blocker: true, brainPath: "parties[role=child_or_dependent].age" },
        {
          id: "child_relationship",
          label: "Vínculo com a criança",
          kind: "single_choice",
          required: true,
          options: [
            { id: "mother", label: "Mãe" },
            { id: "father", label: "Pai" },
            { id: "guardian", label: "Responsável legal/guarda" },
            { id: "grandparent", label: "Avô/Avó" },
            { id: "other", label: "Outro" },
          ],
          brainPath: "parties[role=child_or_dependent].relationship",
        },
      ],
    },
    {
      id: "situacao_vaga",
      title: "2. Situação da vaga",
      fields: [
        {
          id: "currently_enrolled",
          label: "A criança está matriculada hoje em alguma instituição?",
          kind: "single_choice",
          required: true,
          options: [
            { id: "no", label: "Não" },
            { id: "private", label: "Sim, em rede privada (custeio próprio)" },
            { id: "conveniada", label: "Sim, em creche conveniada" },
            { id: "outra_municipal", label: "Sim, em creche municipal de outra localidade" },
          ],
        },
        {
          id: "admin_request_made",
          label: "Foi feito pedido de matrícula na rede municipal?",
          kind: "boolean",
          required: true,
          blocker: true,
          helpText: "Pedido administrativo prévio é geralmente requisito para a tutela jurisdicional.",
        },
        { id: "admin_request_date", label: "Data do pedido administrativo", kind: "date", required: false },
        { id: "admin_request_location", label: "Local/canal do pedido (CEMEI, secretaria, app, etc.)", kind: "text", required: false },
        { id: "admin_request_protocol", label: "Número de protocolo / inscrição", kind: "text", required: false },
      ],
    },
    {
      id: "resposta_municipio",
      title: "3. Resposta do Município",
      description:
        "Documentar negativa, fila ou omissão do Município é o que sustenta o cabimento de MS ou ação de obrigação de fazer.",
      fields: [
        {
          id: "municipality_response",
          label: "Qual foi a resposta do Município?",
          kind: "single_choice",
          required: true,
          blocker: true,
          options: [
            { id: "formal_denial", label: "Negativa formal (ofício/email/protocolo)" },
            { id: "verbal_denial", label: "Negativa apenas verbal" },
            { id: "waiting_list", label: "Inscrição em fila de espera" },
            { id: "no_response", label: "Sem resposta / omissão" },
            { id: "deferred_partial", label: "Deferimento parcial (vaga distante ou período diferente do solicitado)" },
            { id: "verbal_orientation", label: "Apenas orientação verbal sem decisão" },
          ],
        },
        { id: "waiting_list", label: "Posição na fila / quantidade de inscritos à frente", kind: "text", required: false },
        {
          id: "evidence_documents",
          label: "Documentos comprobatórios disponíveis",
          kind: "multi_choice",
          required: false,
          options: [
            { id: "official_protocol", label: "Protocolo oficial" },
            { id: "email", label: "E-mail da Secretaria" },
            { id: "whatsapp", label: "Print de WhatsApp" },
            { id: "declaration", label: "Declaração escrita" },
            { id: "screenshot_app", label: "Print de aplicativo/sistema" },
            { id: "media", label: "Recibos, boletos, anexos diversos" },
          ],
        },
      ],
    },
    {
      id: "urgencia",
      title: "4. Urgência",
      fields: [
        {
          id: "urgency_factors",
          label: "Fatores de urgência aplicáveis",
          kind: "multi_choice",
          required: false,
          options: [
            { id: "guardian_works", label: "Responsável trabalha fora" },
            { id: "risk_job_loss", label: "Risco real de perda do emprego" },
            { id: "no_support_network", label: "Ausência de rede de apoio (família/vizinhos)" },
            { id: "no_education", label: "Criança fora de educação infantil há mais de 90 dias" },
            { id: "social_vulnerability", label: "Vulnerabilidade social comprovada (CRAS, Bolsa Família, etc.)" },
            { id: "single_caregiver", label: "Responsável único (mãe/pai sozinho)" },
            { id: "health_risk", label: "Risco à saúde / desenvolvimento da criança" },
            { id: "other", label: "Outro motivo de urgência" },
          ],
        },
        { id: "urgency_detail", label: "Detalhes da urgência (texto livre)", kind: "long_text", required: false },
      ],
    },
    {
      id: "documentos",
      title: "5. Documentos",
      description:
        "Marque o que a cliente tem em mãos. Documento ausente vira pendência (falta solicitar à cliente).",
      fields: [
        {
          id: "documents_available",
          label: "Documentos disponíveis hoje",
          kind: "multi_choice",
          required: false,
          options: [
            { id: "birth_cert", label: "Certidão de nascimento da criança" },
            { id: "guardian_id", label: "Documento do responsável" },
            { id: "address_proof", label: "Comprovante de residência" },
            { id: "admin_protocol", label: "Protocolo do pedido administrativo" },
            { id: "whatsapp_print", label: "Print do WhatsApp da Secretaria" },
            { id: "email_secretaria", label: "E-mail da Secretaria de Educação" },
            { id: "declaration_secretaria", label: "Declaração formal da Secretaria" },
            { id: "waiting_list_proof", label: "Comprovante de fila de espera" },
            { id: "work_proof", label: "Comprovante de trabalho do responsável" },
            { id: "income_proof", label: "Comprovante de renda" },
            { id: "social_assistance", label: "Cadastro CRAS / Bolsa Família" },
          ],
        },
      ],
    },
    {
      id: "objetivo",
      title: "6. Objetivo da cliente",
      fields: [
        {
          id: "client_goal",
          label: "Objetivo principal",
          kind: "multi_choice",
          required: true,
          options: [
            { id: "immediate_municipal", label: "Vaga imediata em creche municipal" },
            { id: "conveniada", label: "Vaga em rede conveniada" },
            { id: "near_home", label: "Vaga próxima da residência" },
            { id: "near_work", label: "Vaga próxima do trabalho" },
            { id: "guidance_only", label: "Apenas orientação jurídica" },
            { id: "ressarcimento_priv", label: "Ressarcimento de mensalidade da rede privada" },
            { id: "other", label: "Outro" },
          ],
        },
        { id: "additional_notes", label: "Observações adicionais", kind: "long_text", required: false },
      ],
    },
  ],
};
