"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { OAuthButtons } from "@/components/auth/oauth-buttons";

export function LoginForm() {
 const router = useRouter();
 const params = useSearchParams();
 const next = params.get("next") ?? "/dashboard";
 const [email, setEmail] = useState("");
 const [password, setPassword] = useState("");
 const [loading, setLoading] = useState(false);

 async function onSubmit(e: React.FormEvent) {
 e.preventDefault();
 setLoading(true);
 try {
 const supabase = createSupabaseBrowserClient();
 const { error } = await supabase.auth.signInWithPassword({ email, password });
 if (error) {
 toast.error(error.message);
 return;
 }
 await fetch("/api/auth/sync", { method: "POST" });
 toast.success("Bem-vindo ao JustOS.");
 router.replace(next);
 router.refresh();
 } catch (err) {
 const msg = err instanceof Error ? err.message : String(err);
 const isNetwork = /failed to fetch|networkerror|fetch failed/i.test(msg);
 toast.error(
 isNetwork
 ? "Falha de rede ao falar com o Supabase. Verifique sua conexão e a URL do projeto em .env."
 : msg,
 );
 } finally {
 setLoading(false);
 }
 }

 return (
 <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[color:var(--surface-base)] px-4">
 <Card className="relative z-10 w-full max-w-md">
 <CardHeader className="space-y-1">
 <CardTitle className="text-2xl tracking-tight">Entrar no JustOS</CardTitle>
 <CardDescription>
 Sistema operacional do escritório: casos, documentos, pesquisa com fontes e minutas no mesmo fluxo.
 </CardDescription>
 </CardHeader>
 <CardContent>
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
 <div className="space-y-2">
 <Label htmlFor="password">Senha</Label>
 <Input
 id="password"
 type="password"
 autoComplete="current-password"
 required
 value={password}
 onChange={(ev) => setPassword(ev.target.value)}
 />
 </div>
 <Button type="submit" className="w-full" disabled={loading}>
 {loading ? "Entrando…" : "Continuar"}
 </Button>
 </form>
 <OAuthButtons next={next} />
 <div className="mt-6 flex flex-col items-center gap-2 text-sm text-muted-foreground">
 <Link href="/forgot-password" className="text-primary hover:underline">
 Esqueceu a senha?
 </Link>
 <p>
 Novo por aqui?{" "}
 <Link href="/register" className="text-primary hover:underline">
 Criar conta
 </Link>
 </p>
 </div>
 </CardContent>
 </Card>
 </div>
 );
}
