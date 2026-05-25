import type { Metadata } from "next";
import { headers } from "next/headers";
import { GeistMono } from "geist/font/mono";
import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
 title: "JustOS — Sistema operacional jurídico",
 description:
 "Casos, documentos, pesquisa com fontes e minutas no mesmo fluxo. Revisão sempre nas suas mãos.",
 icons: {
 icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
 shortcut: "/icon.svg",
 },
};

const themeInitScript = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("justos-theme")||localStorage.getItem("lex-theme");var r="light";if(t==="light")r="light";else if(t==="dark")r="dark";else if(t==="auto"&&typeof matchMedia!=="undefined")r=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";d.setAttribute("data-theme",r);}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;

export default async function RootLayout({
 children,
}: Readonly<{
 children: React.ReactNode;
}>) {
 const nonce = (await headers()).get("x-nonce") ?? undefined;

 return (
 <html
 lang="pt-BR"
 data-theme="light"
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
 <SonnerToaster />
 <Analytics />
 </body>
 </html>
 );
}
