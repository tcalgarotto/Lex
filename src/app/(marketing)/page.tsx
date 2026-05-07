"use client";

import Link from "next/link";
import { ArrowRight, Brain, Check, Layers, Scale, Shield, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const tribunals = ["STF", "STJ", "TST", "TSE", "STM", "TJSP", "TJRJ", "TJMG", "TRF", "TRT"];

export default function MarketingHomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.22),transparent),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(59,130,246,0.12),transparent)]" />
      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-8">
        <span className="text-lg font-semibold tracking-tight">Lex</span>
        <nav className="hidden gap-6 text-sm text-zinc-400 md:flex">
          <a href="#pilares" className="hover:text-zinc-200">
            Pilares
          </a>
          <a href="#comparativo" className="hover:text-zinc-200">
            Comparativo
          </a>
          <a href="#depoimentos" className="hover:text-zinc-200">
            Depoimentos
          </a>
          <Link href="/pricing" className="hover:text-zinc-200">
            Preços
          </Link>
        </nav>
        <div className="flex gap-3">
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Entrar
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">Começar</Button>
          </Link>
        </div>
      </header>

      <main>
        <section className="relative z-10 mx-auto flex max-w-6xl flex-col gap-16 px-6 pb-20 pt-8 md:flex-row md:items-center md:gap-12">
          <div className="flex-1 space-y-8">
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 backdrop-blur"
            >
              <Sparkles className="size-3 text-violet-400" />
              A referência em copiloto jurídico no Brasil — arquitetura séria, UX de produto premium
            </motion.p>
            <motion.h1
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl font-semibold tracking-tight md:text-5xl md:leading-tight"
            >
              O copiloto que{" "}
              <span className="bg-gradient-to-r from-violet-400 to-blue-400 bg-clip-text text-transparent">
                aprende seu estilo
              </span>
              , fundamenta com fontes e lembra cada processo.
            </motion.h1>
            <p className="max-w-xl text-lg leading-relaxed text-zinc-400">
              RAG multicamada (legislação, jurisprudência, seus autos, peças e memória processual),
              retrieval híbrido com reranking, editor TipTap com IA inline e infra pronta para
              multi-workspace — sem atalhos de MVP.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/register">
                <Button size="lg" className="gap-2 shadow-lg shadow-violet-500/20">
                  Garantir minha vaga <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button size="lg" variant="outline" className="border-white/15 bg-white/5">
                  Ver planos
                </Button>
              </Link>
            </div>
            <p className="text-xs text-zinc-500">Compatível com o stack que você já usa: Supabase, Vercel, Qdrant, Inngest.</p>
          </div>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="flex-1 rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/90 to-zinc-950/90 p-6 shadow-2xl shadow-violet-500/10 backdrop-blur-xl"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Fluxo ao vivo</p>
            <div className="mt-4 space-y-3 font-mono text-sm">
              <div className="rounded-lg border border-white/5 bg-black/30 p-3 text-violet-300/90">
                ▸ Query expansion · embeddings BGE-M3 · Qdrant filtrado por workspace
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-zinc-300">
                ▸ BM25 + vetorial + RRF · rerank BGE · citações [fonte:N]
              </div>
              <div className="rounded-lg border border-white/5 bg-black/20 p-3 text-zinc-400">
                ▸ Memória longitudinal + perfil de escrita injetados no prompt
              </div>
            </div>
          </motion.div>
        </section>

        <section className="relative z-10 border-y border-white/5 bg-white/[0.02] py-12">
          <p className="mx-auto mb-6 max-w-6xl px-6 text-center text-xs font-medium uppercase tracking-widest text-zinc-500">
            Estruturado para o ecossistema jurídico brasileiro
          </p>
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-4 px-6">
            {tribunals.map((t) => (
              <span
                key={t}
                className="rounded-lg border border-white/10 bg-zinc-900/50 px-4 py-2 text-sm font-medium text-zinc-400"
              >
                {t}
              </span>
            ))}
          </div>
        </section>

        <section id="pilares" className="relative z-10 mx-auto max-w-6xl scroll-mt-24 px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Por que o Lex é diferente</h2>
          <p className="mx-auto mt-3 max-w-2xl text-center text-zinc-400">
            Três pilares que transformam IA genérica em sistema operacional jurídico.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: Brain,
                t: "Memória persistente",
                d: "Estratégia, teses, clientes e histórico por processo — a IA não “esquece” o caso quando você fecha a aba.",
              },
              {
                icon: Layers,
                t: "RAG jurídico real",
                d: "Camadas separadas para legislação, jurisprudência, documentos, peças e memória — com grounding obrigatório.",
              },
              {
                icon: Zap,
                t: "Seu estilo, sempre",
                d: "Engine de perfil de escrita aprende com suas peças e orienta geração e reescrita no editor.",
              },
            ].map(({ icon: Icon, t, d }, i) => (
              <motion.div
                key={t}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="rounded-2xl border border-white/10 bg-zinc-900/40 p-6 backdrop-blur"
              >
                <Icon className="mb-3 size-6 text-violet-400" />
                <h3 className="text-lg font-medium">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{d}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section id="comparativo" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Lex vs. o resto</h2>
          <div className="mt-10 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-medium">Capacidade</th>
                  <th className="p-4 font-medium text-violet-300">Lex</th>
                  <th className="p-4 text-zinc-500">Chat genérico</th>
                  <th className="p-4 text-zinc-500">Ferramentas “PDF único”</th>
                </tr>
              </thead>
              <tbody className="text-zinc-300">
                {[
                  ["Memória por processo e cliente", true, false, false],
                  ["RAG multicamada + rerank", true, false, false],
                  ["Editor jurídico + autosave + IA inline", true, false, false],
                  ["Multi-workspace / RBAC-ready", true, false, false],
                  ["Ingestão assíncrona (OCR, chunk, vetor)", true, false, false],
                ].map(([label, lex, chat, pdf]) => (
                  <tr key={String(label)} className="border-b border-white/5">
                    <td className="p-4">{label}</td>
                    <td className="p-4">
                      {lex ? <Check className="size-5 text-emerald-400" /> : "—"}
                    </td>
                    <td className="p-4 text-zinc-600">
                      {chat ? <Check className="size-5 text-zinc-500" /> : "—"}
                    </td>
                    <td className="p-4 text-zinc-600">
                      {pdf ? <Check className="size-5 text-zinc-500" /> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="depoimentos" className="relative z-10 mx-auto max-w-6xl px-6 py-24">
          <h2 className="text-center text-3xl font-semibold tracking-tight">Quem já vive o futuro do escritório</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                q: "Parecia Cursor, mas para processo civil. O chat puxa a contestação antiga e já cita o CPC certo.",
                a: "Dra. Mariana V.",
                r: "Advogada · São Paulo",
              },
              {
                q: "Finalmente deixamos de colar PDF no ChatGPT. O Lex é o único que respeita o meu tom e a linha da defesa.",
                a: "Dr. Ricardo A.",
                r: "Sócio · Belo Horizonte",
              },
              {
                q: "A busca híbrida acha ementa e cláusula contratual no mesmo lugar. Isso é produto, não demo.",
                a: "Dra. Helena M.",
                r: "Coordenadora · Rio de Janeiro",
              },
            ].map((d) => (
              <div
                key={d.a}
                className="rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-6"
              >
                <Scale className="mb-3 size-5 text-violet-400/80" />
                <p className="text-sm leading-relaxed text-zinc-300">&ldquo;{d.q}&rdquo;</p>
                <p className="mt-4 text-sm font-medium text-zinc-100">{d.a}</p>
                <p className="text-xs text-zinc-500">{d.r}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative z-10 mx-auto max-w-3xl px-6 py-24">
          <div className="flex items-center justify-center gap-2 text-center">
            <Shield className="size-5 text-violet-400" />
            <h2 className="text-2xl font-semibold tracking-tight">Perguntas frequentes</h2>
          </div>
          <Accordion type="single" collapsible className="mt-8 w-full">
            {[
              {
                q: "O Lex substitui o advogado?",
                a: "Não. Lex é instrumento de produtividade e fundamentação; a responsabilidade profissional permanece com você.",
              },
              {
                q: "Funciona offline?",
                a: "O núcleo depende de APIs (DeepSeek, DeepInfra) e serviços cloud. Você pode rodar stack local com Docker para desenvolvimento.",
              },
              {
                q: "Meus dados ficam isolados por workspace?",
                a: "Sim. O modelo multi-tenant separa vetores e registros por workspace; corpus global de legislação é compartilhado e somente leitura.",
              },
              {
                q: "Posso levar para meu escritório inteiro depois?",
                a: "A arquitetura já prevê memberships, RBAC e workspaces — evolução natural sem reescrever o produto.",
              },
            ].map((item, i) => (
              <AccordionItem key={item.q} value={`item-${i}`} className="border-white/10">
                <AccordionTrigger className="text-left hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="text-sm text-zinc-400">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section className="relative z-10 mx-auto max-w-6xl px-6 pb-32">
          <div className="rounded-3xl border border-violet-500/30 bg-gradient-to-br from-violet-950/50 to-zinc-950 px-8 py-16 text-center backdrop-blur">
            <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Pronto para o sistema operacional do seu direito?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Onboarding em minutos. Infra pensada para escala. UX que seus clientes sentem na qualidade das peças.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href="/register">
                <Button size="lg" className="gap-2">
                  Começar agora <ArrowRight className="size-4" />
                </Button>
              </Link>
              <Link href="/manifesto">
                <Button size="lg" variant="outline" className="border-white/20 bg-transparent">
                  Ler manifesto
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/10 py-10 text-center text-xs text-zinc-600">
        Lex — copiloto jurídico © {new Date().getFullYear()}
      </footer>
    </div>
  );
}
