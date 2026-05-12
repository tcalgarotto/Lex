"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function AcceptInviteForm({ token }: { token: string }) {
 const router = useRouter();
 const [loading, setLoading] = useState(false);

 async function onAccept() {
 setLoading(true);
 try {
 const res = await fetch("/api/invitations/accept", {
 method: "POST",
 headers: { "content-type": "application/json" },
 body: JSON.stringify({ token }),
 });
 const data = (await res.json()) as { error?: string };
 if (!res.ok) {
 toast.error(data.error ?? "Falha ao aceitar convite.");
 return;
 }
 toast.success("Bem-vindo ao workspace!");
 router.replace("/dashboard");
 router.refresh();
 } catch (err) {
 toast.error(err instanceof Error ? err.message : "Erro de rede");
 } finally {
 setLoading(false);
 }
 }

 return (
 <Button className="w-full" onClick={() => void onAccept()} disabled={loading}>
 {loading ? "Aceitando…" : "Aceitar convite"}
 </Button>
 );
}
