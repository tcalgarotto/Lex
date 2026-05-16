import Link from "next/link";
import { LANDING_BAR_INNER, LANDING_CONTENT, LANDING_SHELL_FULL } from "@/lib/marketing/landing-copy";

const FOOTER_COLUMNS = [
  {
    title: "Produto",
    links: [
      { href: "#inicio", label: "Início" },
      { href: "#recursos", label: "Recursos" },
      { href: "#como-funciona", label: "Como funciona" },
      { href: "/pricing", label: "Preços" },
    ],
  },
  {
    title: "Recursos",
    links: [
      { href: "#seguranca", label: "Segurança" },
      { href: "#para-escritorios", label: "Para escritórios" },
      { href: "/manifesto", label: "Manifesto" },
      { href: "/register", label: "Criar conta" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "#beta", label: "Solicitar acesso" },
      { href: "/login", label: "Entrar" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/termos", label: "Termos de Uso" },
      { href: "/privacidade", label: "Privacidade" },
    ],
  },
] as const;

export function LandingFooter() {
  return (
    <footer className={`lex-marketing-footer ${LANDING_SHELL_FULL} mt-4 border-t border-[color:var(--border-subtle)]`}>
      <div className={`${LANDING_BAR_INNER} py-12 md:py-14`}>
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-12 md:gap-8">
          <div className="md:col-span-4">
            <div className="flex items-center gap-2.5">
              <span
                className="flex size-9 items-center justify-center rounded-lg text-sm font-semibold text-[color:var(--text-inverse)]"
                style={{ background: "var(--brand-primary)", boxShadow: "var(--shadow-violet)" }}
              >
                L
              </span>
              <span className="text-lg font-semibold text-[color:var(--text-primary)]">Lex</span>
            </div>
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
              Plataforma jurídica inteligente para organizar casos, documentos, fundamentos e minutas com
              mais controle.
            </p>
          </div>
          {FOOTER_COLUMNS.map((col) => (
            <div key={col.title} className="md:col-span-2">
              <p className="text-caption font-semibold uppercase tracking-widest text-[color:var(--text-muted)]">
                {col.title}
              </p>
              <ul className="mt-4 space-y-2.5 text-[14px]">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {link.href.startsWith("#") ? (
                      <a
                        href={link.href}
                        className="text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full border-t border-[color:var(--border-subtle)]">
        <div className={`${LANDING_CONTENT} py-6`}>
          <p className="mx-auto max-w-2xl text-center text-caption leading-relaxed text-[color:var(--text-muted)]">
            O Lex é uma ferramenta de apoio à atividade jurídica. Toda minuta e orientação deve ser
            revisada por profissional habilitado.
          </p>
          <p className="mt-4 text-center text-caption text-[color:var(--text-muted)]">
            Lex © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
