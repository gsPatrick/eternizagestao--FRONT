import { api } from "@/lib/api/client";

/**
 * Recursos PÚBLICOS (portal do cidadão / app do visitante). Rotas sem auth,
 * resolvidas por tenant via header X-Tenant-Subdomain. Nunca anexam token.
 *
 * Endpoints da API (montados em /v1/public):
 *   GET /public/search                    → busca ampla (q) + filtros (nome, cpf,
 *                                            quadra, lote, jazigo, situacao)
 *   GET /public/cemeteries/:id/map        → ortofoto + camadas do cemitério
 *   GET /public/graves/:id/route          → entrada → sepultura + malha de caminhos
 */

/**
 * Resolve o subdomínio de tenant enviado à API a partir do slug do front.
 *
 * Em produção cada cidade tem seu próprio subdomínio (o slug É o subdomínio).
 * Em desenvolvimento respeitamos o slug pedido (?t=guarulhos); sem slug caímos
 * no tenant PADRÃO/cheio `guarulhos`, que tem dados reais semeados — assim a
 * integração é exercitada contra a API real, sem mocks.
 */
const IS_DEV = process.env.NODE_ENV !== "production";
const DEV_DEFAULT_TENANT = "guarulhos";

export function resolvePublicTenant(slug) {
  if (slug) return slug;
  if (IS_DEV) return DEV_DEFAULT_TENANT;
  return null;
}

// comprimento mínimo de um termo textual livre (alinhado à API)
export const MIN_SEARCH_LENGTH = 2;

/**
 * Monta os parâmetros da BUSCA AMPLA a partir do texto livre do cidadão.
 * A API (q) já detecta e casa em vários campos — nome do sepultado,
 * proprietário/responsável, CPF, código do jazigo, quadra, lote e situação —
 * então basta encaminhar o texto como `q`.
 */
export function buildSearchParams(raw) {
  const q = String(raw ?? "").trim();
  if (!q) return { empty: true };
  if (q.length < MIN_SEARCH_LENGTH) return { tooShort: true };
  return { q };
}

/**
 * Monta os parâmetros dos FILTROS AVANÇADOS (opcionais, combinados em E na API).
 * Ignora campos vazios. Chaves: quadra, lote, jazigo, situacao.
 */
export function buildFilterParams(filters = {}) {
  const out = {};
  for (const key of ["quadra", "lote", "jazigo", "situacao"]) {
    const v = String(filters?.[key] ?? "").trim();
    if (v) out[key] = v;
  }
  return out;
}

// Lista pública de cidades/clientes (sem auth, sem tenant no contexto).
// → [{ id, name, subdomain, primaryColor, secondaryColor, logoUrl }]
export const getPublicTenants = (opts = {}) =>
  api.get("/public/tenants", { auth: false, ...opts });

// Lista pública de cemitérios do tenant (resolvido por X-Tenant-Subdomain).
// → [{ id, name }]
export const getPublicCemeteries = ({ tenant, ...opts } = {}) =>
  api.get("/public/cemeteries", { tenant, auth: false, ...opts });

// Agenda pública de um cemitério (velórios/sepultamentos/exumações futuros).
// → [{ id, type, title, dateTime, place, deceasedName }]
export const getPublicAgenda = (cemeteryId, { tenant, ...opts } = {}) =>
  api.get(`/public/cemeteries/${cemeteryId}/agenda`, { tenant, auth: false, ...opts });

// LISTA paginada → { meta: true } → devolve { data, meta }
export const searchPublic = (params, { tenant, ...opts } = {}) =>
  api.get("/public/search", { params, tenant, auth: false, meta: true, ...opts });

// Mapa do cemitério: ortofoto ativa + camadas de polígonos
export const getCemeteryMap = (cemeteryId, { tenant, ...opts } = {}) =>
  api.get(`/public/cemeteries/${cemeteryId}/map`, { tenant, auth: false, ...opts });

// Navegação: entrada → sepultura (lat/long) + malha de caminhos
export const getGraveRoute = (graveId, { tenant, ...opts } = {}) =>
  api.get(`/public/graves/${graveId}/route`, { tenant, auth: false, ...opts });

/**
 * Normaliza um item da busca pública para o shape que a UI consome.
 * (o front é a fonte da verdade do shape — ver lib/api/README.md)
 */
export function mapSearchResult(item) {
  const b = item.burial || {};
  return {
    id: item.id,
    name: item.fullName,
    birthDate: item.birthDate || null,
    deathDate: item.deathDate || null,
    // a foto do sepultado (ou, na falta, a da cova) já vem ASSINADA da API
    photoUrl: item.photoUrl || b.photoUrl || null,
    holder: item.holder?.name || null, // proprietário/responsável (concessão)
    cemetery: b.cemetery?.name || null,
    cemeteryId: b.cemetery?.id || null,
    block: b.block || null,
    street: b.street || null,
    lot: b.lot || null,
    code: b.graveCode || null,
    unitType: b.unitType || null,
    status: b.status?.name || null,
    statusColor: b.status?.color || null,
    graveId: b.graveId || null,
    latitude: b.latitude != null ? Number(b.latitude) : null,
    longitude: b.longitude != null ? Number(b.longitude) : null,
    geoPolygon: b.geoPolygon || null,
  };
}
