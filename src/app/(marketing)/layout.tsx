import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicAppUrl } from "@/lib/marketing/app-url";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Lex — Plataforma jurídica inteligente",
    template: "%s · Lex",
  },
  description:
    "Organize casos, analise documentos, pesquise fundamentos e produza minutas com mais velocidade e controle. Solicite acesso ao Lex.",
  keywords: [
    "software jurídico",
    "IA para advogados",
    "gestão de casos",
    "pesquisa jurídica",
    "geração de peças",
    "escritório de advocacia",
  ],
  openGraph: {
    title: "Lex — Plataforma jurídica inteligente",
    description:
      "Organize casos, documentos e fundamentos. Produza minutas conectadas ao caso, com pesquisa com fontes e revisão profissional.",
    type: "website",
    locale: "pt_BR",
    siteName: "Lex",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "Lex — Plataforma jurídica inteligente",
    description:
      "Pesquisa com fontes, casos organizados e minutas conectadas ao caso. Solicite acesso.",
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lex-marketing-page relative min-h-screen overflow-x-hidden lex-hero-gradient">
      <div className="lex-glass-mesh pointer-events-none fixed inset-0 z-0" aria-hidden>
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--a" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--b" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--c" />
        <span className="lex-glass-mesh__blob lex-glass-mesh__blob--d" />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
