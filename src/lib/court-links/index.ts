type BuildCourtPublicQueryUrlInput = {
  cnj?: string | null;
  tribunalAcronym?: string | null;
  system?: string | null;
};

export type CourtPublicQueryLink = {
  label: string;
  url: string | null;
  instruction: string;
  requiresManualSearch: boolean;
};

const DIRECT_TRIBUNAL_URLS: Record<string, string> = {
  TJRS: "https://www.tjrs.jus.br/novo/busca/?return=proc&client=wp_index",
  TJSP: "https://esaj.tjsp.jus.br/cpopg/open.do",
  TRF4: "https://consulta.trf4.jus.br/trf4/controlador.php?acao=consulta_processual_pesquisa",
  TRT4: "https://pje.trt4.jus.br/consultaprocessual/",
  TJPR: "https://projudi.tjpr.jus.br/projudi/",
};

const SYSTEM_URLS: Record<string, string> = {
  PJE: "https://www.cnj.jus.br/programas-e-acoes/processo-judicial-eletronico-pje/",
  EPROC: "https://eproc.jfrs.jus.br/eprocV2/",
  ESAJ: "https://www.tjsp.jus.br/Processos",
  PROJUDI: "https://www.tjpr.jus.br/consulta-processo-virtual",
};

function normalizeKey(value?: string | null) {
  return value?.trim().toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
}

export function buildCourtPublicQueryUrl(input: BuildCourtPublicQueryUrlInput): CourtPublicQueryLink {
  const tribunal = normalizeKey(input.tribunalAcronym);
  const system = normalizeKey(input.system);
  const cnj = input.cnj?.trim() ?? "";

  const direct = tribunal ? DIRECT_TRIBUNAL_URLS[tribunal] : null;
  if (direct) {
    const separator = direct.includes("?") ? "&" : "?";
    return {
      label: `Consulta pública ${tribunal}`,
      url: cnj ? `${direct}${separator}numeroProcesso=${encodeURIComponent(cnj)}` : direct,
      instruction: "Abra a página oficial e confira o processo manualmente. Se o portal não aceitar CNJ na URL, cole o número no campo de busca.",
      requiresManualSearch: true,
    };
  }

  const systemUrl = system ? SYSTEM_URLS[system] : null;
  if (systemUrl) {
    return {
      label: `Portal ${system}`,
      url: systemUrl,
      instruction: "Abra o portal oficial do sistema identificado e pesquise pelo CNJ. O Lex não automatiza login, captcha ou certificado.",
      requiresManualSearch: true,
    };
  }

  return {
    label: "Fonte oficial do tribunal",
    url: null,
    instruction: tribunal
      ? `Não há link público estável mapeado para ${tribunal}. Use o DataJud e, se necessário, abra o portal oficial do tribunal manualmente.`
      : "Informe ou importe o tribunal para sugerir uma fonte oficial. O DataJud permanece como fallback público.",
    requiresManualSearch: true,
  };
}

export function buildDataJudOfficialLink() {
  return {
    label: "DataJud CNJ",
    url: "https://www.cnj.jus.br/sistemas/datajud/api-publica/",
    instruction: "Fonte oficial pública para metadados e movimentações. Não entrega autos completos ou intimação oficial.",
    requiresManualSearch: false,
  } satisfies CourtPublicQueryLink;
}
