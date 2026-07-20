import { notFound } from "next/navigation";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import PublicNav from "@/components/organisms/PublicNav/PublicNav";
import PublicHero from "@/components/organisms/PublicHero/PublicHero";
import PublicStatement from "@/components/organisms/PublicStatement/PublicStatement";
import SearchBand from "@/components/organisms/SearchBand/SearchBand";
import PublicAgenda from "@/components/organisms/PublicAgenda/PublicAgenda";
import PublicFooter from "@/components/organisms/PublicFooter/PublicFooter";
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

  const home = `/${tenant.id}`;
  const consultaHref = `/consulta-publica?t=${tenant.id}`;
  const portalHref = `/login?t=${tenant.id}`;
  const navLinks = [{ label: "Consulta pública", href: consultaHref }];
  const footerNav = [
    { label: "Início", href: `${home}#top` },
    { label: "Consulta pública", href: consultaHref },
    { label: "Portal da Família", href: portalHref },
  ];

  return (
    <TenantTheme forcedTenantId={tenant.id} showSwitcher={false}>
      <PublicNav home={home} links={navLinks} cta={{ label: "Portal da Família", href: portalHref }} />
      <main>
        <PublicHero variant="public" tenantSlug={tenant.id} />
        <PublicStatement
          tone="white"
          kicker="Memória viva"
          phrase="Cada nome guardado aqui é uma história que a cidade decidiu não esquecer."
          highlight={["não", "esquecer"]}
        />
        <SearchBand tenantSlug={tenant.id} />
        <PublicStatement
          tone="bone"
          kicker="Cuidado"
          phrase="Um lugar organizado, digno e sempre aberto para quem precisa visitar."
          highlight={["digno"]}
        />
        <PublicAgenda cityName={tenant.name} tenantSlug={tenant.apiSubdomain || tenant.id} />
      </main>
      <PublicFooter variant="public" nav={footerNav} cityName={tenant.brandLead} />
    </TenantTheme>
  );
}
