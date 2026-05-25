import { asaasRequest } from "./client";
import type { AsaasPayment } from "./types";

export type AsaasPixQrCode = {
  encodedImage: string;
  payload: string;
  expirationDate: string;
};

export type AsaasCreditCardInput = {
  holderName: string;
  number: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
};

export type AsaasCreditCardHolderInfo = {
  name: string;
  email: string;
  cpfCnpj: string;
  postalCode: string;
  addressNumber: string;
  addressComplement?: string | null;
  phone?: string | null;
  mobilePhone?: string | null;
};

/** QR Code dinâmico Pix — exibir na plataforma (sem invoiceUrl). */
export async function getPaymentPixQrCode(paymentId: string): Promise<AsaasPixQrCode> {
  return asaasRequest<AsaasPixQrCode>({
    method: "GET",
    path: `/v3/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
    retries: 1,
  });
}

/** Paga cobrança pendente com cartão na hora (sem redirecionar ao Asaas). */
export async function payPaymentWithCreditCard(args: {
  paymentId: string;
  creditCard: AsaasCreditCardInput;
  creditCardHolderInfo: AsaasCreditCardHolderInfo;
  creditCardToken?: string;
  remoteIp: string;
}): Promise<AsaasPayment> {
  const body: Record<string, unknown> = {
    remoteIp: args.remoteIp,
  };
  if (args.creditCardToken) {
    body["creditCardToken"] = args.creditCardToken;
  } else {
    body["creditCard"] = args.creditCard;
    body["creditCardHolderInfo"] = args.creditCardHolderInfo;
  }

  return asaasRequest<AsaasPayment>({
    method: "POST",
    path: `/v3/payments/${encodeURIComponent(args.paymentId)}/payWithCreditCard`,
    body,
    retries: 0,
  });
}

export async function getAsaasPayment(paymentId: string): Promise<AsaasPayment | null> {
  try {
    return await asaasRequest<AsaasPayment>({
      method: "GET",
      path: `/v3/payments/${encodeURIComponent(paymentId)}`,
    });
  } catch {
    return null;
  }
}
