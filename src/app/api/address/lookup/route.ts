import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/auth/session";
import {
  lookupAddressByCep,
  lookupAddressByStreetQuery,
} from "@/lib/address/address-lookup";

export async function GET(req: Request) {
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cep = searchParams.get("cep") ?? "";
  const street = searchParams.get("street") ?? "";

  if (cep.trim()) {
    const result = await lookupAddressByCep(cep);
    if ("code" in result) {
      const status = result.code === "INVALID_CEP" ? 400 : result.code === "NOT_FOUND" ? 404 : 503;
      return NextResponse.json({ error: result.message, code: result.code }, { status });
    }
    return NextResponse.json({ address: result });
  }

  if (street.trim()) {
    const result = await lookupAddressByStreetQuery(street);
    if ("code" in result) {
      const status = result.code === "INVALID_CEP" ? 400 : result.code === "NOT_FOUND" ? 404 : 503;
      return NextResponse.json({ error: result.message, code: result.code }, { status });
    }
    return NextResponse.json({ address: result });
  }

  return NextResponse.json({ error: "Informe cep ou street." }, { status: 400 });
}
