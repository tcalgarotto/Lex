import { NextResponse } from "next/server";
import { JustosProRequiredError } from "@/lib/justos/require-pro";
import { CrmNotFoundError } from "./permissions";

export function handleCrmRouteError(err: unknown): NextResponse {
  if (err instanceof JustosProRequiredError) {
    return NextResponse.json({ error: err.message, code: "justos_pro_required" }, { status: 403 });
  }
  if (err instanceof CrmNotFoundError) {
    return NextResponse.json({ error: err.message }, { status: 404 });
  }
  if (err instanceof Error && err.message.includes("telefone")) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if (err instanceof Error && err.message.includes("opt-out")) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }

  console.error("[crm]", err);
  return NextResponse.json({ error: "Erro interno" }, { status: 500 });
}
