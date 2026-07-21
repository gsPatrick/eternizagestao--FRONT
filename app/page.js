import { headers } from "next/headers";
import TenantLanding from "@/components/templates/TenantLanding/TenantLanding";
import PlatformLanding from "@/components/templates/PlatformLanding/PlatformLanding";
import { normalizeApiTenant } from "@/lib/tenants";
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

// Fonte ÚNICA das cidades: GET /public/tenants. Se a API falhar, retorna null
// (≠ lista vazia) para a página assumir um estado de erro HONESTO. Nunca
// devolvemos uma lista estática: exibiria municípios que não são clientes.
async function loadTenants() {
  try {
    const apiTenants = await getPublicTenants({ cache: "no-store" });
    if (Array.isArray(apiTenants)) return apiTenants.map(normalizeApiTenant);
  } catch {
    // offline / erro → null (sinaliza indisponibilidade, não "cidade inexistente")
  }
  return null;
}

// Estado honesto de indisponibilidade: o subdomínio existe, mas não conseguimos
// confirmar a cidade porque o serviço está fora. Não inventa dados nem finge 404.
function ServicoIndisponivel() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>
        Serviço temporariamente indisponível
      </h1>
      <p style={{ maxWidth: "52ch", lineHeight: 1.6, opacity: 0.75 }}>
        Não foi possível carregar os dados desta cidade agora. Tente novamente em
        alguns minutos.
      </p>
    </main>
  );
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
  // API fora do ar → mensagem honesta (não cai na landing da plataforma, que
  // daria a impressão errada de que aquele subdomínio não existe).
  if (list === null) return <ServicoIndisponivel />;

  const tenant = matchBySubdomain(list, sub);
  // Subdomínio desconhecido → também mostra a plataforma (nunca cai em login).
  if (!tenant) return <PlatformLanding />;

  return <TenantLanding tenant={tenant} />;
}
