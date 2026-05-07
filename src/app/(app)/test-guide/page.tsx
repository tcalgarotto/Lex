/**
 * Roteiro premium do "primeiro teste com advogado".
 *
 * Página interna (autenticada) que serve de checklist + formulário de feedback.
 * O conteúdo aqui DEVE bater com `docs/FIRST_LAWYER_TEST_GUIDE.md`.
 */

import Link from "next/link";
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  FileText,
  GitBranch,
  Activity,
  Shield,
  Sparkles,
  Upload,
} from "lucide-react";
import { AppShell } from "@/components/app/app-shell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const STEPS = [
  {
    id: 1,
    title: "Crie um caso",
    href: "/cases/new",
    icon: Briefcase,
    body: "Cole 1-2 parágrafos com fatos, partes e pedidos. O Lex extrai automaticamente partes (autor/réu, CPF/CNPJ, ente público), fatos numerados, pedidos e tribunal-alvo. Tudo determinístico, sem LLM no caminho crítico.",
  },
  {
    id: 2,
    title: "Rode estratégia",
    href: "/strategy",
    icon: GitBranch,
    body: "Cole sua consulta jurídica (ex.: 'boa-fé objetiva art. 422 CC'). Você verá Trust UX overview (confiança, divergência, força argumentativa), Research Engine (teses dominantes, divergências, precedentes líderes), reasoning tree e timeline jurídica.",
  },
  {
    id: 3,
    title: "Gere a minuta",
    href: "/cases",
    icon: FileText,
    body: "No caso criado, clique 'Gerar minuta'. Lex monta peça Markdown estruturada (Endereçamento → Partes → Fatos → Direito → Pedidos → Tutela → Provas → Valor). Cada artigo do 'Direito' é ancorado em chunks normativos do corpus.",
  },
  {
    id: 4,
    title: "Rode review",
    href: "/cases",
    icon: Shield,
    body: "Botão 'Rodar review' no caso. Checklist de 8 critérios (estrutura, grounding, pedido principal, urgência, fatos, normas revogadas, divergência, issues abertas) com score 0..1 e veredicto humano.",
  },
  {
    id: 5,
    title: "Visite o cockpit",
    href: "/cockpit",
    icon: Activity,
    body: "Timeline jurídica viva — alertas (mudança jurisprudencial, tese enfraquecida, risco crescente), integrações conectadas e notificações operacionais.",
  },
  {
    id: 6,
    title: "Faça upload de documento",
    href: "/processos",
    icon: Upload,
    body: "Crie um processo, faça upload de PDF (até 50MB). O Lex roda OCR + chunking + embedding em background via Inngest, sem travar a UI.",
  },
];

const QUESTIONS = [
  "O que ficou claro? Quais partes da UI fazem sentido sem explicação?",
  "O que ficou confuso? Onde travou ou achou ambíguo?",
  "Qual feature pareceu mais útil?",
  "Qual feature pareceu arriscada/perigosa?",
  "A resposta jurídica parece confiável? Confiaria em apresentar para um cliente?",
  "As fontes ajudam? Os chunks/URNs são suficientes para auditar?",
  "O que falta para usar no escritório? (integrações, áreas, tribunais)",
  "Quais áreas jurídicas devemos priorizar?",
  "Quais tribunais/fontes são obrigatórios?",
  "Pagaria por isso? Quanto/mês?",
];

export default async function TestGuidePage() {
  return (
    <AppShell title="Roteiro de teste">
      <div className="mx-auto max-w-4xl space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
            <ClipboardList className="size-3.5" /> Primeiro teste com advogado
          </div>
          <h1 className="text-2xl font-semibold leading-tight">
            Bem-vindo ao Lex — copiloto jurídico operacional
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Esse roteiro guia 6 passos de avaliação real. Tudo o que o Lex faz é
            explicável: cada resposta carrega URNs, chunks e traceIds para auditar.
            <strong className="text-foreground"> Não substitui revisão humana </strong>—
            toda minuta exige conferência antes de protocolo.
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Auditável</Badge>
            <Badge variant="outline">Multi-tenant</Badge>
            <Badge variant="outline">Determinístico</Badge>
            <Badge variant="outline">Sem agente autônomo</Badge>
          </div>
        </header>

        <Card className="p-4 text-sm">
          <strong className="text-foreground">Antes de começar</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Não use dados reais sensíveis no teste inicial — prefira casos fictícios ou anonimizados.</li>
            <li>O Lex não substitui sua revisão. Toda peça gerada exige conferência humana.</li>
            <li>Você pode voltar a esta página quando quiser pelo sidebar (em breve) ou em <code>/test-guide</code>.</li>
          </ul>
        </Card>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Sparkles className="size-3.5" /> 6 passos
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
            O Lex está em primeira leva de testes reais. Você pode encontrar áreas com
            cobertura parcial (jurisprudência regional, integrações ainda em modo mock)
            — isso é esperado. Ajude reportando exatamente o que travou e em qual passo.
          </p>
        </section>
      </div>
    </AppShell>
  );
}
