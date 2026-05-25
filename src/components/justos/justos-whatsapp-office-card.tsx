"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type WaStatus = {
  workspaceId: string;
  session: {
    sessionKey: string;
    sessionKeyMasked?: string;
    status: string;
    phoneE164: string | null;
  };
  qrAvailable: boolean;
  commandReachable: boolean;
  openclawMode: string;
  openclawPort?: number | null;
  error?: string | null;
};

type QrPayload = {
  qrAvailable: boolean;
  dataUrl?: string | null;
  qrText?: string | null;
  status: string;
  error?: string | null;
};

export function JustosWhatsappOfficeCard({ proActive }: { proActive: boolean }) {
  const [data, setData] = useState<WaStatus | null>(null);
  const [qr, setQr] = useState<QrPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollBusyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!proActive) return;
    const res = await fetch("/api/justos/whatsapp/status");
    if (res.ok) setData((await res.json()) as WaStatus);
  }, [proActive]);

  const fetchQr = useCallback(async (): Promise<QrPayload | null> => {
    const res = await fetch("/api/justos/whatsapp/qr");
    if (!res.ok) return null;
    const payload = (await res.json()) as QrPayload;
    setQr(payload);
    return payload;
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollOnce = useCallback(async () => {
    if (pollBusyRef.current) return;
    pollBusyRef.current = true;
    try {
      const res = await fetch("/api/justos/whatsapp/status");
      if (!res.ok) return;
      const st = (await res.json()) as WaStatus;
      setData(st);
      if (st.session.status === "pairing" || st.session.status === "starting") {
        const q = await fetchQr();
        if (q?.qrAvailable && q.dataUrl) stopPolling();
        if (q?.error) setError(q.error);
      }
      if (st.session.status === "connected") {
        setQr(null);
        stopPolling();
      }
      if (st.session.status === "error" || (st.session.status === "disconnected" && st.error)) {
        setError(
          st.error === "whatsapp_web_failed"
            ? "WhatsApp Web não iniciou (Chromium travado). Desconectar → aguarde 5s → Conectar."
            : (st.error ?? "Erro na sessão WhatsApp"),
        );
        stopPolling();
      }
    } finally {
      pollBusyRef.current = false;
    }
  }, [fetchQr, stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    void pollOnce();
    pollRef.current = setInterval(() => void pollOnce(), 6000);
  }, [pollOnce, stopPolling]);

  useEffect(() => {
    void (async () => {
      if (!proActive) return;
      const res = await fetch("/api/justos/whatsapp/status");
      if (!res.ok) return;
      const st = (await res.json()) as WaStatus;
      setData(st);
      if (st.session.status === "starting" || st.session.status === "pairing") {
        startPolling();
      }
    })();
    return () => stopPolling();
  }, [proActive, startPolling, stopPolling]);

  async function connect() {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch("/api/justos/whatsapp/status");
      const st = statusRes.ok ? ((await statusRes.json()) as WaStatus) : null;
      if (st) setData(st);
      if (st && !st.commandReachable) {
        throw new Error(
          "JustOS Command offline. Em outro terminal: cd ~/Projetos/Lex && npm run justos:command",
        );
      }
      const res = await fetch("/api/justos/whatsapp/connect", { method: "POST" });
      const j = (await res.json()) as { error?: string; status?: string };
      if (!res.ok) throw new Error(j.error ?? "Falha ao conectar");
      await refresh();
      if (j.status === "pairing" || j.status === "starting") {
        startPolling();
      } else if (j.status === "connected") {
        setQr(null);
        stopPolling();
      } else {
        await fetchQr();
        startPolling();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    setLoading(true);
    setError(null);
    stopPolling();
    setQr(null);
    try {
      const res = await fetch("/api/justos/whatsapp/disconnect", { method: "POST" });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Falha ao desconectar");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao desconectar");
    } finally {
      await refresh();
      setLoading(false);
    }
  }

  async function sendTest() {
    if (data?.session.status !== "connected") {
      setError("Conecte o WhatsApp antes de testar o envio.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/justos/whatsapp/send-test", { method: "POST" });
      const j = (await res.json()) as { error?: string; ok?: boolean; to?: string };
      if (!res.ok || !j.ok) throw new Error(j.error ?? "Falha no teste");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }

  if (!proActive) {
    return (
      <p className="text-sm text-muted-foreground">
        Contrate o JustOS Pro para conectar o WhatsApp do escritório.
      </p>
    );
  }

  const isDevSingle = data?.openclawMode === "dev-single";
  const isMultiTenant = data?.openclawMode === "process-per-workspace";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant={data?.session.status === "connected" ? "default" : "secondary"}>
          {data?.session.status ?? "desconectado"}
        </Badge>
        <Badge variant={data?.commandReachable ? "outline" : "secondary"}>
          Command {data?.commandReachable ? "OK" : "offline"}
        </Badge>
        <Badge variant={isMultiTenant ? "default" : "outline"}>
          {data?.openclawMode ?? "—"}
        </Badge>
        {data?.openclawPort ? (
          <Badge variant="outline">bridge :{data.openclawPort}</Badge>
        ) : null}
      </div>

      {!data?.commandReachable ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <strong>Command offline</strong> — o JustOS não alcança a porta 3301. Abra um terminal e
          execute: <code className="block mt-1 text-[11px]">cd ~/Projetos/Lex && npm run justos:command</code>
          (OpenClaw bridge em :3310 também deve estar ativo para QR real).
        </p>
      ) : null}

      {isMultiTenant ? (
        <p className="rounded-md border border-violet-500/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-100">
          <strong>Multi-tenant ativo:</strong> cada escritório tem bridge OpenClaw própria (porta{" "}
          {data?.openclawPort ?? "34000+"}), credenciais em{" "}
          <code className="text-[10px]">credentials/whatsapp/&lt;sessionKey&gt;/</code>. Use um QR
          por workspace — ideal para testar 2+ números sem misturar com o SOLD.
        </p>
      ) : null}

      {isDevSingle ? (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
          Modo dev-single: compartilha o WhatsApp do SOLD (bridge :3310). Para testar vários
          escritórios, use <code className="text-[11px]">JUSTOS_OPENCLAW_MODE=process-per-workspace</code>{" "}
          no <code className="text-[10px]">.env.local</code> e reinicie o Command.
        </p>
      ) : null}

      {isDevSingle &&
      data?.commandReachable &&
      data.session.status === "connected" &&
      !data.session.phoneE164 ? (
        <p className="text-xs text-emerald-600">
          WhatsApp já pareado no OpenClaw global (:3310). Use &quot;Testar envio&quot; com cuidado
          (mensagem sai pelo número do SOLD).
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        Sessão: {data?.session.sessionKeyMasked ?? data?.session.sessionKey ?? "—"}
      </p>
      {data?.session.phoneE164 ? (
        <p className="text-sm font-medium">Conectado: {data.session.phoneE164}</p>
      ) : null}

      {(data?.session.status === "pairing" || data?.session.status === "starting") &&
      !qr?.qrAvailable ? (
        <p className="text-sm text-muted-foreground">
          {qr?.error ??
            (loading
              ? "Gerando QR do WhatsApp Web… (1ª vez pode levar até 60s)"
              : "Aguardando QR válido — use Conectar novamente ou aguarde.")}
        </p>
      ) : null}
      {qr?.dataUrl &&
      (data?.session.status === "pairing" || data?.session.status === "starting") ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border bg-white p-4 dark:bg-zinc-950">
          <p className="text-sm font-medium">Escaneie no WhatsApp → Aparelhos conectados</p>
          <Image src={qr.dataUrl} alt="QR WhatsApp" width={280} height={280} unoptimized />
          <p className="text-xs text-muted-foreground">QR atualiza a cada ~20s; escaneie logo após aparecer.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => void connect()} disabled={loading}>
          Conectar WhatsApp
        </Button>
        <Button size="sm" variant="outline" onClick={() => void disconnect()}>
          Desconectar
        </Button>
      </div>

      {data?.session.status === "connected" ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          <p className="text-xs text-muted-foreground flex-1 min-w-[200px]">
            Teste envia uma mensagem para o próprio número conectado
            {data.session.phoneE164 ? ` (${data.session.phoneE164})` : ""}.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void sendTest()}
            disabled={loading}
          >
            Testar envio
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive">
          {error}
          {/detached\s+Frame/i.test(error) ? (
            <span className="block mt-1 text-xs font-normal text-muted-foreground">
              Sessão do navegador travada — clique <strong>Desconectar</strong>, aguarde alguns
              segundos e use <strong>Conectar WhatsApp</strong> para novo QR.
            </span>
          ) : null}
        </p>
      ) : null}
      {data?.error ? <p className="text-xs text-destructive">{data.error}</p> : null}
    </div>
  );
}
