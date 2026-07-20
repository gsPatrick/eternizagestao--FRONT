import PanelShell from "@/components/organisms/PanelShell/PanelShell";
import PanelTheme from "./PanelTheme";
import OnboardingGuard from "./OnboardingGuard";

export const metadata = {
  title: "Painel · Eterniza Gestão",
};

export default function PanelLayout({ children }) {
  return (
    <PanelTheme>
      {/* Rede de segurança: admin `pendente` já logado → onboarding (uma vez). */}
      <OnboardingGuard />
      <PanelShell>{children}</PanelShell>
    </PanelTheme>
  );
}
