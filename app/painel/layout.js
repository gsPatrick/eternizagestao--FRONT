import PanelShell from "@/components/organisms/PanelShell/PanelShell";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";
import OnboardingGuard from "./OnboardingGuard";

export const metadata = {
  title: "Painel · Eterniza Gestão",
};

export default function PanelLayout({ children }) {
  return (
    <TenantTheme>
      {/* Rede de segurança: admin `pendente` já logado → onboarding (uma vez). */}
      <OnboardingGuard />
      <PanelShell>{children}</PanelShell>
    </TenantTheme>
  );
}
