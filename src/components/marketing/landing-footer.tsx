import Link from "next/link";
import { JustOSLogo } from "@/components/brand/justos-logo";
import { PRODUCT_LEGAL_DISCLAIMER, PRODUCT_NAME } from "@/lib/brand/justos";
import { LANDING_BAR_INNER, LANDING_SHELL_FULL } from "@/lib/marketing/landing-copy";

const FOOTER_COLUMNS = [
  {
    title: "Produto",
    links: [
      { href: "/#inicio", label: "Início" },
      { href: "/produto", label: "Recursos" },
      { href: "/#pilares", label: "Pilares" },
      { href: "/#como-funciona", label: "Como funciona" },
      { href: "/pricing", label: "Preços" },
    ],
  },
  {
    title: "Institucional",
    links: [
      { href: "/#seguranca", label: "Segurança" },
      { href: "/manifesto", label: "Manifesto" },
      { href: "/register", label: "Criar conta" },
    ],
  },
  {
    title: "Empresa",
    links: [
      { href: "/#beta", label: "Solicitar acesso" },
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
            <JustOSLogo href="/#inicio" markTone="neutral" />
            <p className="mt-4 max-w-sm text-[14px] leading-relaxed text-[color:var(--text-secondary)]">
              Casos, documentos, pesquisa com fontes e minutas no fluxo do escritório — com revisão
              profissional no centro.
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
                    <Link
                      href={link.href}
                      className="text-[color:var(--text-secondary)] transition-colors hover:text-[color:var(--text-primary)]"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="w-full border-t border-[color:var(--border-subtle)]">
        <div className={`${LANDING_BAR_INNER} py-6`}>
          <p className="landing-footer-disclaimer mx-auto max-w-prose text-center text-caption leading-relaxed text-[color:var(--text-muted)]">
            {PRODUCT_LEGAL_DISCLAIMER}
          </p>
          <p className="mt-4 text-center text-caption text-[color:var(--text-muted)]">
            {PRODUCT_NAME} © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </footer>
  );
}
