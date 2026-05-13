import type { Metadata } from "next";
import Script from "next/script";
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

export default function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 return (
 <html
 lang="pt-BR"
 data-theme="dark"
 suppressHydrationWarning
 className={GeistMono.variable}
 >
 <body className="min-h-screen font-sans antialiased">
 <Script id="lex-theme-init" strategy="beforeInteractive">
 {themeInitScript}
 </Script>
 <Providers>{children}</Providers>
 <Toaster richColors position="top-center" />
 <Analytics />
 </body>
 </html>
 );
}
