/**
 * inngest-check — diagnóstico do endpoint /api/inngest na Vercel.
 *
 * Usado para entender por que Inngest Cloud mostra "No syncs found".
 *
 * Lê a URL do app de:
 *   1. INNGEST_SERVE_ORIGIN (preferida — pode apontar para preview/prod)
 *   2. NEXT_PUBLIC_APP_URL (fallback — origem canônica)
 *
 * Faz GET /api/inngest e classifica a resposta:
 *
 *   200 + JSON Inngest    → endpoint OK, Inngest Cloud consegue sincar.
 *   401 com HTML          → Vercel Deployment Protection ligada na rota.
 *                           Solução: desligar Vercel Authentication para
 *                           Production OU configurar Protection Bypass
 *                           for Automation + header
 *                           x-vercel-protection-bypass na console Inngest.
 *   401/403 com JSON      → assinatura/key incorretas. Confira
 *                           INNGEST_SIGNING_KEY entre Vercel e Inngest.
 *   404                   → endpoint não foi deployado (build pulou rota
 *                           ou caminho está errado).
 *   5xx                   → bug do app — abrir Vercel Function logs.
 *
 * Saída exit code != 0 quando algo claramente impede o sync.
 */

import { setTimeout as delay } from "node:timers/promises";

type Verdict = "ok" | "vercel-auth" | "inngest-auth" | "not-found" | "server-error" | "unknown";

const COLORS = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

function paint(color: keyof typeof COLORS, text: string): string {
  if (!process.stdout.isTTY) return text;
  return `${COLORS[color]}${text}${COLORS.reset}`;
}

function resolveOrigin(): string {
  const candidates = [
    process.env["INNGEST_SERVE_ORIGIN"],
    process.env["NEXT_PUBLIC_APP_URL"],
  ];
  for (const c of candidates) {
    const v = (c ?? "").trim();
    if (v) return v.replace(/\/+$/, "");
  }
  console.error(
    paint(
      "red",
      "Configure INNGEST_SERVE_ORIGIN ou NEXT_PUBLIC_APP_URL antes de rodar (ex.: https://lex-navy.vercel.app).",
    ),
  );
  process.exit(2);
}

async function probe(url: string): Promise<{
  verdict: Verdict;
  status: number;
  contentType: string;
  inngestHandled: boolean;
  vercelAuthIntercept: boolean;
  bodyPreview: string;
  latencyMs: number;
}> {
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      redirect: "manual",
      headers: { accept: "application/json,text/html;q=0.9" },
    });
  } catch (err) {
    return {
      verdict: "unknown",
      status: 0,
      contentType: "",
      inngestHandled: false,
      vercelAuthIntercept: false,
      bodyPreview: `network error: ${(err as Error).message}`,
      latencyMs: Date.now() - t0,
    };
  }
  const contentType = res.headers.get("content-type") ?? "";
  // Sinal autoritativo: o SDK Inngest sempre seta esse header quando atende
  // a request, não importa se respondeu 200 ou 401.
  const inngestHandled = res.headers.get("x-inngest-sdk-handled") === "true";
  // Vercel Authentication (Deployment Protection) emite esse header em
  // respostas próprias do gateway, independente do conteúdo.
  const vercelAuthIntercept =
    !!res.headers.get("x-vercel-protection") ||
    !!res.headers.get("x-vercel-protection-status");
  const text = await res.text().catch(() => "");
  const bodyPreview = text.slice(0, 240).replace(/\s+/g, " ");
  const latencyMs = Date.now() - t0;

  const isHtml = /text\/html/.test(contentType) || /<!doctype html|<html/i.test(text);
  const looksLikeVercelLogin = /Authentication Required|Vercel Authentication|sso\.vercel\.app/i.test(text);

  let verdict: Verdict = "unknown";
  if (res.status === 200) {
    verdict = "ok";
  } else if (res.status === 404) {
    verdict = "not-found";
  } else if (res.status >= 500) {
    verdict = "server-error";
  } else if (res.status === 401 || res.status === 403) {
    if (inngestHandled) {
      // Request alcançou o SDK Inngest, ele decidiu rejeitar — signing key.
      verdict = "inngest-auth";
    } else if (vercelAuthIntercept || looksLikeVercelLogin || isHtml) {
      verdict = "vercel-auth";
    } else {
      // Sem header Inngest e sem header Vercel Auth: provavelmente Vercel
      // Auth respondendo JSON enxuto (`{"message":"Unauthorized"}`).
      verdict = "vercel-auth";
    }
  }
  return {
    verdict,
    status: res.status,
    contentType,
    inngestHandled,
    vercelAuthIntercept,
    bodyPreview,
    latencyMs,
  };
}

function explain(verdict: Verdict): string {
  switch (verdict) {
    case "ok":
      return "Endpoint disponível. Inngest Cloud deve conseguir sincronizar.";
    case "vercel-auth":
      return [
        "Vercel Authentication / Deployment Protection está bloqueando a rota.",
        "  → Project Settings → Deployment Protection → desligar Vercel Authentication",
        "    para Production. (Preview pode continuar protegido.)",
        "  → OU criar 'Protection Bypass for Automation' (token) + configurar header",
        "    x-vercel-protection-bypass na console Inngest",
        "    (Apps → Settings → Custom Headers).",
      ].join("\n");
    case "inngest-auth":
      return [
        "O SDK Inngest atendeu a request (header x-inngest-sdk-handled: true)",
        "e respondeu 401 — signing key da Vercel não bate com a do app Inngest.",
        "",
        "Caminho oficial:",
        "  1. Inngest Console → Settings → Signing Key → 'Reveal' → copie.",
        "  2. Vercel → Project → Settings → Environment Variables:",
        "       atualize INNGEST_SIGNING_KEY (Production + Preview).",
        "  3. Confirme INNGEST_APP_ID == app id na console Inngest",
        "       (lex-production em prod, lex-preview em preview).",
        "  4. Re-deploy (envs novas só sobem em novo build).",
        "  5. Inngest Console → Apps → seu app → 'Sync' novamente.",
      ].join("\n");
    case "not-found":
      return "Rota não foi deployada. Confira que src/app/api/inngest/route.ts está no build.";
    case "server-error":
      return "App quebrou ao servir /api/inngest. Abra Vercel Function logs.";
    default:
      return "Resposta inesperada. Inspecione manualmente.";
  }
}

async function main() {
  const origin = resolveOrigin();
  const url = `${origin}/api/inngest`;
  const appId = (process.env["INNGEST_APP_ID"] ?? "").trim() || "lex-production";

  console.log(paint("bold", `→ Probing ${url}`));
  console.log(`  INNGEST_APP_ID = ${appId}`);
  console.log(
    `  INNGEST_SIGNING_KEY = ${process.env["INNGEST_SIGNING_KEY"] ? "(set)" : paint("yellow", "(missing)")}`,
  );
  console.log(
    `  INNGEST_EVENT_KEY   = ${process.env["INNGEST_EVENT_KEY"] ? "(set)" : paint("yellow", "(missing)")}`,
  );
  console.log("");

  const r = await probe(url);

  const status = r.status === 0 ? "ERR" : String(r.status);
  const verdictColor: keyof typeof COLORS =
    r.verdict === "ok" ? "green" : r.verdict === "vercel-auth" ? "yellow" : "red";
  console.log(`  HTTP ${status} (${r.latencyMs}ms)  content-type: ${r.contentType || "-"}`);
  console.log(`  x-inngest-sdk-handled: ${r.inngestHandled ? paint("green", "true") : "false"}`);
  if (r.vercelAuthIntercept) {
    console.log(`  vercel-auth headers: ${paint("yellow", "present")}`);
  }
  console.log(`  body: ${r.bodyPreview || "(empty)"}`);
  console.log("");
  console.log(paint(verdictColor, `  Verdict: ${r.verdict.toUpperCase()}`));
  console.log("");
  console.log(explain(r.verdict));

  // Pequena pausa pra finalizar I/O antes de sair (CI captures all).
  await delay(50);

  if (r.verdict === "ok") process.exit(0);
  if (r.verdict === "vercel-auth" || r.verdict === "inngest-auth") process.exit(1);
  if (r.verdict === "not-found" || r.verdict === "server-error") process.exit(1);
  process.exit(2);
}

main().catch((err) => {
  console.error(paint("red", `inngest-check falhou: ${(err as Error).message}`));
  process.exit(2);
});
