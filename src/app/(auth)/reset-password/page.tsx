"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/**
 * Quando o usuário clica no link recebido por e-mail, o Supabase redireciona para
 * `/auth/callback?code=...&next=/reset-password`. O callback troca o code por sessão
 * de recovery e nos manda pra cá. Aqui o usuário define a nova senha via
 * `supabase.auth.updateUser({ password })`.
 */
export default function ResetPasswordPage() {
 const router = useRouter();
 const [password, setPassword] = useState("");
 const [confirm, setConfirm] = useState("");
 const [loading, setLoading] = useState(false);
 const [hasSession, setHasSession] = useState<boolean | null>(null);

 useEffect(() => {
 const supabase = createSupabaseBrowserClient();
 void supabase.auth.getSession().then(({ data }) => {
 setHasSession(Boolean(data.session));
 });
 }, []);

 async function onSubmit(e: React.FormEvent) {
 e.preventDefault();
 if (password !== confirm) {
 toast.error("As senhas não conferem.");
 return;
 }
 if (password.length < 8) {
 toast.error("Senha precisa ter ao menos 8 caracteres.");
 return;
 }
 setLoading(true);
 try {
 const supabase = createSupabaseBrowserClient();
 const { error } = await supabase.auth.updateUser({ password });
 if (error) {
 toast.error(error.message);
 return;
 }
 toast.success("Senha atualizada. Você já está autenticado.");
 router.replace("/dashboard");
 router.refresh();
 } catch (err) {
 const msg = err instanceof Error ? err.message : String(err);
 toast.error(msg);
 } finally {
 setLoading(false);
 }
 }

 return (
 <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.12),transparent_45%)] px-4">
 <div className="pointer-events-none absolute inset-0 bg-[length:40px_40px] opacity-[0.03] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)]" />
 <Card className="relative z-10 w-full max-w-md">
 <CardHeader className="space-y-1">
 <CardTitle className="text-2xl tracking-tight">Redefinir senha</CardTitle>
 <CardDescription>
 {hasSession === false
 ? "O link expirou ou é inválido. Solicite um novo."
 : "Defina uma nova senha forte (mínimo 8 caracteres)."}
 </CardDescription>
 </CardHeader>
 <CardContent>
 {hasSession === false ? (
 <Button asChild className="w-full">
 <a href="/forgot-password">Solicitar novo link</a>
 </Button>
 ) : (
 <form className="space-y-4" onSubmit={onSubmit}>
 <div className="space-y-2">
 <Label htmlFor="password">Nova senha</Label>
 <Input
 id="password"
 type="password"
 autoComplete="new-password"
 required
 minLength={8}
 value={password}
 onChange={(ev) => setPassword(ev.target.value)}
 />
 </div>
 <div className="space-y-2">
 <Label htmlFor="confirm">Confirme a senha</Label>
 <Input
 id="confirm"
 type="password"
 autoComplete="new-password"
 required
 minLength={8}
 value={confirm}
 onChange={(ev) => setConfirm(ev.target.value)}
 />
 </div>
 <Button type="submit" className="w-full" disabled={loading || hasSession === null}>
 {loading ? "Salvando…" : "Atualizar senha"}
 </Button>
 </form>
 )}
 </CardContent>
 </Card>
 </div>
 );
}
