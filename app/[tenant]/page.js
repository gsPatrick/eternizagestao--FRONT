import { notFound } from "next/navigation";
import TenantLanding from "@/components/templates/TenantLanding/TenantLanding";
import { TENANTS, normalizeApiTenant, resolveTenant } from "@/lib/tenants";
import { getPublicTenants } from "@/lib/api/resources/public";

/**
 * Página PÚBLICA do tenant — /[cidade] (ex.: /guarulhos). É a cara pública
 * daquele cemitério: temada pela cor/marca do cliente, com a busca do cidadão,
 * SEM as seções de venda (isso é só da landing institucional da Eterniza).
 * O tenant é definido pelo início da URL e resolvido pela API (fonte da verdade).
 */

// Slugs dinâmicos: a lista de cidades vive na API, não no build. Geramos zero
// rotas estáticas e deixamos o Next resolver cada slug sob demanda.
export const dynamicParams = true;
export function generateStaticParams() {
  return [];
}

// Fonte da verdade: GET /public/tenants. Se a API falhar, cai no fallback
// estático (nunca dá white-screen). Slug inexistente → notFound().
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

export default async function TenantPublicPage({ params }) {
  const list = await loadTenants();
  const tenant = resolveTenant(list, params.tenant);
  if (!tenant) notFound();

  return <TenantLanding tenant={tenant} />;
}
