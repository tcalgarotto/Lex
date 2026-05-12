import Link from "next/link";

export default function ManifestoPage() {
 return (
 <div className="mx-auto max-w-3xl px-6 py-16 text-[color:var(--text-primary)]">
 <h1 className="text-3xl font-semibold tracking-tight">Manifesto Lex</h1>
 <p className="mt-6 leading-relaxed text-[color:var(--text-secondary)]">
 Lex não é um chat genérico com PDF. É um sistema operacional jurídico: memória de caso,
 recuperação híbrida (semântica + lexical), reranking, fundamentação com fontes e geração no
 seu estilo — com arquitetura multi-tenant desde o primeiro deploy.
 </p>
 <Link href="/" className="mt-8 inline-block text-violet-400 hover:underline">
 ← Início
 </Link>
 </div>
 );
}
