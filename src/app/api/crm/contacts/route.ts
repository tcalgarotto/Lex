import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createCrmContact,
  getCrmApiContext,
  handleCrmRouteError,
  listCrmContacts,
} from "@/lib/justos/crm";
import { CreateCrmContactSchema, ListContactsQuerySchema } from "@/lib/justos/crm/validators";

export async function GET(req: Request) {
  try {
    const { workspaceId } = await getCrmApiContext();
    const url = new URL(req.url);
    const parsed = ListContactsQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: "Query inválida", detail: parsed.error.flatten() }, { status: 400 });
    }
    const result = await listCrmContacts({ workspaceId, filters: parsed.data });
    return NextResponse.json(result);
  } catch (e) {
    return handleCrmRouteError(e);
  }
}

export async function POST(req: Request) {
  try {
    const { workspaceId } = await getCrmApiContext();
    let body: z.infer<typeof CreateCrmContactSchema>;
    try {
      body = CreateCrmContactSchema.parse(await req.json());
    } catch (e) {
      return NextResponse.json(
        { error: "Payload inválido", detail: e instanceof z.ZodError ? e.flatten() : String(e) },
        { status: 400 },
      );
    }
    const contact = await createCrmContact({ workspaceId, data: body });
    return NextResponse.json({ contact }, { status: 201 });
  } catch (e) {
    return handleCrmRouteError(e);
  }
}
