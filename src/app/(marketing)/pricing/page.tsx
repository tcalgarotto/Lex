"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Solo",
    price: "R$ 197",
    period: "/mês",
    desc: "Advogado único — cerebro completo.",
    features: ["RAG multicamada", "Memória persistente", "Editor IA", "Até 3 workspaces"],
    cta: "Assinar Solo",
    highlight: false,
  },
  {
    name: "Banca",
    price: "R$ 497",
    period: "/mês",
    desc: "Times pequenos — colaboração em breve.",
    features: [
      "Tudo do Solo",
      "Prioridade em embeddings",
      "Auditoria de jobs",
      "Suporte prioritário",
    ],
    cta: "Assinar Banca",
    highlight: true,
  },
  {
    name: "Escritório",
    price: "Custom",
    period: "",
    desc: "RBAC, SSO, VPC — conversamos seu SLA.",
    features: ["Infra dedicada", "Data residency", "Treinamento onboarding", "CSM"],
    cta: "Falar com vendas",
    highlight: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-16 text-zinc-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-semibold tracking-tight"
          >
            Planos que acompanham sua prática
          </motion.h1>
          <p className="mt-3 text-zinc-400">
            Infra preparada para escalar — você começa solo e evolui sem retrabalho.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Card
                className={`h-full border-white/10 bg-zinc-900/50 backdrop-blur ${tier.highlight ? "border-violet-500/40 shadow-lg shadow-violet-500/10" : ""}`}
              >
                <CardHeader>
                  <CardTitle className="text-xl">{tier.name}</CardTitle>
                  <p className="text-sm text-zinc-400">{tier.desc}</p>
                  <div className="pt-4">
                    <span className="text-3xl font-semibold">{tier.price}</span>
                    <span className="text-zinc-500">{tier.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {tier.features.map((f) => (
                    <div key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                      <Check className="mt-0.5 size-4 shrink-0 text-violet-400" />
                      {f}
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Link href="/register" className="w-full">
                    <Button className="w-full" variant={tier.highlight ? "default" : "outline"}>
                      {tier.cta}
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            </motion.div>
          ))}
        </div>
        <p className="mt-12 text-center text-sm text-zinc-500">
          <Link href="/" className="text-violet-400 hover:underline">
            Voltar à página inicial
          </Link>
        </p>
      </div>
    </div>
  );
}
