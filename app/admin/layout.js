import AdminShell from "@/components/organisms/AdminShell/AdminShell";

export const metadata = {
  title: "Plataforma · Eterniza Gestão",
};

/**
 * Layout fino do CONSOLE DA PLATAFORMA (super_admin). Toda a lógica de
 * guard/gate e a casca responsiva (sidebar navy no desktop / bottom tab bar no
 * mobile) vivem no AdminShell. O bypass de `/admin/login` também é tratado lá.
 */
export default function AdminLayout({ children }) {
  return <AdminShell>{children}</AdminShell>;
}
