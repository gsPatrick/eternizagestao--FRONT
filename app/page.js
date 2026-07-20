import PublicNav from "@/components/organisms/PublicNav/PublicNav";
import PublicHero from "@/components/organisms/PublicHero/PublicHero";
import PlatformStatement from "@/components/organisms/PlatformStatement/PlatformStatement";
import PanelShowcase from "@/components/organisms/PanelShowcase/PanelShowcase";
import ImpactCards from "@/components/organisms/ImpactCards/ImpactCards";
import PublicFooter from "@/components/organisms/PublicFooter/PublicFooter";

/**
 * Raiz (apex) — landing INSTITUCIONAL da Eterniza: vende o software para
 * prefeituras. Sem busca de cidadão (isso vive na página pública do tenant,
 * em /[cidade]). Marca Eterniza, sempre navy.
 */
export default function HomePage() {
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
