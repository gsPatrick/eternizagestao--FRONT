export const NAV_GROUPS = [
  {
    label: "Principal",
    items: [{ key: "dashboard", label: "Painel", shortLabel: "Início", href: "/painel", exact: true }],
  },
  {
    label: "Operação",
    items: [
      { key: "graves", label: "Sepulturas", href: "/painel/sepulturas" },
      { key: "deceased", label: "Sepultados", href: "/painel/sepultados" },
      // "Concessões" saiu do menu: a posse virou opcional e inline no cadastro
      // da sepultura (a página /painel/concessoes segue acessível por URL).
      // "Sepultamentos" também saiu: o cliente não distinguia sepultado de
      // sepultamento. O sepultamento deixou de ser uma etapa própria — cadastrar
      // o sepultado já o vincula à sepultura e emite a autorização.
      { key: "exhumations", label: "Exumações & Ossário", href: "/painel/exumacoes" },
      { key: "schedule", label: "Agenda", href: "/painel/agenda" },
    ],
  },
  {
    label: "Financeiro",
    items: [
      { key: "billings", label: "Cobranças", href: "/painel/cobrancas" },
      { key: "fees", label: "Taxas de manutenção", href: "/painel/taxas" },
      { key: "delinquency", label: "Inadimplência", href: "/painel/inadimplencia" },
    ],
  },
  {
    label: "Básico",
    items: [
      { key: "cartorios", label: "Cartórios", href: "/painel/cartorios" },
      { key: "funerarias", label: "Funerárias", href: "/painel/funerarias" },
      { key: "institutions", label: "Instituições", href: "/painel/instituicoes" },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { key: "cemeteries", label: "Cemitérios & Estrutura", href: "/painel/cemiterios" },
      { key: "people", label: "Pessoas", href: "/painel/pessoas" },
      { key: "owners", label: "Proprietários", href: "/painel/proprietarios" },
      { key: "responsibles", label: "Responsáveis", href: "/painel/responsaveis" },
      { key: "drawers", label: "Gavetas", href: "/painel/gavetas" },
      { key: "map", label: "Mapa", href: "/painel/mapa" },
    ],
  },
  {
    label: "Gestão",
    items: [
      { key: "documents", label: "Documentos", href: "/painel/documentos" },
      { key: "reports", label: "Relatórios", href: "/painel/relatorios" },
      { key: "notifications", label: "Notificações", href: "/painel/notificacoes" },
      { key: "imports", label: "Importar dados", href: "/painel/importacoes" },
      { key: "audit", label: "Auditoria", href: "/painel/auditoria" },
      { key: "users", label: "Usuários", href: "/painel/usuarios" },
    ],
  },
  {
    label: "Plataforma da cidade",
    items: [
      { key: "settings", label: "Configurações", href: "/painel/configuracoes" },
    ],
  },
];

// abas fixas da footer bar mobile (a última é sempre o "Menu" com todas as opções)
export const MOBILE_TAB_KEYS = ["dashboard", "graves", "billings", "schedule"];

export function flatNavItems() {
  return NAV_GROUPS.flatMap((group) => group.items);
}

export function findByKey(key) {
  return flatNavItems().find((item) => item.key === key) || null;
}

export function findNavItem(pathname) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.exact ? pathname === item.href : pathname.startsWith(item.href)) {
        return item;
      }
    }
  }
  return null;
}

export function isActive(item, pathname) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
