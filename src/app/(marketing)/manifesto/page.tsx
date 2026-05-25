import { LegalDocPage } from "@/components/marketing/legal-doc-page";

export default function ManifestoPage() {
  return (
    <LegalDocPage title="Manifesto JustOS" updatedLabel="JustOS">
      <p className="lex-marketing-body text-[color:var(--text-secondary)]">
        O JustOS não é um chat genérico com PDF. É o sistema operacional do escritório: memória de
        caso, pesquisa com fontes, minutas conectadas ao que está aberto e revisão sempre nas suas
        mãos.
      </p>
      <p className="lex-marketing-body mt-4 text-[color:var(--text-secondary)]">
        Construímos para advogados autônomos e equipes que precisam de disciplina no fluxo — do
        primeiro contato à peça protocolada — sem prometer substituir o profissional habilitado.
      </p>
      <p className="lex-marketing-body mt-4 text-[color:var(--text-secondary)]">
        Transparência, controle e clareza guiam cada decisão de produto até termos de parceiros e
        histórias de escritório que possamos citar com permissão.
      </p>
    </LegalDocPage>
  );
}
