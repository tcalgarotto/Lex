import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LandingBetaSection } from "@/components/marketing/landing-beta-section";
import { LandingBodyProduto } from "@/components/marketing/landing-body-produto";
import { LandingFooter } from "@/components/marketing/landing-footer";
import { LandingHeader } from "@/components/marketing/landing-header";
import { LandingMobileCta } from "@/components/marketing/landing-mobile-cta";
import { LANDING_CONTENT } from "@/lib/marketing/landing-copy";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Recursos",
  description:
    "Jornadas Captação, Caso e Peça do JustOS — capacidades do escritório do primeiro contato à minuta revisada.",
  alternates: { canonical: "/produto" },
};

export default function ProdutoPage() {
  return (
    <>
      <LandingHeader />
      <main className="pb-20 md:pb-0">
        <div className={`${LANDING_CONTENT} scroll-mt-[4.75rem] pb-6 pt-10 md:pb-8 md:pt-14`}>
          <Link
            href="/"
            className="mb-8 inline-flex min-h-11 items-center gap-2 text-caption font-medium text-[color:var(--text-secondary)] hover:text-[color:var(--brand-text)]"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Voltar ao início
          </Link>
          <h1 className="lex-marketing-display text-[color:var(--text-primary)]">
            Recursos em três jornadas
          </h1>
          <p className="lex-marketing-lead mt-4 max-w-2xl text-[color:var(--text-secondary)]">
            Captação, Caso e Peça — como o JustOS acompanha o escritório do primeiro contato à minuta
            revisada. Abaixo, índice completo de capacidades.
          </p>
        </div>
        <LandingBodyProduto />
        <LandingBetaSection />
      </main>
      <LandingMobileCta />
      <LandingFooter />
    </>
  );
}
