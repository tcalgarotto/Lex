import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Para builds em containers/docker — produz output standalone com server.js mínimo.
  output: "standalone",
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
