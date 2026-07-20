import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import PublicNav from "@/components/organisms/PublicNav/PublicNav";
import PublicHero from "@/components/organisms/PublicHero/PublicHero";
import PublicStatement from "@/components/organisms/PublicStatement/PublicStatement";
import SearchBand from "@/components/organisms/SearchBand/SearchBand";
import PublicAgenda from "@/components/organisms/PublicAgenda/PublicAgenda";
import PublicFooter from "@/components/organisms/PublicFooter/PublicFooter";

/**
 * Landing PÚBLICA da cidade — a cara pública daquele cemitério, temada pela
 * cor/marca do cliente, com a busca do cidadão e SEM as seções de venda.
 *
 * Reutilizável entre a rota por PATH (/[cidade]) e a raiz `/` quando há
 * subdomínio de cidade. Recebe o `tenant` já resolvido (normalizado por
 * `lib/tenants.js`). Comportamento/visual idênticos ao que a página do tenant
 * renderizava antes desta extração.
 */
export default function TenantLanding({ tenant }) {
  const home = `/${tenant.id}`;
  const consultaHref = `/consulta-publica?t=${tenant.id}`;
  const portalHref = `/portal/login?t=${tenant.id}`;
  const navLinks = [
    { label: "Consulta pública", href: consultaHref },
    { label: "Acesso administrativo", href: "/login" },
  ];
  const footerNav = [
    { label: "Início", href: `${home}#top` },
    { label: "Consulta pública", href: consultaHref },
    { label: "Portal da Família", href: portalHref },
    { label: "Acesso administrativo", href: "/login" },
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
