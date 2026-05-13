import { createHash } from "node:crypto";
import type { DataJudHit } from "@/lib/datajud/datajud-client";
import type { ParsedCnj } from "@/lib/datajud/resolve-datajud-alias";

export type NormalizedDataJudCover = {
  externalId: string | null;
  cnj: string;
  cnjFormatted: string;
  tribunalAcronym: string;
  tribunalAlias: string;
  branch: string;
  grau: string | null;
  classeCodigo: string | null;
  classeNome: string | null;
  assuntosJson: unknown;
  dataAjuizamento: Date | null;
  orgaoJulgadorCodigo: string | null;
  orgaoJulgadorNome: string | null;
  sistemaCodigo: string | null;
  sistemaNome: string | null;
  formatoCodigo: string | null;
  formatoNome: string | null;
  nivelSigilo: number | null;
  dataHoraUltimaAtualizacao: Date | null;
  rawJson: Record<string, unknown>;
};

export type NormalizedDataJudMovement = {
  codigo: string | null;
  nome: string;
  dataHora: Date | null;
  category: string;
  complementosJson: unknown;
  orgaoJulgadorJson: unknown;
  movementHash: string;
  rawJson: Record<string, unknown>;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function asDate(value: unknown): Date | null {
  const text = asString(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const text = asString(value);
  if (!text) return null;
  const num = Number(text);
  return Number.isFinite(num) ? num : null;
}

function classifyMovementName(name: string): string {
  const lower = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/sentenca|decisao|acordao|despacho/.test(lower)) return "decisao";
  if (/audiencia|sessao|julgamento/.test(lower)) return "agenda";
  if (/distribu|redistribu/.test(lower)) return "distribuicao";
  if (/juntada|peticao|manifestacao|contestacao|recurso|embargos/.test(lower)) return "peticao";
  if (/citacao|intimacao|notificacao|publicacao/.test(lower)) return "comunicacao";
  if (/baixa|arquiv|transito em julgado/.test(lower)) return "encerramento";
  return "outros";
}

export function buildMovementHash(args: {
  cnj: string;
  codigo: string | null;
  nome: string;
  dataHora: Date | null;
  rawJson?: unknown;
}): string {
  const stable = JSON.stringify({
    cnj: args.cnj,
    codigo: args.codigo,
    nome: args.nome,
    dataHora: args.dataHora?.toISOString() ?? null,
    rawJson: args.rawJson ?? null,
  });
  return createHash("sha256").update(stable).digest("hex");
}

export function normalizeDataJudCover(args: {
  hit: DataJudHit;
  parsedCnj: ParsedCnj;
  alias: string;
  tribunalAcronym: string;
}): NormalizedDataJudCover {
  const src = asRecord(args.hit._source);
  const classe = asRecord(src["classe"]);
  const orgao = asRecord(src["orgaoJulgador"]);
  const sistema = asRecord(src["sistema"]);
  const formato = asRecord(src["formato"]);

  return {
    externalId: args.hit._id ?? null,
    cnj: args.parsedCnj.digits,
    cnjFormatted: args.parsedCnj.formatted,
    tribunalAcronym: args.tribunalAcronym,
    tribunalAlias: args.alias,
    branch: args.parsedCnj.branch,
    grau: asString(src["grau"]),
    classeCodigo: asString(classe["codigo"]),
    classeNome: asString(classe["nome"]),
    assuntosJson: src["assuntos"] ?? null,
    dataAjuizamento: asDate(src["dataAjuizamento"]),
    orgaoJulgadorCodigo: asString(orgao["codigo"]),
    orgaoJulgadorNome: asString(orgao["nome"]),
    sistemaCodigo: asString(sistema["codigo"]),
    sistemaNome: asString(sistema["nome"]),
    formatoCodigo: asString(formato["codigo"]),
    formatoNome: asString(formato["nome"]),
    nivelSigilo: asNumber(src["nivelSigilo"]),
    dataHoraUltimaAtualizacao: asDate(src["dataHoraUltimaAtualizacao"] ?? src["@timestamp"]),
    rawJson: src,
  };
}

export function normalizeDataJudMovements(args: {
  hit: DataJudHit;
  cnj: string;
}): NormalizedDataJudMovement[] {
  const src = asRecord(args.hit._source);
  const movimentos = Array.isArray(src["movimentos"]) ? src["movimentos"] : [];
  return movimentos
    .map((item) => asRecord(item))
    .map((raw) => {
      const nome = asString(raw["nome"] ?? raw["descricao"]) ?? "Movimentação sem nome";
      const codigo = asString(raw["codigo"]);
      const dataHora = asDate(raw["dataHora"]);
      return {
        codigo,
        nome,
        dataHora,
        category: classifyMovementName(nome),
        complementosJson: raw["complementosTabelados"] ?? raw["complementos"] ?? null,
        orgaoJulgadorJson: raw["orgaoJulgador"] ?? null,
        movementHash: buildMovementHash({ cnj: args.cnj, codigo, nome, dataHora, rawJson: raw }),
        rawJson: raw,
      };
    });
}
