import type { Metadata } from "next";
import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
 title: "Lex — Copiloto jurídico com IA",
 description:
 "Memória persistente, pesquisa jurídica assistida por IA e geração de peças no seu estilo.",
};

const themeInitScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("lex-theme");var r="dark";if(t==="light")r="light";else if(t==="dark")r="dark";else if(t==="auto"&&typeof matchMedia!=="undefined")r=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",r);}catch(e){document.documentElement.setAttribute("data-theme","dark");}})();`;

export default async function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 const nonce = (await headers()).get("x-nonce") ?? undefined;

 return (
 <html
 lang="pt-BR"
 data-theme="dark"
 suppressHydrationWarning
 className={GeistMono.variable}
 >
 <body className="min-h-screen font-sans antialiased">
 {/* Script nativo (não next/script): evita mismatch nonce SSR vs cliente; CSP usa x-nonce do proxy. */}
 <script
 id="lex-theme-init"
 nonce={nonce}
 suppressHydrationWarning
 dangerouslySetInnerHTML={{ __html: themeInitScript }}
 />
 <Providers>{children}</Providers>
 <Toaster richColors position="top-center" />
 <Analytics />
 </body>
 </html>
 );
}
