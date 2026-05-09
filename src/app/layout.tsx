import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const mono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lex — Copiloto jurídico com IA",
  description:
    "Memória persistente, RAG jurídico multicamada e geração de peças no seu estilo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className={`${inter.variable} ${mono.variable} min-h-screen font-sans antialiased`}>
        <Providers>{children}</Providers>
        <Toaster richColors theme="dark" position="top-center" />
        <Analytics />
      </body>
    </html>
  );
}
