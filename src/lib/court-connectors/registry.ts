import { CourtConnectionAuthType, CourtConnectorStatus, CourtConnectorType } from "@prisma/client";

export type CourtConnectorCapability =
  | "process_metadata"
  | "movements"
  | "official_communications"
  | "publications"
  | "intimation"
  | "deadline_review"
  | "petitioning"
  | "case_files"
  | "attachments"
  | "public_search"
  | "authenticated_access"
  | "manual_import"
  | "deep_link"
  | "sync"
  | "webhook";

export type CourtConnectorRisk =
  | "no_case_files"
  | "no_official_intimation"
  | "requires_human_review"
  | "requires_official_authorization"
  | "requires_user_login"
  | "requires_certificate"
  | "no_scraping"
  | "rate_limited"
  | "no_deadline_calculation";

export type CourtConnectorDefinition = {
  provider: CourtConnectorType;
  name: string;
  shortName: string;
  status: CourtConnectorStatus;
  authType: CourtConnectionAuthType;
  free: boolean;
  official: boolean;
  hasPublicApi: boolean;
  requiresLogin: boolean;
  requiresCertificate: boolean;
  canRunAutomatically: boolean;
  requiresHumanAction: boolean;
  description: string;
  delivers: string[];
  limitations: string[];
  capabilities: CourtConnectorCapability[];
  risks: CourtConnectorRisk[];
  officialUrls: string[];
  primaryActionLabel: string;
  primaryActionUrl?: string;
};

export const COURT_CONNECTOR_DEFINITIONS: CourtConnectorDefinition[] = [
  {
    provider: CourtConnectorType.DATAJUD_PUBLIC,
    name: "DataJud Público",
    shortName: "DataJud",
    status: CourtConnectorStatus.active,
    authType: CourtConnectionAuthType.NONE,
    free: true,
    official: true,
    hasPublicApi: true,
    requiresLogin: false,
    requiresCertificate: false,
    canRunAutomatically: true,
    requiresHumanAction: false,
    description: "API Pública do CNJ para metadados, capa e movimentações públicas.",
    delivers: ["Capa processual", "Movimentações públicas", "Classe, assunto, órgão julgador e última atualização"],
    limitations: ["Não entrega autos completos", "Não substitui intimação oficial", "Pode ter atraso por tribunal"],
    capabilities: ["process_metadata", "movements", "public_search", "sync", "deep_link"],
    risks: ["no_case_files", "no_official_intimation", "rate_limited"],
    officialUrls: ["https://www.cnj.jus.br/sistemas/datajud/api-publica/", "https://datajud-wiki.cnj.jus.br/api-publica/"],
    primaryActionLabel: "Testar DataJud",
  },
  {
    provider: CourtConnectorType.ESCRITORIO_DIGITAL,
    name: "Escritório Digital",
    shortName: "Escritório Digital",
    status: CourtConnectorStatus.manual_bridge,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: true,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Abertura assistida para autos, intimações e peticionamento no portal oficial.",
    delivers: ["Acesso assistido ao portal oficial", "Importação manual de documentos e intimações", "Checklist de conferência"],
    limitations: ["JustOS não acessa a conta do advogado", "Sem senha, PIN, sessão ou certificado armazenado", "Automação depende de integração oficial futura"],
    capabilities: ["authenticated_access", "case_files", "intimation", "petitioning", "manual_import", "deep_link"],
    risks: ["requires_user_login", "requires_certificate", "no_scraping", "requires_human_review"],
    officialUrls: ["https://www.cnj.jus.br/sistemas/escritorio-digital/como-funciona/"],
    primaryActionLabel: "Abrir Escritório Digital",
    primaryActionUrl: "https://escritoriodigital.pdpj.jus.br/",
  },
  {
    provider: CourtConnectorType.MNI,
    name: "Modelo Nacional de Interoperabilidade",
    shortName: "MNI",
    status: CourtConnectorStatus.requires_official_authorization,
    authType: CourtConnectionAuthType.OFFICIAL_TOKEN,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: false,
    description: "Camada oficial de interoperabilidade quando houver autorização, convênio e credenciais formais.",
    delivers: ["Integração institucional quando habilitada", "Padrões oficiais documentados"],
    limitations: ["Não é API pública SaaS", "Não será marcado como ativo sem credencial oficial"],
    capabilities: ["authenticated_access", "webhook", "sync"],
    risks: ["requires_official_authorization", "no_scraping"],
    officialUrls: ["https://www.cnj.jus.br/versao-2-2-2-07-07-2014/"],
    primaryActionLabel: "Ver requisitos oficiais",
  },
  {
    provider: CourtConnectorType.DOMICILIO_JUDICIAL,
    name: "Domicílio Judicial Eletrônico",
    shortName: "Domicílio Judicial",
    status: CourtConnectorStatus.manual_bridge,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Bridge assistido para registrar comunicações recebidas no ambiente oficial.",
    delivers: ["Registro manual de citação, intimação, ofício e audiência", "Tarefa de revisão humana", "Upload/colar comunicação"],
    limitations: ["API automatizada exige credenciais oficiais/habilitação", "JustOS não calcula prazo final automaticamente"],
    capabilities: ["official_communications", "intimation", "deadline_review", "manual_import", "deep_link"],
    risks: ["requires_user_login", "requires_official_authorization", "requires_human_review", "no_deadline_calculation"],
    officialUrls: ["https://www.cnj.jus.br/tecnologia-da-informacao-e-comunicacao/justica-4-0/domicilio-judicial-eletronico/"],
    primaryActionLabel: "Abrir Domicílio Judicial",
    primaryActionUrl: "https://domicilio-eletronico.pdpj.jus.br/",
  },
  {
    provider: CourtConnectorType.DJEN,
    name: "DJEN e Comunicações Processuais",
    shortName: "DJEN",
    status: CourtConnectorStatus.public_read_only,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: false,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Publicações oficiais e comunicações processuais por busca/import manual até haver API pública estável.",
    delivers: ["Busca/importação manual de publicação", "Vínculo ao processo/caso", "Alerta de revisão"],
    limitations: ["PCP/API usa credenciais CNJ Corporativo para sistemas habilitados", "Publicação encontrada não confirma prazo calculado"],
    capabilities: ["publications", "public_search", "manual_import", "deadline_review"],
    risks: ["requires_official_authorization", "requires_human_review", "no_deadline_calculation"],
    officialUrls: ["https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/comunicacoes-processuais/"],
    primaryActionLabel: "Registrar publicação",
  },
  {
    provider: CourtConnectorType.OFFICIAL_GAZETTE,
    name: "Diários oficiais públicos",
    shortName: "Diários oficiais",
    status: CourtConnectorStatus.available,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: false,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Camada para importação manual de publicações de diários oficiais públicos.",
    delivers: ["Registro de publicação oficial", "Vínculo a processo/caso", "Alerta para conferência"],
    limitations: ["Sem crawler massivo", "Cada diário deve ser avaliado antes de automação"],
    capabilities: ["publications", "manual_import", "deep_link"],
    risks: ["requires_human_review", "no_deadline_calculation", "no_scraping"],
    officialUrls: [],
    primaryActionLabel: "Importar publicação",
  },
  {
    provider: CourtConnectorType.TRIBUNAL_PUBLIC_QUERY,
    name: "Consultas públicas de tribunais",
    shortName: "Tribunais",
    status: CourtConnectorStatus.public_read_only,
    authType: CourtConnectionAuthType.NONE,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: false,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Links profundos e abertura assistida para consultas públicas permitidas por tribunal.",
    delivers: ["Link para fonte oficial", "Instruções por sistema", "Fallback DataJud"],
    limitations: ["Não contorna captcha", "Não automatiza sessão", "Não baixa autos protegidos"],
    capabilities: ["public_search", "deep_link", "manual_import"],
    risks: ["no_scraping", "requires_human_review"],
    officialUrls: [],
    primaryActionLabel: "Abrir fonte oficial",
  },
  {
    provider: CourtConnectorType.PJE,
    name: "PJe",
    shortName: "PJe",
    status: CourtConnectorStatus.manual_bridge,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: true,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Abertura assistida; automação só com integração oficial autorizada.",
    delivers: ["Consulta manual", "Upload/colar ato processual", "Link oficial quando conhecido"],
    limitations: ["Sem acesso automatizado à conta", "Sem certificado no JustOS"],
    capabilities: ["authenticated_access", "manual_import", "deep_link"],
    risks: ["requires_user_login", "requires_certificate", "no_scraping"],
    officialUrls: ["https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/"],
    primaryActionLabel: "Abrir PJe",
  },
  {
    provider: CourtConnectorType.EPROC,
    name: "eproc",
    shortName: "eproc",
    status: CourtConnectorStatus.manual_bridge,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Abertura assistida para consulta pública ou acesso autenticado pelo usuário.",
    delivers: ["Link oficial quando conhecido", "Importação manual"],
    limitations: ["Sem API pública ampla confirmada", "Sem sessão armazenada"],
    capabilities: ["public_search", "authenticated_access", "manual_import", "deep_link"],
    risks: ["requires_user_login", "no_scraping", "requires_human_review"],
    officialUrls: [],
    primaryActionLabel: "Abrir eproc",
  },
  {
    provider: CourtConnectorType.ESAJ,
    name: "e-SAJ",
    shortName: "e-SAJ",
    status: CourtConnectorStatus.manual_bridge,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Abertura assistida, sem scraping, captcha bypass ou automação de login.",
    delivers: ["Consulta pública quando disponível", "Importação manual"],
    limitations: ["Sem API pública oficial ampla", "Pode exigir captcha/login no portal"],
    capabilities: ["public_search", "authenticated_access", "manual_import", "deep_link"],
    risks: ["requires_user_login", "no_scraping", "requires_human_review"],
    officialUrls: ["https://www.tjsp.jus.br/Processos"],
    primaryActionLabel: "Abrir e-SAJ",
  },
  {
    provider: CourtConnectorType.PROJUDI,
    name: "Projudi",
    shortName: "Projudi",
    status: CourtConnectorStatus.manual_bridge,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: true,
    hasPublicApi: false,
    requiresLogin: true,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Abertura assistida para consulta pública ou portal autenticado.",
    delivers: ["Link oficial quando conhecido", "Importação manual"],
    limitations: ["Sem API pública ampla confirmada", "Sem sessão armazenada"],
    capabilities: ["public_search", "authenticated_access", "manual_import", "deep_link"],
    risks: ["requires_user_login", "no_scraping", "requires_human_review"],
    officialUrls: ["https://www.tjpr.jus.br/consulta-processo-virtual"],
    primaryActionLabel: "Abrir Projudi",
  },
  {
    provider: CourtConnectorType.MANUAL_UPLOAD,
    name: "Upload manual de fonte oficial",
    shortName: "Upload manual",
    status: CourtConnectorStatus.active,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: false,
    hasPublicApi: false,
    requiresLogin: false,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Ponte ativa para anexar PDF/documento obtido em fonte oficial pelo advogado.",
    delivers: ["Anexo oficial organizado", "Vínculo ao processo/caso", "Revisão humana"],
    limitations: ["Origem depende de declaração do usuário", "Não substitui conferência no portal oficial"],
    capabilities: ["attachments", "manual_import", "deadline_review"],
    risks: ["requires_human_review", "no_deadline_calculation"],
    officialUrls: [],
    primaryActionLabel: "Anexar documento",
  },
  {
    provider: CourtConnectorType.MANUAL_PASTE,
    name: "Colar texto de fonte oficial",
    shortName: "Colar texto",
    status: CourtConnectorStatus.active,
    authType: CourtConnectionAuthType.MANUAL,
    free: true,
    official: false,
    hasPublicApi: false,
    requiresLogin: false,
    requiresCertificate: false,
    canRunAutomatically: false,
    requiresHumanAction: true,
    description: "Ponte ativa para colar movimentação, intimação ou publicação obtida em fonte oficial.",
    delivers: ["Comunicação estruturada", "Alerta de revisão", "Rastro de origem manual"],
    limitations: ["Não calcula prazo final", "Texto precisa ser conferido pelo advogado"],
    capabilities: ["manual_import", "official_communications", "deadline_review"],
    risks: ["requires_human_review", "no_deadline_calculation"],
    officialUrls: [],
    primaryActionLabel: "Colar texto",
  },
];

export function getCourtConnectorDefinitions() {
  return COURT_CONNECTOR_DEFINITIONS;
}

export function getCourtConnectorDefinition(provider: CourtConnectorType) {
  return COURT_CONNECTOR_DEFINITIONS.find((connector) => connector.provider === provider) ?? null;
}

export function isConnectorActiveWithoutOfficialAuthorization(connector: CourtConnectorDefinition) {
  return (
    connector.status === CourtConnectorStatus.active &&
    (connector.requiresLogin || connector.requiresCertificate || connector.risks.includes("requires_official_authorization"))
  );
}
