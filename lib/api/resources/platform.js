import { api } from "@/lib/api/client";

/* ============================================================================
 * Plataforma (super_admin) — gestão das CIDADES (tenants). Resource fino sobre
 * o client da API. Uma função por endpoint real de:
 *   - src/features/tenants/tenants.routes.js
 * Todas as rotas abaixo exigem token de super_admin (SEM header de tenant):
 *   GET    /tenants                  lista paginada de cidades
 *   POST   /tenants                  cria cidade + 1º admin (2 modos)
 *   POST   /tenants/:id/activate     reativa a cidade
 *   POST   /tenants/:id/deactivate   desativa a cidade
 *   POST   /tenants/:id/resend-invite reenvia o convite ao 1º admin
 *   DELETE /tenants/:id              remove (soft delete) — usado só em limpeza
 * Sem estado, sem React. Helpers de apresentação no fim do arquivo.
 * ==========================================================================*/

// Domínio base da plataforma (espelha o BASE_DOMAIN da API). Usado só para o
// PREVIEW do domínio final no formulário — a fonte da verdade continua sendo o
// campo `domain` computado que a API devolve em cada cidade.
export const PLATFORM_BASE_DOMAIN = "eterniza.com.br";

// LISTA — perPage alto porque a console calcula os StatCards sobre o conjunto
// carregado. meta:true → { data, meta }.
export const listTenants = (params, opts) =>
  api.get("/tenants", { params: { perPage: 100, ...params }, meta: true, ...opts });

// CRIA a cidade + 1º admin. body: { mode, tenant:{...}, admin:{...} }
export const createTenant = (body) => api.post("/tenants", body);

export const activateTenant = (id) => api.post(`/tenants/${id}/activate`, {});
export const deactivateTenant = (id) => api.post(`/tenants/${id}/deactivate`, {});

// Reenvia o convite ao 1º admin (ou a um e-mail informado: { email }).
export const resendTenantInvite = (id, email) =>
  api.post(`/tenants/${id}/resend-invite`, email ? { email } : {});

// Remoção (soft delete) — usada apenas para limpar cidades de teste.
export const removeTenant = (id) => api.del(`/tenants/${id}`);

/* ============================================================================
 * Helpers de apresentação — normalização de subdomínio, preview de domínio e
 * adaptador da cidade para a linha/StatCards consumidos pela console.
 * ==========================================================================*/

// Normaliza o subdomínio como a API: minúsculas, apenas [a-z0-9-].
// (a API ainda exige 2..63 chars e sem hífen nas pontas; aqui só higienizamos
//  a digitação — a validação forte fica no backend, que responde 400 amigável.)
export function normalizeSubdomain(raw = "") {
  return String(raw).toLowerCase().replace(/[^a-z0-9-]/g, "");
}

// Preview do domínio final a partir do subdomínio digitado.
export function previewDomain(subdomain) {
  const sub = normalizeSubdomain(subdomain);
  return sub ? `${sub}.${PLATFORM_BASE_DOMAIN}` : "";
}

// cidade da API → linha/consumo da console (o front é a fonte da verdade).
export function adaptTenant(t = {}) {
  return {
    id: t.id,
    name: t.name,
    subdomain: t.subdomain,
    domain: t.domain || previewDomain(t.subdomain),
    onboardingStatus: t.onboardingStatus || "pendente", // 'pendente' | 'concluido'
    active: Boolean(t.active),
    primaryColor: t.primaryColor || null,
    secondaryColor: t.secondaryColor || null,
    email: t.email || null,
    raw: t,
  };
}

export function adaptTenants(rows = []) {
  return rows.map(adaptTenant);
}
