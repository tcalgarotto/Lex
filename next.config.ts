import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habilita compressão Gzip/Brotli (padrão em Vercel, mas bom ser explícito)
  compress: true,

  /** Alinha com `webpack.resolve.alias.canvas = false` em modo `--turbopack`. */
  turbopack: {
    resolveAlias: {
      canvas: path.join(process.cwd(), "src/lib/stubs/canvas-stub.mjs"),
    },
  },
  // Para builds em containers/docker — produz output standalone com server.js mínimo.
  output: "standalone",
  
  // Otimização de pacotes: evita bundling de deps pesadas que rodam melhor via require()
  serverExternalPackages: [
    "unpdf",
    "pdfjs-dist",
    "mammoth",
    "tesseract.js",
    "@napi-rs/canvas",
    "shiki",
  ],
  
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    // Otimização de bundle para pacotes comuns
    optimizePackageImports: [
      "lucide-react",
      "date-fns",
      "@radix-ui/react-icons",
      "recharts",
    ],
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      // Cache agressivo para fontes e assets estáticos (imutáveis)
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
