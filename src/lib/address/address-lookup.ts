import { digitsOnly } from "@/lib/forms/legal-input-masks";

export type AddressLookupResult = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  uf: string;
  complement?: string;
};

export type AddressLookupError = {
  code: "INVALID_CEP" | "NOT_FOUND" | "UPSTREAM_ERROR";
  message: string;
};

const VIA_CEP_TIMEOUT_MS = 8_000;

async function lookupViaCep(cepDigits: string): Promise<AddressLookupResult | AddressLookupError> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VIA_CEP_TIMEOUT_MS);
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return { code: "UPSTREAM_ERROR", message: "Não foi possível consultar o CEP agora." };
    }
    const data = (await res.json()) as {
      erro?: boolean;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      complemento?: string;
    };
    if (data.erro) {
      return { code: "NOT_FOUND", message: "CEP não encontrado." };
    }
    return {
      cep: cepDigits,
      street: (data.logradouro ?? "").trim(),
      neighborhood: (data.bairro ?? "").trim(),
      city: (data.localidade ?? "").trim(),
      uf: (data.uf ?? "").trim().toUpperCase(),
      complement: (data.complemento ?? "").trim() || undefined,
    };
  } catch {
    return { code: "UPSTREAM_ERROR", message: "Serviço de CEP indisponível. Preencha manualmente." };
  } finally {
    clearTimeout(timer);
  }
}

async function lookupGoogleGeocode(
  query: string,
  apiKey: string,
): Promise<AddressLookupResult | AddressLookupError> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VIA_CEP_TIMEOUT_MS);
  try {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("region", "br");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", apiKey);

    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      return { code: "UPSTREAM_ERROR", message: "Busca de endereço indisponível." };
    }
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        address_components?: Array<{ long_name: string; short_name: string; types: string[] }>;
        formatted_address?: string;
      }>;
    };
    if (data.status !== "OK" || !data.results?.[0]) {
      return { code: "NOT_FOUND", message: "Endereço não encontrado." };
    }
    const comps = data.results[0].address_components ?? [];
    const pick = (type: string) => comps.find((c) => c.types.includes(type));
    const route = pick("route")?.long_name ?? "";
    const neighborhood =
      pick("sublocality")?.long_name ?? pick("sublocality_level_1")?.long_name ?? "";
    const city = pick("administrative_area_level_2")?.long_name ?? pick("locality")?.long_name ?? "";
    const uf = pick("administrative_area_level_1")?.short_name ?? "";
    const postal = pick("postal_code")?.long_name ?? "";
    const cep = digitsOnly(postal).slice(0, 8);

    return {
      cep,
      street: route,
      neighborhood,
      city,
      uf: uf.toUpperCase(),
    };
  } catch {
    return { code: "UPSTREAM_ERROR", message: "Busca de endereço indisponível." };
  } finally {
    clearTimeout(timer);
  }
}

export async function lookupAddressByCep(cep: string): Promise<AddressLookupResult | AddressLookupError> {
  const digits = digitsOnly(cep);
  if (digits.length !== 8) {
    return { code: "INVALID_CEP", message: "CEP deve ter 8 dígitos." };
  }
  return lookupViaCep(digits);
}

export async function lookupAddressByStreetQuery(
  query: string,
): Promise<AddressLookupResult | AddressLookupError> {
  const q = query.trim();
  if (q.length < 6) {
    return { code: "INVALID_CEP", message: "Informe um endereço mais completo para buscar." };
  }
  const apiKey = process.env["GOOGLE_MAPS_API_KEY"]?.trim();
  if (apiKey) {
    return lookupGoogleGeocode(q, apiKey);
  }
  return {
    code: "UPSTREAM_ERROR",
    message: "Busca por rua não configurada. Use o CEP ou preencha manualmente.",
  };
}
