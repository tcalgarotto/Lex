export * from "./types";
export * from "./product-copy";
export * from "./workspace-config";
export { emitLexJustosEvent } from "./emit-event";
export { emitLexJustosEventForCase, fireLexJustosEventForCase } from "./emit-for-case";
export { isLexN8nServiceAuthorized, readLexN8nServiceToken } from "./n8n-auth";
export {
  readJustosN8nWebhookUrl,
  readJustosN8nWebhookSecret,
  readJustosN8nServiceToken,
  readJustosApiBaseUrl,
  isJustosLegacyBridgeEnabled,
} from "./env";
export {
  requireJustosPro,
  getJustosConfig,
  isJustosProEnabled,
  isJustosEnabled,
  JustosProRequiredError,
} from "./require-pro";
export { getJustosProEntitlement, syncJustosProFromAsaasEvent } from "./billing-entitlement";

/** CRM server-only — importar de `@/lib/justos/crm` em rotas API, não no barrel (evita bundle client). */
export {
  resolveCaseJustosContacts,
  isPhoneAuthorizedForCase,
  validateSecretaryPatch,
  isJustosAutomationAllowed,
} from "./contact-access";
export { extractN8nSecretaryFromCaseMetadata } from "./secretary-from-case";
export {
  formatJustosPriceBrl,
  JUSTOS_PRO_FEATURES,
  JUSTOS_PRO_PRICE_MONTHLY_BRL,
  JUSTOS_PRO_PRICE_YEARLY_BRL,
  justosProYearlySavingsBrl,
  justosProYearlySavingsPercent,
} from "./billing";
export type { JustosProBillingCycle } from "./billing";
