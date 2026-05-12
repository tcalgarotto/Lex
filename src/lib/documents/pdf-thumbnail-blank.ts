import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * Heurística: miniatura quase toda branca (ex.: capa só com bitmaps JP2/JBIG2
 * que o pdf.js + Skia não descodificam no servidor — fica “papel” branco).
 */
export async function isThumbnailMostlyBlankPng(png: ArrayBuffer): Promise<boolean> {
  try {
    const img = await loadImage(Buffer.from(png));
    const sampleW = Math.min(96, img.width);
    const sampleH = Math.min(120, img.height);
    const canvas = createCanvas(sampleW, sampleH);
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, sampleW, sampleH);
    const { data } = ctx.getImageData(0, 0, sampleW, sampleH);
    let nonPaper = 0;
    const pixels = sampleW * sampleH;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] ?? 255;
      if (a < 20) continue;
      const r = data[i] ?? 255;
      const g = data[i + 1] ?? 255;
      const b = data[i + 2] ?? 255;
      if (r < 242 || g < 242 || b < 242) nonPaper++;
    }
    return nonPaper / pixels < 0.008;
  } catch {
    return false;
  }
}
