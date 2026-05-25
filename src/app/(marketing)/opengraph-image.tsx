import { ImageResponse } from "next/og";

export const alt = "JustOS — Sistema operacional do escritório";
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
          background: "#0d0d12",
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
              background: "#5b21b6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: -0.5,
            }}
          >
            J
          </div>
          <span style={{ fontSize: 28, fontWeight: 600, opacity: 0.9 }}>JustOS</span>
        </div>
        <div style={{ fontSize: 52, fontWeight: 600, lineHeight: 1.15, maxWidth: 900, letterSpacing: -1 }}>
          Casos, fundamentos e minutas no mesmo fluxo
        </div>
        <p style={{ marginTop: 28, fontSize: 26, lineHeight: 1.4, opacity: 0.75, maxWidth: 820 }}>
          Pesquisa com fontes e revisão profissional antes do protocolo. Solicite acesso.
        </p>
      </div>
    ),
    { ...size },
  );
}
