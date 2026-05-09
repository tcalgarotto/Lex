import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/session";
import RetrievalExplainClientPage from "./page.client";

export default async function RetrievalExplainPage() {
  try {
    await requirePermission("observabilityView");
  } catch {
    notFound();
  }
  return <RetrievalExplainClientPage />;
}
