import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { encodeDocumentThumbnailWebpFromPng } from "./pdf-thumbnail-webp";

describe("encodeDocumentThumbnailWebpFromPng", () => {
  it("produz image/webp com largura máxima 480px a partir de PNG largo", async () => {
    const png = await sharp({
      create: {
        width: 900,
        height: 700,
        channels: 3,
        background: { r: 55, g: 80, b: 140 },
      },
    })
      .png({ compressionLevel: 6 })
      .toBuffer();

    const webp = await encodeDocumentThumbnailWebpFromPng(png);
    expect(webp.length).toBeGreaterThan(40);
    const meta = await sharp(webp).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBeLessThanOrEqual(480);
    expect(meta.height).toBeLessThanOrEqual(480);
  });
});
