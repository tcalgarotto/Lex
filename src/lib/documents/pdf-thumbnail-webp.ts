import sharp from "sharp";

/** Largura máxima nos cards (Documentos / Biblioteca); não amplia originais pequenos. */
const THUMB_MAX_WIDTH = 480;

/** Qualidade WebP (70–80). */
const THUMB_WEBP_QUALITY = 75;

/**
 * Converte PNG (primeira página / pipeline Poppler+canvas) em WebP otimizado:
 * redimensiona até `THUMB_MAX_WIDTH`, fundo branco (alpha), `quality` ~75.
 */
export async function encodeDocumentThumbnailWebpFromPng(png: Buffer): Promise<Buffer> {
  return sharp(png)
    .rotate()
    .resize({
      width: THUMB_MAX_WIDTH,
      withoutEnlargement: true,
      fit: "inside",
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality: THUMB_WEBP_QUALITY, effort: 4 })
    .toBuffer();
}
