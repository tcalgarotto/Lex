import { prisma } from "../src/lib/prisma";
import { retrieveContext } from "../src/lib/retrieval/hybrid-retriever";
import { retrieveLegalContext } from "../src/lib/retrieval/legal";

async function benchmark() {
  console.log("🚀 Iniciando Benchmark de Performance Profissional...");

  // Busca um workspace real para o teste
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    console.error("❌ Nenhum workspace encontrado para teste.");
    return;
  }

  const workspaceId = workspace.id;
  const query = "danos morais em atraso de voo";

  console.log(`\n--- Teste 1: Busca Interna (RetrieveContext) ---`);
  const t0 = Date.now();
  const ctxResult = await retrieveContext({
    workspaceId,
    query,
    limit: 10
  });
  const d1 = Date.now() - t0;
  console.log(`✅ Tempo: ${d1}ms`);
  console.log(`📦 Chunks encontrados: ${ctxResult.chunks.length}`);

  console.log(`\n--- Teste 2: Busca Jurídica (RetrieveLegalContext) ---`);
  const t1 = Date.now();
  const legalResult = await retrieveLegalContext(query, {
    workspaceId,
    topK: 8,
    useCache: false // Força processamento real
  });
  const d2 = Date.now() - t1;
  console.log(`✅ Tempo: ${d2}ms`);
  console.log(`📦 Leis/Súmulas encontradas: ${legalResult.chunks.length}`);
  if (legalResult.trace) {
    console.log("🕒 Timings detalhados (ms):", JSON.stringify(legalResult.trace.stages.map(s => ({ [s.stage]: s.latencyMs })), null, 2));
  }

  console.log(`\n--- Teste 3: API Search Global (Simulação) ---`);
  // Simulando o comportamento da rota /api/search
  const t2 = Date.now();
  await Promise.all([
    prisma.process.findMany({ where: { workspaceId, title: { contains: query, mode: "insensitive" } }, take: 5 }),
    prisma.legalPiece.findMany({ where: { workspaceId, title: { contains: query, mode: "insensitive" } }, take: 5 }),
    retrieveLegalContext(query, { workspaceId, topK: 5 })
  ]);
  const d3 = Date.now() - t2;
  console.log(`✅ Tempo Global: ${d3}ms`);

  console.log("\n--- Resumo Final ---");
  console.table({
    "Busca Interna": `${d1}ms`,
    "Busca Jurídica": `${d2}ms`,
    "Busca Global (Paralela)": `${d3}ms`
  });

  if (d2 > 2500) {
    console.warn("⚠️ ALERTA: A busca jurídica está levando mais de 2.5s. Verifique latência de rede com provedores de IA.");
  } else {
    console.log("🌟 PERFORMANCE EXCELENTE: Tempos dentro dos padrões profissionais de mercado.");
  }
}

benchmark().catch(console.error).finally(() => prisma.$disconnect());
