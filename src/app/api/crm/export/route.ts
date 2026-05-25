import { NextResponse } from "next/server";
import { getWorkspaceContextWithRole } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { exportCrmWorkspaceData } from "@/lib/justos/crm/export-service";

export async function GET(req: Request) {
  const { workspaceId, role } = await getWorkspaceContextWithRole();
  if (!can(role, "billingManage")) {
    return NextResponse.json({ error: "Apenas o titular pode exportar dados CRM." }, { status: 403 });
  }

  const format = new URL(req.url).searchParams.get("format") ?? "json";
  const data = await exportCrmWorkspaceData(workspaceId);

  if (format === "csv") {
    const lines = ["type,id,extra"];
    for (const c of data.contacts) {
      lines.push(`contact,${c.id},${c.displayName}`);
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="justos-crm-${workspaceId}.csv"`,
      },
    });
  }

  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="justos-crm-${workspaceId}.json"`,
    },
  });
}
