/**
 * Navegação do CONSOLE DA PLATAFORMA (super_admin) — mesmo espírito de
 * `lib/panel-nav.js`, mas com apenas 3 destinos. A identidade é navy fixo da
 * plataforma (NÃO é temada por cidade).
 */
export const ADMIN_NAV = [
  { key: "overview", label: "Início", shortLabel: "Início", href: "/admin", exact: true },
  { key: "cities", label: "Cidades", shortLabel: "Cidades", href: "/admin/cidades" },
  { key: "settings", label: "Configurações", shortLabel: "Config", href: "/admin/configuracoes" },
];

export function isActive(item, pathname) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function findAdminNavItem(pathname) {
  for (const item of ADMIN_NAV) {
    if (isActive(item, pathname)) return item;
  }
  return null;
}
