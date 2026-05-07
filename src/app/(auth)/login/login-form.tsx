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
      toast.success("Bem-vindo ao Lex.");
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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[radial-gradient(ellipse_at_top,_rgba(139,92,246,0.15),transparent_50%),radial-gradient(ellipse_at_bottom,_rgba(59,130,246,0.12),transparent_45%)] px-4">
      <div className="pointer-events-none absolute inset-0 bg-[length:40px_40px] opacity-[0.03] [background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)]" />
      <Card className="relative z-10 w-full max-w-md border-white/10 bg-zinc-950/80 backdrop-blur-xl">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl tracking-tight">Entrar no Lex</CardTitle>
          <CardDescription>
            Copiloto jurídico com memória persistente e RAG multicamada.
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
