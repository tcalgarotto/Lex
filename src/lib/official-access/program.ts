import type { CourtConnectorType } from "@prisma/client";

export type OfficialAccessStatus =
  | "active"
  | "public_api_available"
  | "audit"
  | "requires_institutional_credential"
  | "requires_homologation"
  | "tribunal_dependent"
  | "assisted_bridge"
  | "blocked";

export type OfficialAccessRisk = "low" | "medium" | "high";

export type OfficialAccessCapability =
  | "process_metadata"
  | "movements"
  | "publications"
  | "official_communications"
  | "case_files"
  | "petitioning"
  | "deadlines"
  | "public_query"
  | "mni";

export interface OfficialCredentialProvider {
  id: string;
  label: string;
  connector: CourtConnectorType | "TRIBUNAL_DIRECT";
  authType: "none" | "oauth2" | "client_credentials" | "mni_soap" | "official_token";
  storage: "none" | "server_encrypted_secret";
  scopes: string[];
  rotationRequired: boolean;
  revocationRequired: boolean;
  auditLogRequired: boolean;
  clientVisible: false;
}

export interface OfficialApiConnector {
  id: string;
  label: string;
  baseUrl?: string;
  documentationUrl: string;
  status: OfficialAccessStatus;
  capabilities: OfficialAccessCapability[];
  credentialProviderId?: string;
  publicEndpoints: string[];
  authenticatedEndpoints: string[];
  forbiddenAutomation: string[];
}

export interface OfficialAccessRequest {
  id: string;
  sourceId: string;
  requestedByUserId: string;
  workspaceId: string;
  institutionName: string;
  status: "draft" | "submitted" | "homologation" | "approved" | "rejected" | "revoked";
  requiredDocuments: string[];
  nextStep: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface OfficialAccessAuditLog {
  id: string;
  workspaceId: string;
  sourceId: string;
  actorUserId: string;
  action: "requested" | "credential_created" | "credential_rotated" | "credential_revoked" | "api_called";
  targetType: "access_request" | "credential" | "connector";
  targetId: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export type OfficialAccessProgramSource = {
  id: string;
  source: string;
  publicApi: string;
  authenticatedApi: string;
  accessPath: string;
  delivers: string;
  status: OfficialAccessStatus;
  risk: OfficialAccessRisk;
  nextStep: string;
  documentationUrls: string[];
};

export const OFFICIAL_ACCESS_PROGRAM_SOURCES: OfficialAccessProgramSource[] = [
  {
    id: "datajud",
    source: "DataJud CNJ",
    publicApi: "Sim",
    authenticatedApi: "Nao necessaria para metadados publicos",
    accessPath: "Chave publica DataJud configurada no servidor",
    delivers: "Capa, metadados e movimentacoes publicas",
    status: "active",
    risk: "low",
    nextStep: "Manter monitoramento de aliases e limites de uso.",
    documentationUrls: ["https://www.cnj.jus.br/sistemas/datajud/api-publica/", "https://datajud-wiki.cnj.jus.br/api-publica/"],
  },
  {
    id: "djen-comunica-pje",
    source: "DJEN / Comunica PJe",
    publicApi: "GET /api/v1/comunicacao sem token",
    authenticatedApi: "Login, inclusao, exclusao e certidoes operacionais sao oficiais/tribunais",
    accessPath: "Leitura publica por numeroProcesso, texto, siglaTribunal, OAB, parte e datas",
    delivers: "Publicacoes e comunicacoes publicas para revisao humana",
    status: "public_api_available",
    risk: "medium",
    nextStep: "Usar apenas leitura publica, com rate limit e sem promessa de prazo.",
    documentationUrls: [
      "https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/orientacoes-aos-tribunais/",
      "https://app.swaggerhub.com/apis-docs/cnj/pcp/1.0.0",
    ],
  },
  {
    id: "domicilio-api",
    source: "Domicilio Judicial Eletronico",
    publicApi: "Nao para consumo de expedientes",
    authenticatedApi: "Sim, API para instituicoes via client credentials/OAuth2",
    accessPath: "Cadastro do CNPJ, aceite de termo, geracao de client/secret e header On-behalf-Of",
    delivers: "Comunicacoes destinadas a instituicao, ciencia e logs conforme escopo oficial",
    status: "requires_institutional_credential",
    risk: "high",
    nextStep: "Solicitar acesso institucional e homologar antes de qualquer automacao.",
    documentationUrls: ["https://docs.pdpj.jus.br/servicos-negociais/domicilio-judicial-eletronico"],
  },
  {
    id: "escritorio-digital-mni",
    source: "Escritorio Digital / MNI 2.2.2",
    publicApi: "Nao",
    authenticatedApi: "MNI SOAP quando tribunal homologa e autoriza",
    accessPath: "Homologacao CNJ/tribunal com WSDL, dados tecnicos e credenciais formais",
    delivers: "Consulta processual, avisos pendentes e teor de comunicacao quando habilitado",
    status: "requires_homologation",
    risk: "high",
    nextStep: "Abrir trilha institucional com CNJ/tribunais prioritarios.",
    documentationUrls: ["https://www.cnj.jus.br/integracao-para-os-tribunais/"],
  },
  {
    id: "tjrs",
    source: "TJRS",
    publicApi: "API de dados abertos e consulta publica/eproc",
    authenticatedApi: "Dependente de eproc/MNI/autorizacao do tribunal",
    accessPath: "Consulta publica agora; integracao real depende de termo/credencial do TJRS",
    delivers: "Consulta publica, dados abertos e fallback DataJud",
    status: "tribunal_dependent",
    risk: "medium",
    nextStep: "Priorizar descoberta formal de API processual autorizada e termos de uso.",
    documentationUrls: ["https://www.tjrs.jus.br/novo/api-de-dados-abertos/"],
  },
  {
    id: "tjsc",
    source: "TJSC",
    publicApi: "Consulta publica eproc; API publica ampla nao confirmada",
    authenticatedApi: "eproc com login/perfil; MNI depende de autorizacao",
    accessPath: "Bridge assistido; qualquer automacao exige convenio/credencial",
    delivers: "Consulta manual, comunicacoes e peticionamento pelo usuario no eproc",
    status: "assisted_bridge",
    risk: "medium",
    nextStep: "Solicitar posicionamento oficial sobre API/MNI para terceiros.",
    documentationUrls: ["https://www.tjsc.jus.br/web/processo-eletronico-eproc/usuarios-externos"],
  },
  {
    id: "tjsp",
    source: "TJSP",
    publicApi: "Consulta publica e-SAJ/eproc; API oficial publica ampla nao confirmada",
    authenticatedApi: "MNI/e-SAJ/eproc dependem de credencial/autorizacao",
    accessPath: "Bridge assistido para consulta publica; sem captcha bypass",
    delivers: "Dados basicos publicos conforme Res. CNJ 121 e portal oficial",
    status: "assisted_bridge",
    risk: "medium",
    nextStep: "Manter apenas deep link e buscar canal oficial de integracao.",
    documentationUrls: ["https://www.tjsp.jus.br/Processos"],
  },
  {
    id: "trf4",
    source: "TRF4",
    publicApi: "Consulta publica eproc; API publica ampla nao confirmada",
    authenticatedApi: "eproc/MNI dependem de credencial e termos",
    accessPath: "Consulta publica agora; integracao real depende de autorizacao",
    delivers: "Consulta publica, eproc e fallback DataJud",
    status: "tribunal_dependent",
    risk: "medium",
    nextStep: "Priorizar por maturidade eproc/MNI e termos publicados.",
    documentationUrls: ["https://www.trf4.jus.br/trf4/controlador.php?acao=pagina_visualizar&id_pagina=2201"],
  },
];

export function getOfficialAccessProgramSources() {
  return OFFICIAL_ACCESS_PROGRAM_SOURCES;
}
