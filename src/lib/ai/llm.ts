import { generateText } from "ai";
import { getChatLanguageModel } from "@/lib/ai/providers/factory";

export { getChatLanguageModel, getPieceLanguageModel, getChatModelId, getPieceModelId, getChatProviderId } from "@/lib/ai/providers/factory";

export async function expandQuery(userQuery: string): Promise<string> {
  const { text } = await generateText({
    model: getChatLanguageModel(),
    maxOutputTokens: 120,
    temperature: 0.2,
    prompt: `Reescreva a pergunta abaixo em 1-2 frases curtas otimizadas para busca jurídica brasileira (termos processuais, legislação). Não invente fatos.\n\nPergunta: ${userQuery}`,
  });
  return text.trim() || userQuery;
}
