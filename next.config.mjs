/** @type {import('next').NextConfig} */

// Origem da API (sem o prefixo /api/v1). Os arquivos emitidos são servidos
// estaticamente pela API em :3333/files/... com X-Frame-Options: SAMEORIGIN, o
// que bloqueia o iframe do FileViewer quando carregado direto (cross-origin).
// Proxiando /files/* pelo Next, o arquivo passa a ser SAME-ORIGIN e renderiza no
// modal. Usa NEXT_PUBLIC_API_ORIGIN quando definido; senão deriva de
// NEXT_PUBLIC_API_URL; fallback para o dev padrão.
const API_ORIGIN =
  process.env.NEXT_PUBLIC_API_ORIGIN ||
  (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v\d+\/?$/, "") ||
  "http://localhost:3333";

const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/files/:path*",
        destination: `${API_ORIGIN}/files/:path*`,
      },
    ];
  },
};

export default nextConfig;
