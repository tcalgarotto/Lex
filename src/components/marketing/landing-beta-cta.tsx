"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BETA_TEAM_SIZE_OPTIONS } from "@/lib/marketing/beta-lead";
import {
  type BetaLeadAttribution,
  readReferrer,
  readUtmFromSearchParams,
} from "@/lib/marketing/beta-lead-attribution";
import { PRODUCT_NAME } from "@/lib/brand/justos";
import { trackMarketingEvent } from "@/lib/marketing/analytics";

const fieldClass =
  "flex h-10 w-full rounded-md border border-[color:var(--border-default)] bg-[color:var(--surface-elevated)] px-3 py-2 text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-focus)] disabled:cursor-not-allowed disabled:opacity-50";

type FormState = {
  name: string;
  email: string;
  company: string;
  role: string;
  teamSize: string;
  mainPain: string;
  contactConsent: boolean;
  companyWebsite: string;
};

const INITIAL: FormState = {
  name: "",
  email: "",
  company: "",
  role: "",
  teamSize: "",
  mainPain: "",
  contactConsent: false,
  companyWebsite: "",
};

export function LandingBetaCta() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [submittingIntent, setSubmittingIntent] = useState<"beta" | "demo" | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const attributionRef = useRef<BetaLeadAttribution>({
    utmSource: "",
    utmMedium: "",
    utmCampaign: "",
    utmContent: "",
    utmTerm: "",
    referrer: "",
  });
  const viewTracked = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    attributionRef.current = {
      ...readUtmFromSearchParams(params),
      referrer: readReferrer(),
    };
    if (!viewTracked.current) {
      viewTracked.current = true;
      trackMarketingEvent("landing_beta_form_view");
    }
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    const intent = submitter?.dataset["intent"] === "demo" ? "demo" : "beta";
    if (!form.contactConsent) {
      toast.error("Autorize o contato para continuar.");
      return;
    }
    if (!form.teamSize) {
      toast.error("Selecione o tamanho do time.");
      return;
    }

    setSubmittingIntent(intent);
    if (intent === "demo") trackMarketingEvent("landing_demo_click");
    try {
      const res = await fetch("/api/marketing/beta-lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, intent, ...attributionRef.current }),
      });
      const data = (await res.json()) as { ok?: boolean; message?: string; error?: string };
      if (!res.ok) {
        trackMarketingEvent("landing_beta_form_submit_error", { status: res.status });
        toast.error(data.error ?? "Não foi possível enviar. Tente novamente.");
        return;
      }
      trackMarketingEvent("landing_beta_form_submit_success", { intent });
      setSubmitted(true);
      toast.success(data.message ?? "Solicitação enviada com sucesso.");
      setForm(INITIAL);
    } catch {
      trackMarketingEvent("landing_beta_form_submit_error", { reason: "network" });
      toast.error("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmittingIntent(null);
    }
  }

  return (
    <div className="landing-beta-form relative mx-auto max-w-2xl sm:px-2">
      {submitted ? (
        <div className="space-y-4 py-6 text-center">
          <p className="text-lg font-medium text-[color:var(--text-primary)]">Recebemos sua solicitação</p>
          <p className="text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
            Nossa equipe analisa cada solicitação e responde por e-mail em até alguns dias úteis.
          </p>
          <Button type="button" variant="outline" onClick={() => setSubmitted(false)}>
            Enviar outra solicitação
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <div
            className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden opacity-0"
            aria-hidden="true"
          >
            <label htmlFor="companyWebsite-hp" className="sr-only">
              Deixe em branco
            </label>
            <input
              id="companyWebsite-hp"
              type="text"
              name="companyWebsite"
              tabIndex={-1}
              autoComplete="off"
              value={form.companyWebsite}
              onChange={(e) => update("companyWebsite", e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="beta-name">Nome completo</Label>
              <Input
                id="beta-name"
                name="name"
                required
                autoComplete="name"
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Maria Silva"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="beta-email">E-mail profissional</Label>
              <Input
                id="beta-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="maria@escritorio.com.br"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="beta-company">Escritório ou empresa</Label>
              <Input
                id="beta-company"
                name="company"
                required
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Silva & Associados"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="beta-role">Cargo</Label>
              <Input
                id="beta-role"
                name="role"
                value={form.role}
                onChange={(e) => update("role", e.target.value)}
                placeholder="Sócia, coordenador(a)…"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beta-team">Tamanho do time jurídico</Label>
            <select
              id="beta-team"
              name="teamSize"
              required
              value={form.teamSize}
              onChange={(e) => update("teamSize", e.target.value)}
              className={fieldClass}
            >
              <option value="" disabled>
                Selecione…
              </option>
              {BETA_TEAM_SIZE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beta-pain">Principal desafio hoje (opcional)</Label>
            <Textarea
              id="beta-pain"
              name="mainPain"
              rows={3}
              value={form.mainPain}
              onChange={(e) => update("mainPain", e.target.value)}
              placeholder="Ex.: pesquisa lenta, perda de contexto entre caso e peça…"
              className="min-h-[88px] resize-y"
            />
          </div>

          <div className="flex items-start gap-3 border-t border-[color:var(--border-subtle)] pt-4">
            <input
              id="beta-consent"
              name="contactConsent"
              type="checkbox"
              className="mt-0.5 size-4 shrink-0 accent-[var(--brand-primary)]"
              checked={form.contactConsent}
              onChange={(e) => update("contactConsent", e.target.checked)}
              required
              aria-required="true"
              aria-describedby="beta-consent-hint"
            />
            <div className="min-w-0 space-y-2">
              <Label
                htmlFor="beta-consent"
                className="cursor-pointer text-[13px] font-normal leading-snug text-[color:var(--text-secondary)]"
              >
                Autorizo o {PRODUCT_NAME} a entrar em contato sobre acesso à plataforma e demonstrações, conforme a{" "}
                <Link
                  href="/privacidade"
                  className="font-medium text-[color:var(--text-primary)] underline-offset-2 hover:underline"
                >
                  Política de Privacidade
                </Link>
                .
              </Label>
              <p id="beta-consent-hint" className="text-caption text-[color:var(--text-muted)]">
                Obrigatório para enviar. Você pode revogar o contato a qualquer momento.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button
              type="submit"
              data-intent="beta"
              disabled={submittingIntent !== null}
              className="h-12 flex-1 gap-2 rounded-lg border border-[color:var(--brand-border)] text-[color:var(--text-inverse)]"
              style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-sm)" }}
            >
              {submittingIntent === "beta" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <ArrowRight className="size-4" aria-hidden />
              )}
              Solicitar acesso
            </Button>
            <Button
              type="submit"
              data-intent="demo"
              disabled={submittingIntent !== null}
              variant="outline"
              className="h-12 flex-1 gap-2 rounded-lg"
            >
              {submittingIntent === "demo" ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Calendar className="size-4" aria-hidden />
              )}
              Agendar demonstração
            </Button>
          </div>

          <p className="text-center text-[12px] text-[color:var(--text-muted)]">
            Já tem convite?{" "}
            <Link href="/register" className="font-medium text-[color:var(--brand-text)] hover:underline">
              Criar conta
            </Link>
            {" · "}
            <Link href="/login" className="hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      )}
    </div>
  );
}
