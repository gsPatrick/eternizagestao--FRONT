import { api } from "@/lib/api/client";
import { getToken } from "@/lib/api/session";

/* ============================================================================
 * Exportações de dados / remessas para órgãos públicos — resource fino sobre a
 * feature `data-exports` da API (src/features/data-exports/data-exports.routes.js).
 *   - GET  /data-exports        → lista paginada (histórico de exportações)
 *   - GET  /data-exports/:id    → detalhe de uma exportação
 *   - POST /data-exports        → solicita uma nova exportação (gera o arquivo)
 * Cada registro (DataExport) carrega { exportType, format, status, fileUrl,
 * periodStart, periodEnd, requestedBy, createdAt }. O arquivo gerado é servido
 * publicamente em /files (estático), então o download usa a URL absoluta do host.
 * ==========================================================================*/

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333/api/v1";
// Origem do host (sem o prefixo /api/v1) para montar a URL pública dos arquivos.
const FILES_ORIGIN = BASE_URL.replace(/\/api\/v\d+\/?$/, "").replace(/\/+$/, "");

/** Lista o histórico de exportações. @returns {Promise<{data, meta}>} */
export function listDataExports(params, opts) {
  return api.get("/data-exports", { params, meta: true, ...opts });
}

/** Detalhe de uma exportação. */
export function getDataExport(id, opts) {
  return api.get(`/data-exports/${id}`, opts);
}

/**
 * Solicita uma nova exportação. A API cria o registro e gera o arquivo
 * (síncrono no fallback sem fila), devolvendo o DataExport já com status final.
 * @param {{ exportType:string, format?:string, periodStart?:string,
 *           periodEnd?:string, cemeteryId?:string, parameters?:object }} body
 */
export function createDataExport(body, opts) {
  return api.post("/data-exports", body, opts);
}

/** URL pública absoluta do arquivo gerado (servido em /files, sem auth). */
export function dataExportFileUrl(dataExport) {
  const u = dataExport?.fileUrl;
  if (!u) return null;
  return /^https?:\/\//.test(u) ? u : `${FILES_ORIGIN}${u}`;
}

/**
 * Baixa o arquivo de uma exportação concluída via Blob, forçando o nome.
 * O arquivo é público (/files estático); mesmo assim mandamos o Bearer se
 * houver, para o caso de o storage passar a exigir auth no futuro.
 * @returns {Promise<true>}
 */
export async function downloadDataExport(dataExport, filename) {
  const url = dataExportFileUrl(dataExport);
  if (!url) throw new Error("Arquivo ainda não disponível para download.");

  const token = getToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Não foi possível baixar o arquivo da exportação.");

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || `${dataExport.exportType}.${dataExport.format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}
