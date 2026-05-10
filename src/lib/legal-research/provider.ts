/**
 * P0 — DeepSeek Legal Research Mode (modo temporário).
 * Sign-off provisório F-1; dupla revisão Thales (PO) + Cursor (CTO interim).
 * Owners de Legal/Security/QA Lead ainda PROVISÓRIOS — release público bloqueado.
 * Ver: docs/decisions/ADR_DEEPSEEK_LEGAL_RESEARCH_MODE.md
 */

import { DeepSeekLegalResearchProvider } from "./deepseek-provider";
import { applyLegalResearchSafety } from "./legal-research-safety";
import type { LegalResearchProvider, LegalResearchRequest, LegalResearchResponse } from "./types";

export const RAG_LEGAL_RESEARCH_STUB_MESSAGE =
  "Pesquisa interna em otimização — usando assistente de IA temporariamente.";

class RagStubLegalResearchProvider implements LegalResearchProvider {
  async search(_req: LegalResearchRequest): Promise<LegalResearchResponse> {
    throw new Error(RAG_LEGAL_RESEARCH_STUB_MESSAGE);
  }

  async recommendForCase(_req: LegalResearchRequest): Promise<LegalResearchResponse> {
    throw new Error(RAG_LEGAL_RESEARCH_STUB_MESSAGE);
  }
}

class MockLegalResearchProvider implements LegalResearchProvider {
  private mockResponse(): LegalResearchResponse {
    return {
      summary:
        "Resposta sintética para testes automatizados — não representa parecer jurídico.",
      suggestedSearches: ["rescisão contratual", "CDC artigo 6"],
      legalFoundations: [
        {
          id: "mock-lf-1",
          type: "LAW",
          title: "Exemplo — Código Civil (art. 421)",
          citation: "Lei nº 10.406/2002, art. 421",
          article: "421",
          excerpt:
            "Os contratantes são obrigados a guardar, assim na conclusão do contrato, como em sua execução, os princípios de probidade e boa-fé.",
          legalIssue: "Boa-fé objetiva nas relações contratuais.",
          whyRelevant: "Ilustra o tipo de estrutura retornada pelo mock.",
          suggestedUse: "Treinamento de UI e testes de integração.",
          confidence: 0.2,
          verificationStatus: "AI_RECOMMENDED_UNVERIFIED",
          warnings: ["Dado fictício — não usar em produção."],
        },
      ],
      jurisprudenceCandidates: [
        {
          id: "mock-ju-1",
          court: "TJSP",
          classOrType: "Apelação Cível",
          processNumber: "0000000-00.0000.0.00.0000",
          title: "Exemplo de título de decisão (mock)",
          summary: "Resumo sintético.",
          holding: "Tese de exemplo.",
          excerpt: "Trecho de exemplo.",
          legalIssue: "Ilustrativo.",
          whyRelevant: "Ilustrativo.",
          suggestedUse: "Testes.",
          confidence: 0.2,
          verificationStatus: "AI_RECOMMENDED_UNVERIFIED",
          warnings: ["Decisão fictícia para testes."],
        },
      ],
      strategyNotes: [
        {
          thesis: "Tese de exemplo para testes.",
          factualRequirements: ["Fato A", "Fato B"],
          evidenceNeeded: ["Documento X"],
          risk: "Risco ilustrativo.",
          recommendedAction: "Ação ilustrativa.",
          relatedFoundations: ["mock-lf-1"],
          relatedJurisprudence: ["mock-ju-1"],
        },
      ],
      draftingSuggestions: ["Sugestão de redação ilustrativa (mock)."],
      riskFlags: ["Modo mock ativo — sem chamada externa."],
      missingInformation: [],
      providerMetadata: {
        provider: "mock",
        promptVersion: "mock",
        timestamp: new Date().toISOString(),
      },
    };
  }

  async search(_req: LegalResearchRequest): Promise<LegalResearchResponse> {
    return applyLegalResearchSafety(this.mockResponse());
  }

  async recommendForCase(_req: LegalResearchRequest): Promise<LegalResearchResponse> {
    return applyLegalResearchSafety(this.mockResponse());
  }
}

/**
 * Fábrica do provedor de pesquisa jurídica.
 * `LEGAL_RESEARCH_PROVIDER`: `deepseek` (default) | `rag` | `mock`
 */
export function getLegalResearchProvider(): LegalResearchProvider {
  const raw = process.env["LEGAL_RESEARCH_PROVIDER"]?.trim().toLowerCase();
  const id = raw && raw.length > 0 ? raw : "deepseek";
  if (id === "rag") {
    return new RagStubLegalResearchProvider();
  }
  if (id === "mock") {
    return new MockLegalResearchProvider();
  }
  return new DeepSeekLegalResearchProvider();
}
