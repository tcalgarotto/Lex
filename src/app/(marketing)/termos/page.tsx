import type { Metadata } from "next";
import { LegalDocPage } from "@/components/marketing/legal-doc-page";

export const metadata: Metadata = {
  title: "Termos de Uso — Lex",
  description: "Condições de uso da plataforma Lex para escritórios e profissionais do Direito.",
};

export default function TermosPage() {
  return (
    <LegalDocPage title="Termos de Uso" updatedLabel="Versão preliminar · alfa comercial">
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">1. O que é o Lex</h2>
        <p>
          O Lex é uma plataforma de apoio à atividade jurídica que ajuda escritórios e profissionais a
          organizar casos, documentos, pesquisa e produção de peças com ferramentas de inteligência
          artificial assistida. O serviço está em fase alfa/beta; funcionalidades podem mudar.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">2. Uso profissional</h2>
        <p>
          O Lex não substitui o exercício da advocacia nem a análise de um profissional habilitado. Todo
          conteúdo gerado ou sugerido deve ser revisado antes de uso perante clientes, terceiros ou
          tribunais. Você permanece responsável pelas peças, pareceres e decisões tomadas com base no
          sistema.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">3. Conta e acesso</h2>
        <p>
          O acesso pode exigir convite ou aprovação no beta privado. Credenciais são pessoais e
          intransferíveis. É vedado tentar acessar dados de outros workspaces ou contornar controles de
          segurança.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">4. Conteúdo e dados</h2>
        <p>
          Você mantém a titularidade dos documentos e informações que enviar. Concede licença limitada para
          que o Lex processe esse conteúdo com a finalidade de prestar o serviço (indexação, busca,
          sugestões). Não envie dados sem base legal adequada, em especial dados sensíveis sem necessidade.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">5. Disponibilidade</h2>
        <p>
          Em alfa, o serviço pode sofrer interrupções, limites de armazenamento e alterações de módulos.
          Integrações com tribunais e diários dependem de acessos oficiais autorizados pelo próprio
          escritório — o Lex não garante cobertura universal nem resultados processuais.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">6. Evolução destes termos</h2>
        <p>
          Estes termos são uma versão inicial para o período de alfa. Uma versão definitiva será
          publicada antes da disponibilização comercial ampla. O uso continuado após atualizações
          materiais implica ciência das mudanças.
        </p>
      </section>
      <p className="rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--surface-overlay)] p-4 text-[13px] text-[color:var(--text-muted)]">
        Dúvidas: utilize o formulário de contato na página inicial ou o canal indicado no convite de beta.
      </p>
    </LegalDocPage>
  );
}
