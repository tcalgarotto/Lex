/** Tipos mínimos da API Asaas v3 (Sandbox/Produção). */

export type AsaasBillingType = "UNDEFINED" | "BOLETO" | "CREDIT_CARD" | "PIX";

export type AsaasSubscriptionCycle =
  | "MONTHLY"
  | "YEARLY";

export type AsaasSubscriptionStatus = "ACTIVE" | "EXPIRED" | "INACTIVE";

export type AsaasPaymentStatus =
  | "PENDING"
  | "RECEIVED"
  | "CONFIRMED"
  | "OVERDUE"
  | "REFUNDED"
  | "RECEIVED_IN_CASH";

export type AsaasCustomer = {
  id: string;
  name: string;
  email?: string;
  cpfCnpj?: string;
};

export type AsaasSubscription = {
  id: string;
  customer: string;
  status: AsaasSubscriptionStatus;
  cycle: AsaasSubscriptionCycle;
  value: number;
  nextDueDate: string;
  externalReference?: string | null;
};

export type AsaasPayment = {
  id: string;
  customer: string;
  subscription?: string | null;
  status: AsaasPaymentStatus;
  value: number;
  dueDate: string;
  invoiceUrl?: string | null;
  bankSlipUrl?: string | null;
  invoiceNumber?: string | null;
  externalReference?: string | null;
};

export type AsaasWebhookEvent = {
  event: string;
  payment?: AsaasPayment;
  subscription?: AsaasSubscription;
};

export type AsaasErrorResponse = {
  errors?: Array<{ code: string; description: string }>;
};
