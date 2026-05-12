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

const PREVIEW_QUALITY = 55;

/**
 * Redimensiona miniatura já gravada (WebP ou PNG) para pré-carregamento nos cards
 * (`?w=` 40–240): payload pequeno; resposta sempre WebP.
 */
export async function encodeThumbnailWebpLowRes(input: Buffer, maxWidth: number): Promise<Buffer> {
  const w = Math.min(240, Math.max(40, Math.trunc(maxWidth)));
  const ultraTiny = w <= 48;
  const tiny = w <= 72;
  const quality = ultraTiny ? 42 : tiny ? 50 : PREVIEW_QUALITY;
  const effort = ultraTiny ? 1 : tiny ? 2 : 3;
  return sharp(input)
    .rotate()
    .resize({
      width: w,
      withoutEnlargement: true,
      fit: "inside",
    })
    .flatten({ background: { r: 255, g: 255, b: 255 } })
    .webp({ quality, effort })
    .toBuffer();
}
