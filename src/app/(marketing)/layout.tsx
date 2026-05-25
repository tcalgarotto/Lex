import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getPublicAppUrl } from "@/lib/marketing/app-url";

const appUrl = getPublicAppUrl();

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "JustOS — Sistema operacional jurídico",
    template: "%s · JustOS",
  },
  description:
    "Casos, documentos, pesquisa com fontes e minutas no mesmo fluxo. Revisão sempre nas suas mãos. Solicite acesso ao JustOS.",
  keywords: [
    "JustOS",
    "software jurídico",
    "gestão de casos",
    "pesquisa jurídica",
    "escritório de advocacia",
    "minutas advocatícias",
  ],
  openGraph: {
    title: "JustOS — Sistema operacional do escritório",
    description:
      "Centralize caso, fundamento e minuta. Pesquisa com fontes e revisão profissional antes do protocolo.",
    type: "website",
    locale: "pt_BR",
    siteName: "JustOS",
    url: appUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "JustOS — Sistema operacional do escritório",
    description:
      "Casos, fundamentos e minutas conectados. Solicite acesso ao JustOS.",
  },
  robots: { index: true, follow: true },
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="lex-marketing-page relative min-h-screen lex-hero-gradient">
      {/* Mesh desligado na marketing (Fase 3 quieter) — ver .lex-marketing-page em globals.css */}
      <div className="relative isolate z-10">{children}</div>
    </div>
  );
}
