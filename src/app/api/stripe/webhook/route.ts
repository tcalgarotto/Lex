/**
 * Stripe deprecated for JustOS Pro — use POST /api/asaas/webhook
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Stripe deprecated for JustOS Pro",
      provider: "asaas",
      webhook: "/api/asaas/webhook",
    },
    { status: 410 },
  );
}
