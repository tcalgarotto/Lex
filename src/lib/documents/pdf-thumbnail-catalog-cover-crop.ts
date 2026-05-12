import { DocumentLibraryShelf } from "@prisma/client";
import { createCanvas, loadImage } from "@napi-rs/canvas";

/** Largura/altura acima disto ⇒ provável prancha (duas “faces” na mesma miniatura). */
const WIDE_ASPECT_MIN = 1.14;

/** Fração da largura total a manter a partir do lado escolhido (capa típica ~30–45% da prancha). */
const DEFAULT_KEEP_FRAC = 0.44;

function coverSideFromEnv(): "left" | "right" {
  const v = process.env["LEX_THUMBNAIL_CATALOG_COVER_SIDE"]?.trim().toLowerCase();
  if (v === "left") return "left";
  return "right";
}

function keepFractionFromEnv(): number {
  const raw = process.env["LEX_THUMBNAIL_CATALOG_KEEP_SIDE_FRAC"]?.trim();
  if (!raw) return DEFAULT_KEEP_FRAC;
  const n = Number.parseFloat(raw.replace(",", "."));
  if (Number.isFinite(n) && n >= 0.22 && n <= 0.9) return n;
  return DEFAULT_KEEP_FRAC;
}

/**
 * Catálogo da biblioteca (`SHARED_*`): em pranchas muito largas, recorta uma faixa onde está
 * só a **capa** — o PDF pode vir com verso à esquerda e frente à direita (ex.: Vade) ou o
 * contrário; por omissão usamos o **lado direito** (`LEX_THUMBNAIL_CATALOG_COVER_SIDE=left` para o outro).
 *
 * `LEX_THUMBNAIL_CATALOG_COVER_CROP=0` desliga. `LEX_THUMBNAIL_CATALOG_KEEP_SIDE_FRAC` ajusta a largura
 * da faixa (ex.: `0.4`). `OFFICE_PRIVATE` não é alterado.
 */
export async function maybeCropWideCatalogCoverPng(
  png: Buffer,
  shelf: DocumentLibraryShelf,
): Promise<Buffer> {
  if (process.env["LEX_THUMBNAIL_CATALOG_COVER_CROP"] === "0") return png;
  if (shelf !== DocumentLibraryShelf.SHARED_LEGAL && shelf !== DocumentLibraryShelf.SHARED_BOOKS) {
    return png;
  }

  let img;
  try {
    img = await loadImage(png);
  } catch {
    return png;
  }

  const w = img.width;
  const h = img.height;
  if (w < 80 || h < 80) return png;
  if (w / h < WIDE_ASPECT_MIN) return png;

  const frac = keepFractionFromEnv();
  const sw = Math.max(64, Math.floor(w * frac));
  const side = coverSideFromEnv();
  const sx = side === "right" ? w - sw : 0;

  const canvas = createCanvas(sw, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) return png;
  ctx.drawImage(img, sx, 0, sw, h, 0, 0, sw, h);
  return canvas.toBuffer("image/png");
}
