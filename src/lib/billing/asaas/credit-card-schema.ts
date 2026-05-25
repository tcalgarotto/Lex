import { z } from "zod";

export const JustosCreditCardPayBody = z.object({
  holderName: z.string().min(2).max(80),
  number: z.string().min(13).max(19),
  expiryMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/),
  expiryYear: z.string().regex(/^\d{4}$/),
  ccv: z.string().regex(/^\d{3,4}$/),
  holderEmail: z.string().email(),
  holderCpfCnpj: z.string().min(11).max(14),
  postalCode: z.string().min(8).max(9),
  addressNumber: z.string().min(1).max(20),
  addressComplement: z.string().max(80).optional(),
  /** Celular com DDD — exigido pelo Asaas no titular do cartão */
  phone: z
    .string()
    .min(10, "Informe o celular com DDD (ex.: 47999998888).")
    .max(20)
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 10 && d.length <= 11;
    }, "Informe o número de contato com DDD do titular do cartão."),
});

export type JustosCreditCardPayInput = z.infer<typeof JustosCreditCardPayBody>;

export function readClientRemoteIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip")?.trim();
  if (real) return real;
  return "127.0.0.1";
}
