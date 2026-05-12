import Link from "next/link";
import {
 ArrowRight,
 Check,
 FileText,
 Layers,
 Scale,
 Search,
 Shield,
 Sparkles,
 Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LexThemeToggle } from "@/components/ui/theme-toggle";

const NAV = [
 { href: "#funcionalidades", label: "Funcionalidades" },
 { href: "#precos", label: "Preços" },
 { href: "#sobre", label: "Sobre" },
] as const;

const FEATURES = [
 {
 icon: FileText,
 title: "Análise de documentos com IA",
 desc: "Extração estruturada, inconsistências sinalizadas e rastreabilidade por caso e workspace.",
 },
 {
 icon: Sparkles,
 title: "Geração de peças no seu estilo",
 desc: "Perfil de escrita e memória processual orientam minutas coerentes com o que você já protocolou.",
 },
 {
 icon: Search,
 title: "Pesquisa jurídica multicamada",
 desc: "Legislação, jurisprudência e autos do caso em camadas separadas, com citações verificáveis.",
 },
 {
 icon: Layers,
 title: "Progresso inteligente do caso",
 desc: "Fases e próximos passos visíveis para o time avançar sem perder o fio da meada.",
 },
 {
 icon: Users,
 title: "Colaboração da equipe",
 desc: "Comentários internos, timeline auditável e workspaces preparados para escalar o escritório.",
 },
 {
 icon: Shield,
 title: "Segurança e privacidade",
 desc: "Isolamento por workspace, opt-in de memória e governança pensada para dado sensível de clientes.",
 },
] as const;

const TESTIMONIALS = [
 {
 initials: "MV",
 name: "Dra. Mariana Vieira",
 oab: "OAB/SP 412.883",
 quote:
 "O fluxo lembra produto de engenharia séria: cada tela tem intenção. A pesquisa com camadas separadas reduziu retrabalho na equipe.",
 },
 {
 initials: "RA",
 name: "Dr. Ricardo Almeida",
 oab: "OAB/MG 128.440",
 quote:
 "Saímos do ‘colar PDF no chat’. O Lex força contexto do caso e deixa claro quando falta fundamento — isso é maturidade de produto.",
 },
 {
 initials: "HM",
 name: "Dra. Helena Monteiro",
 oab: "OAB/RJ 201.902",
 quote:
 "A visão de progresso e os próximos passos viraram ritual de abertura de reunião. Menos improviso, mais previsibilidade.",
 },
] as const;

const PLANS = [
 {
 name: "Starter",
 price: "R$ 0",
 period: "para experimentar",
 desc: "Até 3 usuários, 1 workspace, limites de ingestão educacionais.",
 features: ["Casos e documentos", "Pesquisa jurídica básica", "Suporte por e-mail"],
 cta: "Começar grátis",
 href: "/register",
 highlight: false,
 primary: false,
 },
 {
 name: "Pro",
 price: "Sob consulta",
 period: "escritórios em crescimento",
 desc: "Memória de escritório, pesquisa assistida por IA, peças e revisão com governança.",
 features: [
 "Workspaces ilimitados",
 "Ingestão prioritária",
 "Estratégia e peças com IA",
 "Suporte prioritário",
 ],
 cta: "Falar com vendas",
 href: "/pricing",
 highlight: true,
 primary: true,
 },
 {
 name: "Enterprise",
 price: "Custom",
 period: "grandes operações",
 desc: "SSO, SLA dedicado, retenção e conformidade sob medida do seu escritório.",
 features: ["Implantação assistida", "Treinamento do time", "Roadmap conjunto", "Ambiente dedicado"],
 cta: "Agendar conversa",
 href: "/pricing",
 highlight: false,
 primary: false,
 },
] as const;

export default function MarketingHomePage() {
 return (
 <div className="relative min-h-screen overflow-x-hidden lex-hero-gradient">
 <header className="sticky top-0 z-50 border-b border-[color:var(--glass-border)]">
 <div className="lex-glass-strong mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
 <Link
 href="/"
 className="flex items-center gap-2.5 font-semibold tracking-tight text-[color:var(--text-primary)] lex-transition hover:opacity-90"
 aria-label="Lex — início"
 >
 <span
 className="flex size-8 items-center justify-center rounded-md text-sm font-semibold text-[color:var(--text-inverse)]"
 style={{
 background: "var(--brand-primary)",
 boxShadow: "var(--shadow-violet)",
 }}
 >
 L
 </span>
 <span className="hidden sm:inline">Lex</span>
 </Link>
 <nav className="hidden items-center gap-6 md:flex" aria-label="Principal">
 {NAV.map((item) => (
 <a
 key={item.href}
 href={item.href}
 className="text-[13px] font-medium text-[color:var(--text-secondary)] lex-transition hover:text-[color:var(--text-primary)]"
 >
 {item.label}
 </a>
 ))}
 </nav>
 <div className="flex items-center gap-2 md:gap-3">
 <LexThemeToggle className="inline-flex shrink-0" />
 <Link href="/login">
 <Button
 variant="ghost"
 size="sm"
 className="text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-overlay)] hover:text-[color:var(--text-primary)]"
 >
 Entrar
 </Button>
 </Link>
 <Link href="/register">
 <Button
 size="sm"
 className="rounded-md border border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95"
 style={{
 background: "var(--brand-primary)",
 boxShadow: "var(--shadow-violet)",
 }}
 >
 Começar grátis
 </Button>
 </Link>
 </div>
 </div>
 </header>

 <main>
 <section className="mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-12 md:grid-cols-2 md:items-center md:gap-16 md:px-6 md:pt-16">
 <div className="space-y-6">
 <p
 className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--brand-border)] px-3 py-1 text-[11px] font-medium uppercase tracking-wide text-[color:var(--brand-text)]"
 style={{ background: "var(--brand-subtle)" }}
 >
 Copiloto jurídico com IA
 </p>
 <h1 className="font-serif text-[2.5rem] font-normal leading-[1.08] tracking-tight text-[color:var(--text-primary)] md:text-[52px]">
 Advocacia com{" "}
 <em className="text-[color:var(--brand-text)]" style={{ fontStyle: "italic" }}>
 inteligência
 </em>{" "}
 operacional
 </h1>
 <p className="max-w-lg text-base leading-relaxed text-[color:var(--text-secondary)]">
 Memória persistente, pesquisa jurídica assistida por IA e geração de peças alinhadas ao seu estilo — com
 interface pensada para jornadas longas e leitura confortável.
 </p>
 <div className="flex flex-wrap gap-3">
 <Link href="/register">
 <Button
 size="lg"
 className="gap-2 rounded-md border border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95"
 style={{
 background: "var(--brand-primary)",
 boxShadow: "var(--shadow-violet)",
 }}
 >
 Começar grátis <ArrowRight className="size-4" aria-hidden />
 </Button>
 </Link>
 <Link href="/pricing">
 <Button
 size="lg"
 variant="outline"
 className="rounded-md border-[0.5px] border-[color:var(--border-default)] bg-[color:var(--glass-bg)] text-[color:var(--text-primary)] backdrop-blur-xl lex-transition hover:bg-[color:var(--surface-overlay-strong)]"
 >
 Ver preços
 </Button>
 </Link>
 </div>
 </div>
 <div
 className="lex-glass relative overflow-hidden rounded-2xl p-6 md:p-8"
 style={{ boxShadow: "var(--shadow-lg), var(--glass-shadow)" }}
 aria-label="Prévia do painel"
 >
 <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--brand-subtle),transparent_55%)]" />
 <div className="relative space-y-3 font-mono text-[13px]">
 <p className="text-[10px] font-medium uppercase tracking-widest text-[color:var(--text-muted)]">
 Painel
 </p>
 <div
 className="rounded-lg border-[0.5px] border-[color:var(--border-default)] p-3 text-[color:var(--text-secondary)]"
 style={{ background: "var(--surface-elevated)" }}
 >
 ▸ Casos · progresso por fases · próximo passo sugerido
 </div>
 <div
 className="rounded-lg border-[0.5px] border-[color:var(--border-subtle)] p-3 text-[color:var(--text-secondary)]"
 style={{ background: "var(--surface-card)" }}
 >
 ▸ Pesquisa · legislação + jurisprudência + autos do caso
 </div>
 <div
 className="rounded-lg border-[0.5px] border-[color:var(--border-subtle)] p-3 text-[color:var(--text-muted)]"
 style={{ background: "var(--surface-card)" }}
 >
 ▸ Peças · revisão assistida · exportação profissional
 </div>
 </div>
 </div>
 </section>

 <section
 id="funcionalidades"
 className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 md:px-6"
 aria-labelledby="features-heading"
 >
 <h2
 id="features-heading"
 className="text-center text-2xl font-medium tracking-tight text-[color:var(--text-primary)] md:text-[26px]"
 >
 Funcionalidades que sustentam o trabalho do advogado
 </h2>
 <p className="mx-auto mt-3 max-w-2xl text-center text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
 Cada módulo foi desenhado para reduzir atrito entre coleta, inteligência e produção documental.
 </p>
 <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
 {FEATURES.map(({ icon: Icon, title, desc }) => (
 <article
 key={title}
 className="lex-glass lex-transition flex flex-col rounded-xl p-5 hover:border-[color:var(--border-strong)]"
 >
 <div
 className="mb-4 flex size-10 items-center justify-center rounded-lg border-[0.5px] border-[color:var(--brand-border)]"
 style={{ background: "var(--brand-subtle)" }}
 >
 <Icon className="size-5 text-[color:var(--brand-text)]" aria-hidden />
 </div>
 <h3 className="text-[15px] font-medium leading-snug text-[color:var(--text-primary)]">{title}</h3>
 <p className="mt-2 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{desc}</p>
 </article>
 ))}
 </div>
 </section>

 <section className="border-y border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] py-16">
 <div className="mx-auto max-w-6xl px-4 md:px-6">
 <h2 className="text-center text-2xl font-medium tracking-tight text-[color:var(--text-primary)]">
 Escrito para quem vive o processo
 </h2>
 <div className="mt-10 grid gap-4 md:grid-cols-3">
 {TESTIMONIALS.map((t) => (
 <figure
 key={t.oab}
 className="lex-glass flex h-full flex-col rounded-xl p-5"
 >
 <div className="flex items-center gap-3">
 <div
 className="flex size-10 shrink-0 items-center justify-center rounded-full border-[0.5px] border-[color:var(--border-default)] text-xs font-semibold text-[color:var(--brand-text)]"
 style={{ background: "var(--brand-subtle)" }}
 aria-hidden
 >
 {t.initials}
 </div>
 <div>
 <figcaption className="text-sm font-medium text-[color:var(--text-primary)]">
 {t.name}
 </figcaption>
 <p className="text-[11px] text-[color:var(--text-muted)]">{t.oab}</p>
 </div>
 </div>
 <blockquote className="mt-4 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
 &ldquo;{t.quote}&rdquo;
 </blockquote>
 </figure>
 ))}
 </div>
 </div>
 </section>

 <section id="precos" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-20 md:px-6" aria-labelledby="pricing-heading">
 <h2
 id="pricing-heading"
 className="text-center text-2xl font-medium tracking-tight text-[color:var(--text-primary)] md:text-[26px]"
 >
 Planos
 </h2>
 <p className="mx-auto mt-3 max-w-xl text-center text-[13px] text-[color:var(--text-secondary)]">
 Escale conforme o tamanho do escritório. O plano Pro concentra o que a maioria dos times jurídicos precisa
 no dia a dia.
 </p>
 <div className="mt-10 grid gap-4 md:grid-cols-3">
 {PLANS.map((plan) => (
 <div
 key={plan.name}
 className="lex-glass relative flex flex-col rounded-xl p-6 lex-transition"
 style={
 plan.highlight
 ? {
 borderColor: "var(--brand-primary)",
 boxShadow: "var(--shadow-violet), var(--glass-shadow)",
 }
 : undefined
 }
 >
 {plan.highlight ? (
 <span
 className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border-[0.5px] border-[color:var(--brand-border)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[color:var(--brand-text)]"
 style={{ background: "var(--brand-subtle)" }}
 >
 Mais popular
 </span>
 ) : null}
 <h3 className="text-lg font-semibold text-[color:var(--text-primary)]">{plan.name}</h3>
 <p className="mt-1 text-2xl font-medium tracking-tight text-[color:var(--text-primary)]">{plan.price}</p>
 <p className="text-[12px] text-[color:var(--text-muted)]">{plan.period}</p>
 <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">{plan.desc}</p>
 <ul className="mt-5 flex-1 space-y-2 text-[13px] text-[color:var(--text-secondary)]">
 {plan.features.map((f) => (
 <li key={f} className="flex items-start gap-2">
 <Check className="mt-0.5 size-4 shrink-0 text-[color:var(--success-text)]" aria-hidden />
 <span>{f}</span>
 </li>
 ))}
 </ul>
 <div className="mt-6">
 <Link href={plan.href} className="block w-full">
 {plan.primary ? (
 <Button
 className="w-full rounded-md border border-[color:var(--brand-border)] text-[color:var(--text-inverse)] lex-transition hover:opacity-95"
 style={{
 background: "var(--brand-primary)",
 boxShadow: "var(--shadow-violet)",
 }}
 >
 {plan.cta}
 </Button>
 ) : (
 <Button
 variant="outline"
 className="w-full rounded-md border-[0.5px] border-[color:var(--border-default)] bg-transparent text-[color:var(--text-primary)] hover:bg-[color:var(--surface-overlay)]"
 >
 {plan.cta}
 </Button>
 )}
 </Link>
 </div>
 </div>
 ))}
 </div>
 </section>

 <section id="sobre" className="mx-auto max-w-3xl scroll-mt-24 px-4 py-16 md:px-6" aria-labelledby="about-heading">
 <div className="lex-glass rounded-xl p-8 text-center">
 <Scale className="mx-auto size-8 text-[color:var(--brand-text)]" aria-hidden />
 <h2 id="about-heading" className="mt-4 text-xl font-medium text-[color:var(--text-primary)]">
 Sobre o Lex
 </h2>
 <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
 Somos um time que acredita que software jurídico de primeira linha combina engenharia de dados, UX
 operacional e respeito à responsabilidade profissional do advogado. O Lex existe para ser o sistema onde
 estratégia, fundamentação e peça se encontram — sem atalhos que comprometam a defesa.
 </p>
 <Link href="/manifesto" className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand-text)] lex-transition hover:underline">
 Ler manifesto <ArrowRight className="size-4" aria-hidden />
 </Link>
 </div>
 </section>
 </main>

 <footer className="lex-marketing-footer mt-12">
 <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4 md:px-6">
 <div>
 <div className="flex items-center gap-2">
 <span
 className="flex size-8 items-center justify-center rounded-md text-xs font-semibold text-[color:var(--text-inverse)]"
 style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-violet)" }}
 >
 L
 </span>
 <span className="font-semibold text-[color:var(--text-primary)]">Lex</span>
 </div>
 <p className="mt-3 text-[13px] leading-relaxed text-[color:var(--text-secondary)]">
 Copiloto jurídico com memória, pesquisa multicamada e peças no seu estilo.
 </p>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
 Produto
 </p>
 <ul className="mt-3 space-y-2 text-[13px]">
 <li>
 <a href="#funcionalidades" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
 Funcionalidades
 </a>
 </li>
 <li>
 <Link href="/pricing" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
 Preços
 </Link>
 </li>
 <li>
 <Link href="/login" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
 Entrar
 </Link>
 </li>
 </ul>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
 Recursos
 </p>
 <ul className="mt-3 space-y-2 text-[13px]">
 <li>
 <Link href="/register" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
 Criar conta
 </Link>
 </li>
 <li>
 <Link href="/manifesto" className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]">
 Manifesto
 </Link>
 </li>
 </ul>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
 Legal
 </p>
 <p className="mt-3 text-[12px] text-[color:var(--text-muted)]">
 Uso profissional. Revise minutas antes de protocolar.
 </p>
 </div>
 </div>
 <div className="border-t border-[color:var(--border-subtle)] py-6 text-center text-[11px] text-[color:var(--text-muted)]">
 Lex — copiloto jurídico © {new Date().getFullYear()}
 </div>
 </footer>
 </div>
 );
}
