import { ImageResponse } from "next/og";

export const alt = "Lex — Second Brain Jurídico";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background: "linear-gradient(145deg, #0f0a1a 0%, #1a1030 45%, #0d0d12 100%)",
          color: "#f4f4f5",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            L
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, opacity: 0.9 }}>Lex · Second Brain Jurídico</span>
        </div>
        <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15, maxWidth: 900, letterSpacing: -1 }}>
          Memória, estratégia e IA com fontes para o escritório
        </div>
        <p style={{ marginTop: 28, fontSize: 26, lineHeight: 1.4, opacity: 0.75, maxWidth: 820 }}>
          Casos, documentos, pesquisa jurídica e peças em uma plataforma auditável — alfa comercial.
        </p>
      </div>
    ),
    { ...size },
  );
}
