import { api } from "@/lib/api/client";
import { API_URL } from "@/lib/api/client";
import { getToken } from "@/lib/api/session";

/* ============================================================================
 * Relatórios gerenciais — resource fino sobre a feature `reports` da API
 * (src/features/reports/reports.routes.js). Cada relatório aceita os mesmos
 * params: { from, to, cemeteryId } (+ scheduleType, fixo por relatório) e
 * exporta em format=csv. A API devolve sempre um array plano de objetos em
 * `data` (envelope { success, data, meta? }); alguns trazem `meta` (ex.: total
 * de arrecadação). Por isso todas as leituras usam meta:true e retornam
 * { data, meta }, mantendo o contrato do useResource uniforme.
 * FRONT manda: os ids abaixo são os do catálogo da página de Relatórios.
 * ==========================================================================*/

// Base única do client.js: em produção o fallback local gerava link quebrado.
const BASE_URL = API_URL;

// id do catálogo (front) → endpoint real da API
const ENDPOINTS = {
  ocupacao: "/reports/occupancy",
  sepultamentos: "/reports/burials",
  exumacoes: "/reports/exhumations",
  velorios: "/reports/schedules",
  arrecadacao: "/reports/revenue",
  inadimplencia: "/reports/delinquency",
  cobrancas: "/reports/billings-summary",
  concessoes: "/reports/expiring-concessions",
  sepultados: "/reports/deceased-by-location",
  transferencias: "/reports/transfers",
};

// params fixos por relatório (a agenda de velórios filtra o tipo)
const FIXED_PARAMS = {
  velorios: { scheduleType: "velorio" },
};

/** Endpoint real de um relatório do catálogo (ou undefined se desconhecido). */
export function reportEndpoint(id) {
  return ENDPOINTS[id];
}

/**
 * Busca as linhas de um relatório.
 * @param {string} id  id do catálogo (ex.: 'ocupacao')
 * @param {{ from?:string, to?:string, cemeteryId?:string }} [params]
 * @returns {Promise<{ data: object[], meta: object|null }>}
 */
export function getReport(id, params, opts) {
  const path = ENDPOINTS[id];
  if (!path) throw new Error(`Relatório desconhecido: ${id}`);
  return api.get(path, {
    params: { ...FIXED_PARAMS[id], ...params },
    meta: true,
    ...opts,
  });
}

function buildQuery(params) {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params || {})) {
    if (value === undefined || value === null || value === "") continue;
    usp.append(key, value);
  }
  return usp.toString();
}

// Formatos servidos pela API de relatórios (rota genérica, ver reports.controller.js).
// json fica de fora aqui: download de arquivo é sempre csv/xlsx/pdf.
export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"];

/**
 * Exporta um relatório no formato pedido e dispara o download no navegador.
 * As rotas csv/xlsx/pdf devolvem o arquivo cru (fora do envelope JSON): csv em
 * text/csv, xlsx/pdf em binário. Por isso usamos fetch direto com o Bearer da
 * sessão (o client.apiFetch só entende JSON) e baixamos via Blob — o mimetype
 * vem da própria resposta, e forçamos o nome com a extensão certa.
 * Usar via useMutation na página.
 * @param {string} id        id do catálogo (ex.: 'ocupacao')
 * @param {object} params    { from, to, cemeteryId }
 * @param {'csv'|'xlsx'|'pdf'} [format='csv']
 * @param {string} [filename]
 * @returns {Promise<true>}
 */
export async function exportReport(id, params, format = "csv", filename) {
  const path = ENDPOINTS[id];
  if (!path) throw new Error(`Relatório desconhecido: ${id}`);

  const fmt = String(format || "csv").toLowerCase();
  const qs = buildQuery({ ...FIXED_PARAMS[id], ...params, format: fmt });
  const url = `${BASE_URL.replace(/\/+$/, "")}${path}${qs ? `?${qs}` : ""}`;
  const token = getToken();

  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`Não foi possível gerar o arquivo ${fmt.toUpperCase()} do relatório.`);
  }

  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename || `${id}.${fmt}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}
