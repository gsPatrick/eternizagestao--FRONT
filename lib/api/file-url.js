/**
 * URL ABSOLUTA de um arquivo servido pela API (`/files/...`).
 *
 * Por que existe: a API devolve o caminho ASSINADO em formato relativo
 * (`/files/<tenant>/<arquivo>?token=...`). Se esse valor for usado direto num
 * `<img>`/overlay, o navegador resolve contra a origem do FRONT — que não serve
 * esses arquivos — e a imagem simplesmente não carrega (foi o que acontecia com
 * a ortofoto: o overlay era criado, mas a foto nunca aparecia no mapa).
 *
 * A origem vem do client.js — a MESMA usada nas chamadas de API. Este arquivo já
 * teve a sua própria resolução e o fallback divergia (localhost), então em
 * produção, sem NEXT_PUBLIC_API_URL no build, a API respondia normalmente e só
 * a ortofoto ficava invisível. Nunca mais duplicar essa lógica aqui.
 */
import { API_ORIGIN } from "./client";

export function fileHref(fileUrl) {
  if (!fileUrl) return null;
  // já absoluta (http/https) ou embutida (data:) → devolve intacta
  if (/^(https?:)?\/\//.test(fileUrl) || fileUrl.startsWith("data:")) return fileUrl;
  return `${API_ORIGIN}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
}

export { API_ORIGIN };
