/**
 * URL ABSOLUTA de um arquivo servido pela API (`/files/...`).
 *
 * Por que existe: a API devolve o caminho ASSINADO em formato relativo
 * (`/files/<tenant>/<arquivo>?token=...`). Se esse valor for usado direto num
 * `<img>`/overlay, o navegador resolve contra a origem do FRONT — que não serve
 * esses arquivos — e a imagem simplesmente não carrega (foi o que acontecia com
 * a ortofoto: o overlay era criado, mas a foto nunca aparecia no mapa).
 *
 * Deriva a origem da API a partir de NEXT_PUBLIC_API_URL, removendo o prefixo
 * /api/v1 (os arquivos ficam fora dele).
 */
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333/api/v1")
  .replace(/\/api\/v1\/?$/, "");

export function fileHref(fileUrl) {
  if (!fileUrl) return null;
  // já absoluta (http/https) ou embutida (data:) → devolve intacta
  if (/^(https?:)?\/\//.test(fileUrl) || fileUrl.startsWith("data:")) return fileUrl;
  return `${API_ORIGIN}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
}

export { API_ORIGIN };
