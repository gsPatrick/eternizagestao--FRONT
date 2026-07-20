import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";

export const metadata = {
  title: "Portal da Família · Eterniza Gestão",
};

export default function PortalLayout({ children }) {
  return <TenantTheme>{children}</TenantTheme>;
}
