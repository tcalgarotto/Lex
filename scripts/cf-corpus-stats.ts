/**
 * Inspeção rápida do corpus canônico após ingest.
 *
 *   npx tsx scripts/cf-corpus-stats.ts
 *
 * Imprime:
 *   - LegalNorm (URN, kind, identifier, hash da versão);
 *   - LegalChunk: contagem total + breakdown por codigo (CF vs ADCT);
 *   - artigos únicos (articleRef) por segmento;
 *   - amostra de chunk (com metadataJson decorada);
 *   - breakdown Qdrant: total por collection + amostra de payload.
 */
import "../src/lib/env-normalize";
import { prisma } from "../src/lib/prisma";

type AnyRecord = Record<string, unknown>;

function readMeta(meta: unknown, key: string): string | undefined {
  if (meta && typeof meta === "object" && meta !== null) {
    const v = (meta as AnyRecord)[key];
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return undefined;
}

async function main(): Promise<void> {
  const norms = await prisma.legalNorm.findMany({
    select: { id: true, urn: true, kind: true, title: true, identifier: true, status: true, sourceProvider: true },
  });
  const versions = await prisma.legalNormVersion.findMany({
    select: { id: true, normId: true, contentHash: true, validFrom: true, validTo: true },
  });
  const totalChunks = await prisma.legalChunk.count();
  const totalCitations = await prisma.legalCitation.count();

  const chunks = await prisma.legalChunk.findMany({
    select: {
      id: true,
      articleRef: true,
      paragraphRef: true,
      incisoRef: true,
      alineaRef: true,
      structure: true,
      fullPath: true,
      metadataJson: true,
      text: true,
    },
  });

  const byCodigo = new Map<string, number>();
  const articlesByCodigo = new Map<string, Set<string>>();
  let withMetadataJson = 0;
  let withSourceProviderMD = 0;
  for (const c of chunks) {
    const codigo = readMeta(c.metadataJson, "codigo") ?? "(?)";
    byCodigo.set(codigo, (byCodigo.get(codigo) ?? 0) + 1);
    if (c.articleRef) {
      const set = articlesByCodigo.get(codigo) ?? new Set<string>();
      set.add(c.articleRef);
      articlesByCodigo.set(codigo, set);
    }
    if (c.metadataJson) withMetadataJson++;
    if (readMeta(c.metadataJson, "sourceProvider") === "MANUAL_MD") withSourceProviderMD++;
  }

  console.log("═══ Postgres ═══");
  console.log("");
  console.log("[LegalNorm]");
  console.table(
    norms.map((n) => ({
      urn: n.urn,
      kind: n.kind,
      identifier: n.identifier,
      sourceProvider: n.sourceProvider,
      status: n.status,
    })),
  );
  console.log("[LegalNormVersion]");
  console.table(
    versions.map((v) => ({
      normId: v.normId,
      validFrom: v.validFrom.toISOString().slice(0, 10),
      validTo: v.validTo?.toISOString().slice(0, 10) ?? "<aberta>",
      contentHash: v.contentHash.slice(0, 12) + "…",
    })),
  );
  console.log("");
  console.log(`[LegalChunk] total=${totalChunks}  withMetadataJson=${withMetadataJson}  sourceProvider=MANUAL_MD: ${withSourceProviderMD}`);
  console.log(
    `[Artigos únicos por codigo]  CF=${(articlesByCodigo.get("CF") ?? new Set()).size}  ADCT=${(articlesByCodigo.get("ADCT") ?? new Set()).size}`,
  );
  console.log("[Chunks por codigo]");
  console.table([...byCodigo.entries()].map(([codigo, count]) => ({ codigo, count })));
  console.log(`[LegalCitation] total=${totalCitations}`);

  console.log("");
  console.log("═══ Qdrant (sample) ═══");
  const url = process.env["QDRANT_URL"];
  const apiKey = process.env["QDRANT_API_KEY"];
  if (!url) {
    console.log("(QDRANT_URL não configurado, pulando)");
  } else {
    const headers: Record<string, string> = {};
    if (apiKey) headers["api-key"] = apiKey;
    for (const col of ["lex_corpus_norms", "lex_corpus_jurisprudence"]) {
      const meta = await fetch(`${url}/collections/${col}`, { headers, cache: "no-store" });
      const j = (await meta.json()) as { result?: { points_count?: number } };
      console.log(`  ${col}: points=${j.result?.points_count ?? 0}`);
    }
    const scroll = await fetch(`${url}/collections/lex_corpus_norms/points/scroll`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 2, with_payload: true, with_vector: false }),
    });
    if (scroll.ok) {
      const sj = (await scroll.json()) as { result?: { points?: Array<{ id: string; payload?: AnyRecord }> } };
      const pts = sj.result?.points ?? [];
      console.log("");
      console.log("[Sample payload (lex_corpus_norms)]");
      for (const p of pts.slice(0, 1)) {
        const pl = p.payload ?? {};
        console.log(`  pointId=${String(p.id).slice(0, 12)}…`);
        for (const k of [
          "normUrn",
          "kind",
          "structure",
          "articleRef",
          "paragraphRef",
          "incisoRef",
          "fullPath",
          "codigo",
          "tipo",
          "tema",
          "hierarchy",
          "sourceProvider",
          "sourcePath",
          "status",
          "normTitle",
          "identifier",
          "segment",
        ]) {
          if (k in pl) console.log(`  ${k.padEnd(16)}= ${String((pl as AnyRecord)[k]).slice(0, 80)}`);
        }
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
