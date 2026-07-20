import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TenantLanding from "@/components/templates/TenantLanding/TenantLanding";
import { TENANTS, normalizeApiTenant } from "@/lib/tenants";
import { getPublicTenants } from "@/lib/api/resources/public";

/**
 * Raiz `/` — sem conteúdo próprio. Resolve pelo SUBDOMÍNIO (via middleware):
 *   - COM subdomínio de cidade → landing pública DAQUELA cidade (TenantLanding).
 *   - SEM subdomínio (apex/plataforma) → redireciona para /plataforma.
 *
 * Em DEV (localhost) não há header de subdomínio → cai no redirect para
 * /plataforma; as cidades continuam acessíveis por /[cidade].
 *
 * Server component (usa headers()) — não pode ter "use client".
 */

// Fonte da verdade: GET /public/tenants; fallback estático quando a API falha.
async function loadTenants() {
  try {
    const apiTenants = await getPublicTenants();
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

  // Sem subdomínio (apex/dev) → contexto plataforma.
  if (!sub) redirect("/plataforma");

  const list = await loadTenants();
  const tenant = matchBySubdomain(list, sub);
  if (!tenant) redirect("/plataforma");

  return <TenantLanding tenant={tenant} />;
}
