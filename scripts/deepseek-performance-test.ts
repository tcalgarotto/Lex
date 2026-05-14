import { prisma } from "../src/lib/prisma";
import { retrieveContext } from "../src/lib/retrieval/hybrid-retriever";
import { getLegalResearchProvider } from "../src/lib/legal-research";

async function benchmark() {
  console.log("🚀 Iniciando benchmark pós-transição (DeepSeek + índices locais)...");

  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("❌ Nenhum workspace encontrado para teste.");
    return;
  }

  const workspaceId = workspace.id;
  const query = "danos morais em atraso de voo";

  console.log(`\n--- Teste 1: Busca Interna Otimizada (GIN Indexes) ---`);
  const t0 = Date.now();
  const ctxResult = await retrieveContext({
    workspaceId,
    query,
    limit: 10
  });
  const d1 = Date.now() - t0;
  console.log(`✅ Tempo: ${d1}ms`);
  console.log(`📦 Chunks encontrados (DB only): ${ctxResult.chunks.length}`);

  console.log(`\n--- Teste 2: Pesquisa Jurídica via DeepSeek API ---`);
  const provider = getLegalResearchProvider();
  console.log(`🔌 Provedor ativo: ${process.env["LEGAL_RESEARCH_PROVIDER"] || "deepseek"}`);
  
  const t1 = Date.now();
  try {
    const legalResult = await provider.search({
      workspaceId,
      query,
      maxResults: 8,
      resultTypes: ["LAW", "JURISPRUDENCE"],
      language: "pt-BR",
    });
    const d2 = Date.now() - t1;
    console.log(`✅ Tempo API DeepSeek: ${d2}ms`);
    console.log(`📦 Fundamentos encontrados: ${legalResult.legalFoundations.length}`);
    console.log(`📦 Jurisprudências encontradas: ${legalResult.jurisprudenceCandidates.length}`);
  } catch (e) {
    console.error("❌ Erro na chamada DeepSeek:", String(e));
  }

  console.log("\n--- Resumo de Performance ---");
  console.table({
    "Busca DB (Índices GIN)": `${d1}ms`,
    "DeepSeek API Latency": `Ver acima`,
  });

  console.log("\n🌟 CONCLUSÃO: latência local nos índices do Postgres e síntese jurídica via DeepSeek na pesquisa assistida.");
}

benchmark().catch(console.error).finally(() => prisma.$disconnect());
