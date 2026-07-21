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

// Base da API — SEMPRE a de produção.
//
// O sistema está no ar em produção; o front nunca deve falar com localhost.
// Já custou caro depender de configuração aqui: NEXT_PUBLIC_API_URL é assada no
// bundle durante o `next build`, então um deploy sem ela (ou com ela errada)
// não tem conserto em runtime — foi assim que a ortofoto ficou invisível, com o
// <img> do mapa apontando para a máquina do próprio usuário.
//
// Por isso o padrão é fixo e a env só é aceita quando aponta para um host REAL.
// Qualquer valor de localhost é ignorado de propósito: é o erro que queremos
// tornar impossível, não um caso de uso.
const API_PROD = "https://eternizagestao-eternizagestao--api.0yjn0n.easypanel.host";

function isLocalUrl(value) {
  return /(^|\/\/)(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(value);
}

// À PROVA DE BALA: normaliza pra SEMPRE terminar em /api/v1, mesmo que o env
// venha só com o host (sem prefixo):
//   https://host        -> https://host/api/v1
//   https://host/api/v1 -> inalterado
function resolveApiBase() {
  const raw = (process.env.NEXT_PUBLIC_API_URL || "").trim();

  // A env serve para apontar a API a outro host real (domínio próprio,
  // staging). Vazia ou apontando para localhost => produção.
  let base = raw && !isLocalUrl(raw) ? raw : API_PROD;

  base = base.replace(/\/+$/, "");
  if (!/\/api\/v\d+$/.test(base)) base += "/api/v1";
  return base;
}

const BASE_URL = resolveApiBase();

/**
 * Base COMPLETA da API (com /api/v1). Exportada para os poucos lugares que
 * precisam montar a URL na mão (download de PDF, exportações, relatórios) —
 * eles resolviam por conta própria e caíam em localhost em produção.
 */
export const API_URL = BASE_URL;

/**
 * ORIGEM da API (sem o /api/v1). Os arquivos servidos pela API — ortofoto,
 * fotos, PDFs — ficam FORA do prefixo, em /files/...
 *
 * Exportado daqui de propósito: já houve um bug em produção porque outro módulo
 * resolvia essa origem por conta própria e caía num fallback diferente
 * (localhost). As chamadas de API funcionavam e SÓ a ortofoto não carregava.
 * Uma fonte só evita a divergência.
 */
export const API_ORIGIN = BASE_URL.replace(/\/api\/v\d+$/, "");

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
  { method = "GET", body, params, tenant, auth = true, meta = false, signal, cache, next } = {}
) {
  const url = joinUrl(path, buildQuery(params));

  const headers = { "Content-Type": "application/json" };
  // Token enviado nesta chamada (null quando auth:false ou visitante deslogado).
  const sentToken = auth ? getToken() : null;
  if (sentToken) headers.Authorization = `Bearer ${sentToken}`;
  if (tenant) headers["X-Tenant-Subdomain"] = tenant;

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
    // Server Components (Next 14) cacheiam fetch por padrão (force-cache); quem
    // precisa de dados sempre frescos (ex.: lista de cidades) passa cache:'no-store'.
    ...(cache ? { cache } : {}),
    // `next` (ex.: { revalidate: 300 }) — cache com TTL no SSR (tema do tenant).
    ...(next ? { next } : {}),
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
    // 401 → só redireciona pro login se HAVIA um token (sessão expirada de quem
    // estava logado). Visitante DESLOGADO (sem token) numa página pública NÃO é
    // levado ao login — ex.: o painel-demo embutido na landing de venda dispara
    // chamadas autenticadas que voltam 401 sem que ninguém esteja logado.
    if (sentToken && res.status === 401 && typeof window !== "undefined" && !onLoginRoute()) {
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

/**
 * Upload BINÁRIO (arquivo cru no corpo) — para arquivos grandes (ortofotos de
 * drone com dezenas de MB), evitando o inchaço de ~33% do base64-em-JSON e o
 * limite do body JSON. Metadados vão na querystring. Desembrulha o envelope
 * igual ao apiFetch.
 * @param {string} path
 * @param {File|Blob} file
 * @param {object} [opts] { params, tenant, method='POST', signal }
 */
export async function apiUpload(path, file, { params, tenant, method = "POST", signal } = {}) {
  const url = joinUrl(path, buildQuery(params));
  const headers = { "Content-Type": file.type || "application/octet-stream" };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenant) headers["X-Tenant-Subdomain"] = tenant;

  const res = await fetch(url, { method, headers, body: file, signal });

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
    if (token && res.status === 401 && typeof window !== "undefined" && !onLoginRoute()) {
      clearSession();
      window.location.assign("/login");
    }
    const err = (json && json.error) || {};
    throw new ApiError(err.message || res.statusText || "Falha no upload.", {
      code: err.code,
      status: res.status,
      details: err.details,
    });
  }
  return json ? json.data : null;
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
