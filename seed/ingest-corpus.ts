/**
 * Indexa todas as linhas de LegalSource no Qdrant.
 * Uso: carregue .env e execute `npx tsx seed/ingest-corpus.ts`
 */
import { indexLegalSourcesToQdrant } from "../src/lib/services/corpus-index";

async function main() {
  const n = await indexLegalSourcesToQdrant();
  console.log("Fontes indexadas:", n);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
