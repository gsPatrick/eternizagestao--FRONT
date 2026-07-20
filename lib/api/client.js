/**
 * Cliente HTTP da API Eterniza — wrapper fino sobre o fetch nativo.
 * SSR-safe (nenhum acesso a window no topo do módulo). Sem dependências.
 *
 * Envelope da API:
 *   sucesso: { success: true, data, meta? }
 *   erro:    { success: false, error: { code, message, details? } }
 *
 * apiFetch desembrulha o envelope e RETORNA `data`. Para listas paginadas,
 * passe `{ meta: true }` e receba `{ data, meta }` (ver README).
 */

import { getToken, clearSession } from "./session";

// Base da API. Fallback HARDCODED para produção (EasyPanel); em dev o .env.local
// aponta pra http://localhost:3333/api/v1 e tem prioridade.
// À PROVA DE BALA: normaliza pra SEMPRE terminar em /api/v1, mesmo que o env
// venha só com o host (sem prefixo). O prefixo da API é fixo (/api/v1), então
// aceitamos qualquer uma dessas formas no NEXT_PUBLIC_API_URL:
//   https://host            -> https://host/api/v1
//   https://host/           -> https://host/api/v1
//   https://host/api/v1     -> https://host/api/v1 (inalterado)
function resolveApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();
  let base = (
    raw || "https://eternizagestao-eternizagestao--api.0yjn0n.easypanel.host"
  ).replace(/\/+$/, "");
  if (!/\/api\/v\d+$/.test(base)) base += "/api/v1";
  return base;
}

const BASE_URL = resolveApiBase();

/** Erro tipado lançado por apiFetch. */
export class ApiError extends Error {
  constructor(message, { code, status, details } = {}) {
    super(message || "Erro inesperado.");
    this.name = "ApiError";
    this.code = code || null;
    this.status = status ?? null;
    this.details = details ?? null;
  }
}

/** Monta a querystring ignorando undefined/null/'' (vazio). */
function buildQuery(params) {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      value.forEach((v) => {
        if (v !== undefined && v !== null && v !== "") usp.append(key, v);
      });
    } else {
      usp.append(key, value);
    }
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

function joinUrl(path, query) {
  const clean = String(path || "").replace(/^\/+/, "");
  return `${BASE_URL.replace(/\/+$/, "")}/${clean}${query}`;
}

function onLoginRoute() {
  if (typeof window === "undefined") return false;
  return window.location.pathname.startsWith("/login");
}

/**
 * @param {string} path  caminho relativo à base (ex.: '/graves' ou 'graves')
 * @param {object} opts
 * @param {'GET'|'POST'|'PATCH'|'PUT'|'DELETE'} [opts.method='GET']
 * @param {object} [opts.body]    serializado como JSON
 * @param {object} [opts.params]  querystring (ignora undefined/null/'')
 * @param {string} [opts.tenant]  vira header X-Tenant-Subdomain (rotas públicas/portal)
 * @param {boolean} [opts.auth=true]  anexa Bearer <token> se houver
 * @param {boolean} [opts.meta=false] retorna { data, meta } em vez de só data
 * @param {AbortSignal} [opts.signal]
 * @returns {Promise<any>}  `data` do envelope — ou `{ data, meta }` quando meta:true
 */
export async function apiFetch(
  path,
  { method = "GET", body, params, tenant, auth = true, meta = false, signal } = {}
) {
  const url = joinUrl(path, buildQuery(params));

  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  if (tenant) headers["X-Tenant-Subdomain"] = tenant;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  // 204/sem corpo → sem JSON para ler
  let json = null;
  if (res.status !== 204) {
    const text = await res.text();
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
  }

  if (!res.ok || (json && json.success === false)) {
    // 401 → sessão inválida/expirada: limpa e manda pro login (exceto se já lá)
    if (res.status === 401 && typeof window !== "undefined" && !onLoginRoute()) {
      clearSession();
      window.location.assign("/login");
    }
    const err = (json && json.error) || {};
    throw new ApiError(err.message || res.statusText || "Erro na requisição.", {
      code: err.code,
      status: res.status,
      details: err.details,
    });
  }

  const data = json ? json.data : null;
  if (meta) return { data, meta: json ? json.meta ?? null : null };
  return data;
}

/** Atalhos idiomáticos. */
export const api = {
  get: (path, opts) => apiFetch(path, { ...opts, method: "GET" }),
  post: (path, body, opts) => apiFetch(path, { ...opts, method: "POST", body }),
  patch: (path, body, opts) => apiFetch(path, { ...opts, method: "PATCH", body }),
  put: (path, body, opts) => apiFetch(path, { ...opts, method: "PUT", body }),
  del: (path, opts) => apiFetch(path, { ...opts, method: "DELETE" }),
};

export default api;
