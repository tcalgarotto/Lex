export type ProcessMovementCategory =
  | "decisao"
  | "agenda"
  | "distribuicao"
  | "peticao"
  | "comunicacao"
  | "encerramento"
  | "outros";

export function classifyProcessMovement(text: string): ProcessMovementCategory {
  const lower = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (/sentenca|decisao|acordao|despacho/.test(lower)) return "decisao";
  if (/audiencia|sessao|julgamento|pauta/.test(lower)) return "agenda";
  if (/distribu|redistribu/.test(lower)) return "distribuicao";
  if (/juntada|peticao|manifestacao|contestacao|recurso|embargos/.test(lower)) return "peticao";
  if (/citacao|intimacao|notificacao|publicacao/.test(lower)) return "comunicacao";
  if (/baixa|arquiv|transito em julgado/.test(lower)) return "encerramento";
  return "outros";
}
