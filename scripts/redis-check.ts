#!/usr/bin/env tsx
/**
 * Diagnóstico Redis seguro para terminal — não exibe nenhum segredo.
 *
 * Uso:
 *   npm run redis:check                          # usa .env via tsx --env-file
 *   REDIS_URL=rediss://... npx tsx scripts/redis-check.ts
 *   npx vercel env pull .env.production.local && \
 *     npx tsx --env-file=.env.production.local scripts/redis-check.ts
 *
 * Saída (exemplo):
 *   ▸ REDIS_URL: presente
 *     protocol:    rediss
 *     host:        fluent-crappie-117882.upstash.io
 *     port:        6379
 *     username:    default
 *     password:    *** (12 chars)
 *     tls:         true
 *
 *   ▸ Conectando + PING (timeout 4000ms)…
 *     ✓ ok=true latency=312ms pong=PONG
 *
 *   ✅ Redis acessível.
 *
 * Em caso de falha:
 *   ✗ ok=false latency=4002ms
 *     errorName:    Error
 *     errorCode:    ETIMEDOUT
 *     errorMessage: ping timeout 4000ms
 */

 

import { describeRedisUrl, pingRedis, isRedisRequired } from "../src/lib/redis";

function maskHost(host: string): string {
  if (!host) return "(vazio)";
  return host;
}

function passwordHint(present: boolean, raw: string | null): string {
  if (!present) return "AUSENTE";
  // Não imprimimos a senha; só o tamanho e os 2 primeiros chars como hint
  // operacional ("começa com gQAA…?"). Útil para confirmar que a env certa
  // chegou no terminal, sem expor o segredo.
  if (!raw) return "*** (n/a)";
  return `*** (${raw.length} chars)`;
}

function getRawPassword(): string | null {
  const url = (process.env["REDIS_URL"] ?? "").trim();
  if (!url) return null;
  try {
    return new URL(url).password || null;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  console.log("═══ redis:check ═══════════════════════════════════════════\n");

  const info = describeRedisUrl();

  if (!info.envPresent) {
    console.log("✗ REDIS_URL ausente neste contexto.\n");
    console.log("  Em dev: defina em .env. Em Vercel: Settings → Env Vars (Production).");
    console.log("  Após salvar na Vercel, faça Redeploy SEM cache para o novo deployment");
    console.log("  carregar a variável.");
    process.exitCode = 2;
    return;
  }

  console.log("▸ REDIS_URL: presente");
  console.log(`  protocol:    ${info.protocol}`);
  console.log(`  host:        ${maskHost(info.host)}`);
  console.log(`  port:        ${info.port}`);
  console.log(`  username:    ${info.username || "(vazio)"}`);
  console.log(`  password:    ${passwordHint(info.hasPassword, getRawPassword())}`);
  console.log(`  tls:         ${info.tls}`);
  console.log(`  REDIS_REQUIRED: ${isRedisRequired()}\n`);

  if (info.parseError) {
    console.log(`✗ URL inválida: ${info.parseError}\n`);
    process.exitCode = 1;
    return;
  }

  if (info.protocol === "https") {
    console.log("✗ REDIS_URL usa scheme `https://` — esse é o endpoint REST do Upstash.");
    console.log("  Esse formato NÃO funciona com ioredis (que fala TCP+RESP).");
    console.log("  Vá no Upstash → Database → Connect → escolha aba **TLS** (não REST)");
    console.log("  e copie a URL `rediss://default:<password>@<host>.upstash.io:6379`.\n");
    process.exitCode = 1;
    return;
  }

  if (info.protocol !== "rediss" && info.protocol !== "redis") {
    console.log(`✗ Protocol desconhecido: ${info.protocol}. Esperado: rediss:// ou redis://\n`);
    process.exitCode = 1;
    return;
  }

  if (!info.tls) {
    console.log("⚠️  Conexão SEM TLS (`redis://`). Em produção use sempre `rediss://`.\n");
  }

  console.log("▸ Conectando + PING (timeout 4000ms)…");
  const result = await pingRedis(4_000);

  if (result.ok) {
    console.log(`  ✓ ok=true latency=${result.latencyMs}ms pong=${result.pong}\n`);
    console.log("✅ Redis acessível.");
    return;
  }

  console.log(`  ✗ ok=false latency=${result.latencyMs}ms`);
  if (result.errorName) console.log(`    errorName:    ${result.errorName}`);
  if (result.errorCode) console.log(`    errorCode:    ${result.errorCode}`);
  if (result.errorMessage) console.log(`    errorMessage: ${result.errorMessage}`);
  console.log();

  // Hints específicos por código de erro
  if (result.errorCode === "ENOTFOUND") {
    console.log("  Hint: hostname não resolve. Confira que copiou o host correto da Upstash.");
  } else if (result.errorCode === "ECONNREFUSED") {
    console.log("  Hint: porta fechada ou host errado. Conferir porta = 6379.");
  } else if (result.errorCode === "ETIMEDOUT" || result.errorMessage?.includes("timeout")) {
    console.log("  Hint: timeout. Provedor TLS bloqueado por firewall/proxy, ou o database");
    console.log("        do Upstash está em outra região e a latência saturou o handshake.");
  } else if (
    result.errorMessage?.toLowerCase().includes("noauth") ||
    result.errorMessage?.toLowerCase().includes("wrongpass") ||
    result.errorMessage?.toLowerCase().includes("auth")
  ) {
    console.log("  Hint: senha rejeitada. Reset em Upstash → Database e atualize REDIS_URL.");
  } else if (result.errorMessage?.toLowerCase().includes("ssl") || result.errorMessage?.toLowerCase().includes("tls")) {
    console.log("  Hint: handshake TLS falhou. Use scheme `rediss://` (com 2 s) e confirme");
    console.log("        que o host bate com o servername do certificado Upstash.");
  }

  process.exitCode = 1;
}

main().catch((err) => {
  console.error("[redis:check] erro inesperado:", err);
  process.exitCode = 1;
});
