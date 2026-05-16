import type { Metadata } from "next";
import { LegalDocPage } from "@/components/marketing/legal-doc-page";

export const metadata: Metadata = {
  title: "Política de Privacidade — Lex",
  description: "Como o Lex trata dados pessoais e informações de escritórios na fase alfa.",
};

export default function PrivacidadePage() {
  return (
    <LegalDocPage title="Política de Privacidade" updatedLabel="Versão preliminar · alfa comercial">
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">1. Quem somos</h2>
        <p>
          O Lex (Second Brain Jurídico) é operado para escritórios e profissionais do Direito no Brasil.
          Esta política descreve, de forma objetiva, como tratamos dados na fase alfa — sem substituir
          assessoria jurídica específica nem afirmar certificações que ainda não possuímos.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">2. Dados que coletamos</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Dados de cadastro e convite (nome, e-mail, escritório).</li>
          <li>
            Solicitações de beta e demonstração pela landing (nome, e-mail profissional, escritório, cargo,
            tamanho do time, desafio opcional, intenção beta ou demo, parâmetros UTM de campanha quando
            presentes na URL e referrer do navegador, somente com seu consentimento explícito).
          </li>
          <li>Documentos, casos e conteúdos que você ou sua equipe carregam na plataforma.</li>
          <li>
            Registros técnicos mínimos (data de envio, hash de IP para anti-abuso — não exibimos o IP em
            telas comerciais).
          </li>
        </ul>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">
          2.1. Leads beta e contato comercial
        </h2>
        <p>
          Ao enviar o formulário da landing, você autoriza contato da equipe Lex sobre o beta privado ou
          demonstrações. Usamos esses dados apenas para triagem comercial e operação do programa beta, não
          para venda a terceiros. Você pode revogar o consentimento para novas comunicações a qualquer momento
          respondendo ao e-mail de contato ou solicitando exclusão quando aplicável.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">3. Finalidades</h2>
        <p>
          Utilizamos os dados para operar o serviço, responder solicitações comerciais do beta, melhorar
          segurança, cumprir obrigações legais aplicáveis e evoluir funcionalidades com base em uso
          agregado sempre que possível.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">4. Compartilhamento</h2>
        <p>
          Não vendemos dados pessoais. Podemos usar provedores de infraestrutura (hospedagem, banco de
          dados, autenticação, modelos de IA contratados) estritamente para prestar o serviço, sob
          contratos e controles compatíveis com a natureza sensível do material jurídico.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">5. Segurança e retenção</h2>
        <p>
          Adotamos isolamento por workspace, controles de acesso e boas práticas de engenharia. Na alfa,
          políticas formais de retenção e eliminação estão em consolidação — você pode solicitar
          esclarecimentos pelo canal de contato do beta.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">6. Seus direitos</h2>
        <p>
          Nos termos da LGPD, você pode solicitar confirmação de tratamento, acesso, correção,
          anonimização, portabilidade ou eliminação quando aplicável, além de revogar consentimentos
          dados para comunicações comerciais.
        </p>
      </section>
      <section>
        <h2 className="text-lg font-semibold text-[color:var(--text-primary)]">7. Atualizações</h2>
        <p>
          Esta política será revisada antes de lançamentos comerciais amplos. Alterações relevantes serão
          comunicadas por e-mail ou aviso na plataforma.
        </p>
      </section>
    </LegalDocPage>
  );
}
