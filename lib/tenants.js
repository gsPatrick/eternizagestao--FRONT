// Configuração white label por tenant (prefeitura/concessionária).
// Em produção, isto vem da API resolvida pelo subdomínio (tenant.cores, logo).
// O acento troca por cliente; as cores semânticas (sucesso/erro) NUNCA trocam.

// Domínio base só para EXIBIR o domínio da cidade (<sub>.<BASE_DOMAIN>). A
// resolução do tenant ignora o domínio (é pelo subdomínio). Trocável por env.
export const BASE_DOMAIN =
  process.env.NEXT_PUBLIC_BASE_DOMAIN || "eternizagestao.com.br";

/**
 * Identidade INSTITUCIONAL da Eterniza (navy padrão). NÃO é uma cidade: é a
 * marca da própria plataforma, usada como tema neutro enquanto nenhum tenant
 * foi resolvido (ou quando a resolução falha).
 *
 * Aqui NÃO existe mais lista estática de prefeituras. A única fonte de cidades
 * é `GET /public/tenants`: se a API estiver fora, as telas mostram estado
 * vazio/erro honesto — jamais uma lista de municípios que não são clientes.
 */
export const DEFAULT_TENANT = {
  id: "eterniza",
  name: "Eterniza Gestão",
  brandLead: "Eterniza",
  brandTail: "Gestão",
  subdomain: `demo.${BASE_DOMAIN}`,
  accent: "#032e59",
  accentRgb: "3, 46, 89",
  accentBright: "#0a4a8c",
  accentDeep: "#02223f",
};

/* ------------------------------------------------------------------------- *
 * Normalização da API pública → shape do FRONT.
 *
 * A fonte da verdade das cidades é `GET /public/tenants`
 * (→ { id, name, subdomain, primaryColor, secondaryColor, logoUrl }).
 * Aqui convertemos esse shape para o shape que os componentes já consomem
 * (accent/accentRgb/accentBright/accentDeep + brandLead/brandTail). O FRONT
 * continua sendo o dono do formato; a API só alimenta os valores.
 * ------------------------------------------------------------------------- */

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "000000", 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(n) {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
}

// Escurece um acento por um fator (mantém a proporção da cor navy → deep).
function darkenRgb([r, g, b], factor) {
  return `#${channel(r * factor)}${channel(g * factor)}${channel(b * factor)}`;
}

// "Prefeitura de São Paulo" → { brandLead: "São Paulo", brandTail: "Cemitérios" }
function deriveBrand(name) {
  const raw = String(name || "").trim();
  const city = raw.replace(/^Prefeitura\s+(?:de\s+|d[oa]s?\s+)?/i, "").trim() || raw;
  return { brandLead: city, brandTail: "Cemitérios" };
}

/**
 * Converte um tenant público da API no objeto que o FRONT usa.
 * `id` recebe o subdomínio (é o slug das URLs, ex.: "guarulhos") — o UUID
 * real vai em `tenantId`. `apiSubdomain` é o subdomínio "cru" para o header
 * X-Tenant-Subdomain; `subdomain` é o domínio de exibição.
 */
export function normalizeApiTenant(t) {
  const accent = t.primaryColor || DEFAULT_TENANT.accent;
  const rgb = hexToRgb(accent);
  const { brandLead, brandTail } = deriveBrand(t.name);
  return {
    id: t.subdomain,
    tenantId: t.id,
    name: t.name,
    brandLead,
    brandTail,
    subdomain: `${t.subdomain}.${BASE_DOMAIN}`,
    apiSubdomain: t.subdomain,
    accent,
    accentRgb: rgb.join(", "),
    accentBright: t.secondaryColor || accent,
    accentDeep: darkenRgb(rgb, 0.68),
    logoUrl: t.logoUrl || null,
    // Arte própria da página pública da cidade (null → usa a padrão da plataforma).
    heroImageUrl: t.heroImageUrl || null,
    footerImageUrl: t.footerImageUrl || null,
  };
}

// Resolve o tenant de uma lista pelo slug (== subdomínio). Sem match → null.
export function resolveTenant(list, slug) {
  if (!slug) return null;
  return (list || []).find((t) => t.id === slug || t.apiSubdomain === slug) || null;
}

/**
 * Variáveis CSS da marca (--color-navy e derivadas) a partir de um tenant
 * normalizado. FONTE ÚNICA usada tanto pelo TenantTheme (cliente) quanto pelo
 * SSR (app/layout.js injeta como <style> p/ pintar a cor já no 1º HTML).
 */
export function themeVarsFor(tenant) {
  return {
    "--color-navy": tenant.accent,
    "--color-navy-rgb": tenant.accentRgb,
    "--color-navy-bright": tenant.accentBright,
    "--color-navy-deep": tenant.accentDeep,
    "--color-navy-soft": `rgba(${tenant.accentRgb}, 0.10)`,
    "--color-navy-ghost": `rgba(${tenant.accentRgb}, 0.05)`,
  };
}
