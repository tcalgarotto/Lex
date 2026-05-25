/**
 * Smoke test: JustOS Pro checkout no Asaas Sandbox.
 *
 * A chave Asaas começa com `$` — dotenv/--env-file expandem e zeram ASAAS_API_KEY.
 * Rode com a chave no ambiente, ex.:
 *   export ASAAS_API_KEY="$(grep '^ASAAS_API_SANDBOX=' ~/local-ai-control/config/sold-credentials.env | cut -d= -f2-)"
 *   npx tsx --env-file=.env scripts/test-asaas-justos-checkout.ts
 *
 * Opcional: TEST_WORKSPACE_ID=... para testar subscribeJustosProForWorkspace + DB.
 */
import {
  isAsaasBillingConfigured,
  isAsaasBillingImmediateMode,
  readAsaasApiKey,
  readAsaasApiBaseUrl,
  readAsaasWebhookToken,
  asaasRequest,
} from "../src/lib/billing/asaas/client";
import {
  readJustosAsaasBillingType,
  startJustosProCheckout,
} from "../src/lib/billing/asaas/justos-pro";
import { subscribeJustosProForWorkspace } from "../src/lib/justos/justos-pro-checkout";
import { getJustosProEntitlement } from "../src/lib/justos/billing-entitlement";
import { prisma } from "../src/lib/prisma";

async function main() {
  const envReport = {
    ASAAS_API_KEY: Boolean(readAsaasApiKey()),
    ASAAS_API_BASE_URL: readAsaasApiBaseUrl(),
    ASAAS_WEBHOOK_TOKEN: Boolean(readAsaasWebhookToken()),
    ASAAS_WEBHOOK_TOKEN_placeholder:
      readAsaasWebhookToken()?.startsWith("__") ?? false,
    ASAAS_BILLING_MODE: process.env["ASAAS_BILLING_MODE"] || "(vazio)",
    ASAAS_SANDBOX_DEFAULT_CPF: process.env["ASAAS_SANDBOX_DEFAULT_CPF"] || "(default)",
    ASAAS_BILLING_TYPE: readJustosAsaasBillingType(),
    configured: isAsaasBillingConfigured(),
    immediateMode: isAsaasBillingImmediateMode(),
  };
  console.log("ENV:", JSON.stringify(envReport, null, 2));

  if (!isAsaasBillingConfigured()) {
    console.error("FALHA: ASAAS_API_KEY ausente ou vazia.");
    process.exit(1);
  }

  if (isAsaasBillingImmediateMode()) {
    console.log("AVISO: ASAAS_BILLING_MODE=immediate — checkout real não será usado em produção.");
  }

  try {
    await asaasRequest<{ totalCount?: number }>({
      method: "GET",
      path: "/v3/customers?limit=1",
    });
    console.log("API: OK (GET /v3/customers)");
  } catch (e) {
    const err = e as { message?: string; status?: number; body?: unknown };
    console.error("API: FALHA", err.message, err.status, err.body);
    process.exit(1);
  }

  const cycle = (process.env["TEST_CYCLE"] === "yearly" ? "yearly" : "monthly") as
    | "monthly"
    | "yearly";
  console.log("billingType:", process.env["ASAAS_BILLING_TYPE"] || "CREDIT_CARD", "cycle:", cycle);

  const ephemeralWsId = `test_ws_${Date.now()}`;
  try {
    const checkout = await startJustosProCheckout({
      workspaceId: ephemeralWsId,
      workspaceName: "Smoke Test JustOS Pro CRM",
      ownerEmail: `smoke+${Date.now()}@lex.local`,
      ownerPhone: null,
      cycle,
    });
    console.log("CHECKOUT:", JSON.stringify(checkout, null, 2));
    if (checkout.mode === "asaas" && checkout.paymentUrl) {
      console.log("SUCESSO: assinatura criada com paymentUrl.");
    } else if (checkout.mode === "immediate") {
      console.log("AVISO: modo immediate — sem cobrança Asaas.");
    } else {
      console.log("PARCIAL: assinatura criada mas sem paymentUrl (aguardar webhook/listagem).");
    }
  } catch (e) {
    const err = e as { message?: string; status?: number; body?: unknown };
    console.error("CHECKOUT: FALHA", err.message, err.status, err.body);
    process.exit(1);
  }

  const dbWsId = process.env["TEST_WORKSPACE_ID"]?.trim();
  if (dbWsId) {
    try {
      const result = await subscribeJustosProForWorkspace({
        workspaceId: dbWsId,
        cycle,
      });
      const ent = getJustosProEntitlement(result.config);
      console.log("DB subscribe:", {
        message: result.message,
        pendingPayment: result.pendingPayment,
        paymentUrl: result.paymentUrl,
        proSubscriptionStatus: result.config.proSubscriptionStatus,
        asaasSubscriptionId: result.config.asaasSubscriptionId,
        entitlement: ent,
      });
    } finally {
      await prisma.$disconnect();
    }
  }
}

main();
