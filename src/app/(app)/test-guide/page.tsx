/**
 * Guia premium do "primeiro teste com advogado".
 *
 * Página interna (autenticada) que serve de checklist + formulário de feedback.
 * O conteúdo aqui DEVE bater com `docs/FIRST_LAWYER_TEST_GUIDE.md`.
 */

import Link from "next/link";
import {
 ArrowRight,
 Briefcase,
 CheckCircle2,
 ClipboardCopy,
 ClipboardList,
 FileText,
 Search,
 Shield,
 Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SentinelJourneysPanel } from "@/components/test-guide/sentinel-journeys-panel";
import { INTERNAL_SEARCH_SCOPE_REMINDER } from "@/lib/ui/product-terminology";


const STEPS = [
 {
 id: 1,
 title: "Crie um caso",
 href: "/cases/new",
 icon: Briefcase,
 body: "Use um dos relatos fictícios abaixo. Dê preferência a “Relato livre” para ver extração automática ou “Entrevista guiada” para checklist estruturada.",
 },
 {
 id: 2,
 title: "Estruture o caso",
 href: "/cases",
 icon: Sparkles,
 body: "No caso, revise/edite Partes, Fatos, Pedidos e Riscos (inline). O objetivo é deixar o caso auditável antes de gerar peça.",
 },
 {
 id: 3,
 title: "Pesquise o direito (com fonte)",
 href: "/cases",
 icon: Search,
 body: "Na aba “Pesquisa jurídica” do caso, rode as queries sugeridas. Confirme que cada resultado mostra fonte + trecho e que você consegue salvar fundamento no caso.",
 },
 {
 id: 4,
 title: "Gere a minuta",
 href: "/cases",
 icon: FileText,
 body: "Gere a minuta no caso. Confirme que a seção “Do direito” usa apenas fundamentos com fonte/trecho (sem fundamento inventado).",
 },
 {
 id: 5,
 title: "Rode o review",
 href: "/cases",
 icon: Shield,
 body: "Rode o review no caso. Confirme score 0..1 e que reprova: peça sem fonte, placeholders, inconsistências e lacunas relevantes.",
 },
 {
 id: 6,
 title: "Exporte (se aplicável)",
 href: "/editor",
 icon: ClipboardCopy,
 body: "No editor/peça, valide ações de export/cópia e confirme que o sistema não promete “pronto para protocolo” quando houver lacunas/risco.",
 },
];

const QUESTIONS = [
 "O que ficou claro? Quais partes da UI fazem sentido sem explicação?",
 "O que ficou confuso? Onde travou ou achou ambíguo?",
 "Qual feature pareceu mais útil?",
 "Qual feature pareceu arriscada/perigosa?",
 "A resposta jurídica parece confiável? Confiaria em apresentar para um cliente?",
 "As fontes ajudam? Os trechos citáveis e as referências legais são suficientes para auditar?",
 "O que falta para usar no escritório? (integrações, áreas, tribunais)",
 "Quais áreas jurídicas devemos priorizar?",
 "Quais tribunais/fontes são obrigatórios?",
 "Pagaria por isso? Quanto/mês?",
];

export default async function TestGuidePage() {
 return (
 <div className="w-full min-w-0 space-y-8">
 <header className="space-y-3">
 <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
 <ClipboardList className="size-3.5" /> Primeiro teste com advogado
 </div>
 <h1 className="text-2xl font-semibold leading-tight">
 Como testar o JustOS (P0 comercial)
 </h1>
 <p className="max-w-3xl text-sm text-muted-foreground">
 Use as 6 jornadas sentinela (abaixo) para validar o fluxo caso-cêntrico de ponta a ponta:
 caso → estrutura editável → pesquisa jurídica com fonte → minuta → review → export.
 <strong className="text-foreground"> AI_REASONING ≠ LEGAL_TRUTH.</strong> Base ausente deve virar lacuna explícita.
 {" "}
 {INTERNAL_SEARCH_SCOPE_REMINDER}
 </p>
 <div className="flex flex-wrap gap-2">
 <Badge variant="outline">Auditável</Badge>
 <Badge variant="outline">Multi-tenant</Badge>
 <Badge variant="outline">Determinístico</Badge>
 <Badge variant="outline">Sem fundamento inventado</Badge>
 </div>
 </header>

 <Card className="p-4 text-sm">
 <strong className="text-foreground">Antes de começar</strong>
 <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
 <li>Não use dados reais sensíveis no teste inicial — prefira casos fictícios ou anonimizados.</li>
 <li>O JustOS não substitui sua revisão. Toda peça gerada exige conferência humana.</li>
 <li>Você pode voltar a esta página quando quiser pelo sidebar (em breve) ou em <code>/test-guide</code>.</li>
 </ul>
 </Card>

 <section className="space-y-3">
 <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
 <Sparkles className="size-3.5" /> 6 passos (fluxo)
 </h2>
 <ol className="space-y-3">
 {STEPS.map((s) => (
 <li key={s.id}>
 <Card className="p-4">
 <div className="flex items-start gap-3">
 <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-300">
 <s.icon className="size-4" />
 </div>
 <div className="flex-1">
 <div className="flex items-center justify-between gap-2">
 <h3 className="font-medium">
 {s.id}. {s.title}
 </h3>
 <Link href={s.href}>
 <Button size="sm" variant="ghost" className="gap-1">
 Abrir <ArrowRight className="size-3.5" />
 </Button>
 </Link>
 </div>
 <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
 </div>
 </div>
 </Card>
 </li>
 ))}
 </ol>
 </section>

 <section className="space-y-3">
 <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
 <ClipboardCopy className="size-3.5" /> 6 jornadas sentinela (copie e cole)
 </h2>
 <SentinelJourneysPanel />
 </section>

 <section className="space-y-3">
 <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
 <CheckCircle2 className="size-3.5" /> Perguntas para você responder
 </h2>
 <Card className="p-4">
 <ol className="list-decimal space-y-2 pl-5 text-sm text-foreground">
 {QUESTIONS.map((q) => (
 <li key={q}>{q}</li>
 ))}
 </ol>
 <p className="mt-4 text-xs text-muted-foreground">
 Envie suas respostas por email ou pelo canal acordado. Toda resposta direta
 ajuda a priorizar o roadmap próximo.
 </p>
 </Card>
 </section>

 <section className="space-y-3 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
 <h3 className="font-medium">Importante</h3>
 <p>
 O JustOS está em primeira leva de testes reais. Você pode encontrar áreas com
 cobertura parcial (jurisprudência regional, integrações ainda em modo mock)
 — isso é esperado. Ajude reportando exatamente o que travou e em qual passo.
 </p>
 </section>
 </div>
 );
}
