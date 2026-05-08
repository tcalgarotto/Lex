import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Para builds em containers/docker — produz output standalone com server.js mínimo.
  output: "standalone",
  // Pacotes que devem ficar fora do bundle do Next em rotas server-side.
  // Eles têm assets/workers/wasm que o tracer não consegue empacotar
  // corretamente em serverless. Mantê-los como require() em runtime
  // evita o erro `Cannot find module '/var/task/.../pdf.worker.mjs'`
  // visto na função /api/inngest.
  serverExternalPackages: [
    "unpdf",
    "pdfjs-dist",
    "mammoth",
    "tesseract.js",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
  async headers() {
    // Os headers de segurança principais são aplicados no middleware (cobre TODAS as rotas).
    // Aqui mantemos apenas garantias estáticas para assets e responses fora do matcher.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
