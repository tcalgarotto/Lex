export type PageLayoutContentMode = "standard" | "bleed";

/** Variante de corpo alinhada ao `LexPageFrame` / grelha (convenção de produto). */
export type LexFrameVariant = "standard" | "center-grid" | "right-rail" | "three-well";

export type LexCenterWidthToken = "default" | "wide" | "full";

export type RailExpectation = "none" | "optional" | "required";

export type RouteLayoutSpec = {
  bleed: boolean;
  contentMode: PageLayoutContentMode;
  frame: LexFrameVariant;
  centerWidth: LexCenterWidthToken;
  usesLexPageFrame: boolean;
  usesLexCenterGrid: boolean;
  leftRail: RailExpectation;
  rightRail: RailExpectation;
  /** Notas para auditores / futuras migrações. */
  notes?: string;
};

export type PageLayoutConfig = {
  bleed: boolean;
  contentMode: PageLayoutContentMode;
};

function normalizePath(pathname: string): string {
  return (pathname.split("?")[0] ?? pathname).replace(/\/$/, "") || "/";
}

const DEFAULT_SPEC: RouteLayoutSpec = {
  bleed: false,
  contentMode: "standard",
  frame: "standard",
  centerWidth: "default",
  usesLexPageFrame: true,
  usesLexCenterGrid: false,
  leftRail: "none",
  rightRail: "none",
  notes: "Padrão: envolver conteúdo em LexPageFrame (segment layout ou página).",
};

/**
 * Decisão explícita de layout por rota (desktop-first).
 * Usado por documentação, testes e futuros geradores; o `AppChrome` consome só `bleed` via `getPageLayoutConfig`.
 */
export function matchRouteLayout(pathname: string): RouteLayoutSpec {
  const path = normalizePath(pathname);

  if (path === "/agenda" || path.startsWith("/agenda/")) {
    return {
      bleed: true,
      contentMode: "bleed",
      frame: "three-well",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "required",
      rightRail: "required",
      notes: "Corpo em LexAgendaShell + LexPageFrame; bleed no AppChrome.",
    };
  }

  if (path === "/dashboard") {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "full",
      usesLexPageFrame: false,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Cockpit JustOS full-width — justos-dashboard.css",
    };
  }

  if (path === "/cases/new" || path.startsWith("/cases/new/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Formulário denso; fora do layout [id].",
    };
  }

  if (path === "/cases" || path.startsWith("/cases/")) {
    const isCaseDetail = /^\/cases\/(?!new(?:\/|$))[^/]+/.test(path);
    if (isCaseDetail) {
      return {
        bleed: false,
        contentMode: "standard",
        frame: "right-rail",
        centerWidth: "default",
        usesLexPageFrame: true,
        usesLexCenterGrid: false,
        leftRail: "none",
        rightRail: "required",
        notes: "LexPageFrame em cases/[id]/layout; copiloto no rightRail.",
      };
    }
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Lista de casos densa.",
    };
  }

  if (path === "/processos" || path === "/processos/analytics" || path.startsWith("/processos/analytics/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Lista / analytics; layout segment processos.",
    };
  }

  if (path.startsWith("/processos/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "optional",
      notes: "Detalhe: contexto em abas; sem rail dedicado hoje.",
    };
  }

  if (path === "/documentos" || path.startsWith("/documentos/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Lista de documentos; layout segment documentos.",
    };
  }

  if (path.startsWith("/biblioteca")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Acervo / livros / leis; layout segment biblioteca.",
    };
  }

  if (path.startsWith("/settings")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "default",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Formulários e equipas; layout segment settings.",
    };
  }

  if (path === "/publicacoes" || path.startsWith("/publicacoes/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "default",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
    };
  }

  if (path === "/pesquisa-juridica" || path.startsWith("/pesquisa-juridica/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Workbench com painel interno próprio.",
    };
  }

  if (path === "/busca" || path.startsWith("/busca/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
    };
  }

  if (path.startsWith("/editor")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "wide",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Lista de peças e editor; layout segment editor.",
    };
  }

  if (path === "/cockpit" || path.startsWith("/cockpit/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "default",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Observabilidade; cockpit/layout.",
    };
  }

  if (path === "/strategy" || path.startsWith("/strategy/")) {
    return {
      bleed: false,
      contentMode: "standard",
      frame: "standard",
      centerWidth: "default",
      usesLexPageFrame: true,
      usesLexCenterGrid: false,
      leftRail: "none",
      rightRail: "none",
      notes: "Observabilidade; strategy/layout.",
    };
  }

  return { ...DEFAULT_SPEC };
}

/**
 * Configuração mínima consumida pelo `AppChrome` (bleed do poço).
 */
export function getPageLayoutConfig(pathname: string): PageLayoutConfig {
  const { bleed, contentMode } = matchRouteLayout(pathname);
  return { bleed, contentMode };
}
