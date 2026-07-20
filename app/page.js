import { headers } from "next/headers";
import TenantLanding from "@/components/templates/TenantLanding/TenantLanding";
import PlatformLanding from "@/components/templates/PlatformLanding/PlatformLanding";
import { TENANTS, normalizeApiTenant } from "@/lib/tenants";
import { getPublicTenants } from "@/lib/api/resources/public";

/**
 * Raiz `/` — resolve pelo SUBDOMÍNIO (via middleware):
 *   - COM subdomínio de cidade → landing pública DAQUELA cidade (TenantLanding).
 *   - SEM subdomínio (apex/dev) → RENDERIZA a landing da plataforma DIRETO
 *     (sem redirect — evita o hop /plataforma que poderia confundir cache/navegador).
 *
 * /plataforma segue existindo como URL canônica da mesma landing.
 * Server component (usa headers()) — não pode ter "use client".
 */

// Sempre dinâmica: depende do subdomínio (header) e da lista viva de cidades.
export const dynamic = "force-dynamic";

// Fonte da verdade: GET /public/tenants; fallback estático quando a API falha.
async function loadTenants() {
  try {
    const apiTenants = await getPublicTenants({ cache: "no-store" });
    if (Array.isArray(apiTenants) && apiTenants.length) {
      return apiTenants.map(normalizeApiTenant);
    }
  } catch {
    // offline / erro → fallback
  }
  return TENANTS.filter((t) => t.id !== "eterniza");
}

// Casa o subdomínio do host contra os campos de slug do tenant (case-insensitive).
function matchBySubdomain(list, sub) {
  const s = String(sub || "").toLowerCase();
  return (
    (list || []).find((t) =>
      [t.apiSubdomain, t.subdomain, t.id].some(
        (v) => String(v || "").toLowerCase() === s
      )
    ) || null
  );
}

export default async function HomePage() {
  const sub = headers().get("x-tenant-subdomain");

  // Sem subdomínio (apex/dev) → landing da plataforma, renderizada DIRETO.
  if (!sub) return <PlatformLanding />;

  const list = await loadTenants();
  const tenant = matchBySubdomain(list, sub);
  // Subdomínio desconhecido → também mostra a plataforma (nunca cai em login).
  if (!tenant) return <PlatformLanding />;

  return <TenantLanding tenant={tenant} />;
}
