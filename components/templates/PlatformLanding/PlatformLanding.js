import PublicNav from "@/components/organisms/PublicNav/PublicNav";
import PublicHero from "@/components/organisms/PublicHero/PublicHero";
import PlatformStatement from "@/components/organisms/PlatformStatement/PlatformStatement";
import PanelShowcase from "@/components/organisms/PanelShowcase/PanelShowcase";
import ImpactCards from "@/components/organisms/ImpactCards/ImpactCards";
import PublicFooter from "@/components/organisms/PublicFooter/PublicFooter";

/**
 * Landing INSTITUCIONAL da Eterniza — vende o software para prefeituras.
 * Sem busca de cidadão (isso vive na landing pública do tenant). Marca
 * Eterniza, sempre navy.
 *
 * Reutilizável entre a rota canônica (/plataforma) e o fallback da raiz `/`
 * (apex/sem subdomínio).
 */
export default function PlatformLanding() {
  return (
    <>
      <PublicNav />
      <main>
        <PublicHero variant="sales" />
        <PlatformStatement />
        <PanelShowcase />
        <ImpactCards />
      </main>
      <PublicFooter />
    </>
  );
}
