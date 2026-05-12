"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export default function ForgotPasswordPage() {
 const [email, setEmail] = useState("");
 const [loading, setLoading] = useState(false);
 const [sent, setSent] = useState(false);

 async function onSubmit(e: React.FormEvent) {
 e.preventDefault();
 setLoading(true);
 try {
 const supabase = createSupabaseBrowserClient();
 const { error } = await supabase.auth.resetPasswordForEmail(email, {
 redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
 });
 if (error) {
 toast.error(error.message);
 return;
 }
 setSent(true);
 toast.success("Se o e-mail existir, enviamos instruções para redefinir a senha.");
 } catch (err) {
 const msg = err instanceof Error ? err.message : String(err);
 const isNetwork = /failed to fetch|networkerror|fetch failed/i.test(msg);
 toast.error(
 isNetwork
 ? "Falha de rede ao falar com o Supabase. Verifique sua conexão."
 : msg,
 );
 } finally {
 setLoading(false);
 }
 }

 return (
 <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.12),transparent_45%)] px-4">
 <div className="pointer-events-none absolute inset-0 bg-[length:40px_40px] opacity-[0.03] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)]" />
 <Card className="relative z-10 w-full max-w-md">
 <CardHeader className="space-y-1">
 <CardTitle className="text-2xl tracking-tight">Recuperar senha</CardTitle>
 <CardDescription>
 Enviaremos um link para redefinir sua senha por e-mail.
 </CardDescription>
 </CardHeader>
 <CardContent>
 {sent ? (
 <div className="space-y-4 text-sm text-[color:var(--text-secondary)]">
 <p>
 Se houver uma conta com <span className="font-medium">{email}</span>, você
 receberá um e-mail com um link para redefinir a senha em alguns minutos.
 </p>
 <p className="text-xs text-[color:var(--text-muted)]">
 Não recebeu? Cheque o spam ou{" "}
 <button
 type="button"
 className="text-primary hover:underline"
 onClick={() => setSent(false)}
 >
 tente outro e-mail
 </button>
 .
 </p>
 </div>
 ) : (
 <form className="space-y-4" onSubmit={onSubmit}>
 <div className="space-y-2">
 <Label htmlFor="email">E-mail</Label>
 <Input
 id="email"
 type="email"
 autoComplete="email"
 required
 value={email}
 onChange={(ev) => setEmail(ev.target.value)}
 />
 </div>
 <Button type="submit" className="w-full" disabled={loading}>
 {loading ? "Enviando…" : "Enviar link de recuperação"}
 </Button>
 </form>
 )}
 <p className="mt-6 text-center text-sm text-muted-foreground">
 <Link href="/login" className="text-primary hover:underline">
 Voltar para o login
 </Link>
 </p>
 </CardContent>
 </Card>
 </div>
 );
}
