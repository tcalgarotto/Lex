import { MembershipRole } from "@prisma/client";
import { RT, RT_SECRET_MARKER_B } from "./fixture-ids";

export type AttackPersona = "commonA" | "adminA" | "commonB" | "none";

export type RedTeamFinding = {
  status: "PASSOU" | "FALHOU" | "NÃO EXECUTADO";
  title: string;
  severity?: "P0" | "P1" | "P2" | "P3";
  route?: string;
  file?: string;
  lineHint?: string;
  attacker?: string;
  target?: string;
  payload?: string;
  expected?: string;
  obtained?: string;
  impact?: string;
  fix?: string;
  skipReason?: string;
};

export class RedTeamReport {
  readonly findings: RedTeamFinding[] = [];

  pass(title: string, extra?: Partial<RedTeamFinding>) {
    this.findings.push({ status: "PASSOU", title, ...extra });
  }

  fail(title: string, extra: Partial<Omit<RedTeamFinding, "status" | "title">>) {
    this.findings.push({ status: "FALHOU", title, severity: extra.severity ?? "P0", ...extra });
  }

  skip(title: string, reason: string) {
    this.findings.push({ status: "NÃO EXECUTADO", title, skipReason: reason });
  }

  summary() {
    const p = this.findings.filter((f) => f.status === "PASSOU").length;
    const f = this.findings.filter((f) => f.status === "FALHOU").length;
    const s = this.findings.filter((f) => f.status === "NÃO EXECUTADO").length;
    return { passed: p, failed: f, skipped: s, total: this.findings.length };
  }

  print() {
    for (const row of this.findings) {
      const tag = row.status;
      console.log(`\n[${tag}] ${row.title}`);
      if (row.severity) console.log(`  severidade: ${row.severity}`);
      if (row.route) console.log(`  rota: ${row.route}`);
      if (row.file) console.log(`  arquivo: ${row.file}${row.lineHint ? ` (~${row.lineHint})` : ""}`);
      if (row.attacker) console.log(`  atacante: ${row.attacker}`);
      if (row.target) console.log(`  alvo: ${row.target}`);
      if (row.payload) console.log(`  payload: ${row.payload}`);
      if (row.expected) console.log(`  esperado: ${row.expected}`);
      if (row.obtained) console.log(`  obtido: ${row.obtained}`);
      if (row.impact) console.log(`  impacto: ${row.impact}`);
      if (row.fix) console.log(`  correção mínima: ${row.fix}`);
      if (row.skipReason) console.log(`  motivo: ${row.skipReason}`);
    }
    const s = this.summary();
    console.log(
      `\n=== RED TEAM FASE 2 — ${s.passed} PASSOU | ${s.failed} FALHOU | ${s.skipped} NÃO EXECUTADO ===\n`,
    );
  }
}

export const attackState: {
  workspaceId: string;
  userId: string;
  email: string;
  role: MembershipRole | null;
} = {
  workspaceId: RT.workspaces.a.id,
  userId: RT.users.commonA.id,
  email: RT.users.commonA.email,
  role: MembershipRole.LAWYER,
};

export function setPersona(persona: AttackPersona) {
  switch (persona) {
    case "commonA":
      attackState.workspaceId = RT.workspaces.a.id;
      attackState.userId = RT.users.commonA.id;
      attackState.email = RT.users.commonA.email;
      attackState.role = MembershipRole.LAWYER;
      break;
    case "adminA":
      attackState.workspaceId = RT.workspaces.a.id;
      attackState.userId = RT.users.adminA.id;
      attackState.email = RT.users.adminA.email;
      attackState.role = MembershipRole.OWNER;
      break;
    case "commonB":
      attackState.workspaceId = RT.workspaces.b.id;
      attackState.userId = RT.users.commonB.id;
      attackState.email = RT.users.commonB.email;
      attackState.role = MembershipRole.LAWYER;
      break;
    case "none":
      attackState.workspaceId = "";
      attackState.userId = "";
      attackState.email = "";
      attackState.role = null;
      break;
  }
}

export async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { _raw: text.slice(0, 500) };
  }
}

export function bodyContainsSecretB(body: unknown): boolean {
  const s = JSON.stringify(body);
  return (
    s.includes(RT_SECRET_MARKER_B) ||
    s.includes(RT.clients.b.name) ||
    s.includes(RT.cases.b.title) ||
    s.includes(RT.documents.b.id)
  );
}

export function assertBlockedStatus(status: number, opts?: { allow400?: boolean }): boolean {
  if (opts?.allow400 && status === 400) return true;
  return status === 401 || status === 403 || status === 404;
}
