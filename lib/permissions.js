"use client";

// Permissões do usuário logado (lidas do login/me, guardadas na sessão) para
// decidir o que a interface mostra e o que bloqueia.
//
// A SEGURANÇA real está no backend (o enforcement por perfil). Isto é só a
// experiência: esconder da sidebar o que o perfil não usa e explicar num modal
// quando uma ação é bloqueada, em vez de deixar o operador bater num erro seco.

import { getUser } from "@/lib/api/session";

// Cada item de menu / área do painel → módulo do catálogo de permissões.
// A sidebar usa isto para esconder o que o perfil não pode nem VER.
export const NAV_MODULE = {
  dashboard: null, // início: sempre visível
  graves: "cadastros",
  deceased: "sepultados",
  exhumations: "sepultados",
  schedule: "sepultados",
  billings: "financeiro",
  fees: "financeiro",
  delinquency: "financeiro",
  cartorios: "cadastros",
  funerarias: "cadastros",
  institutions: "cadastros",
  cemeteries: "cadastros",
  people: "cadastros",
  owners: "cadastros",
  responsibles: "cadastros",
  drawers: "cadastros",
  map: "mapa",
  documents: "documentos",
  reports: "relatorios",
  notifications: "usuarios",
  imports: "importacoes",
  audit: "auditoria",
  users: "usuarios",
  settings: "usuarios",
};

// Rótulo humano de cada módulo, para as mensagens do modal de bloqueio.
export const MODULE_LABEL = {
  cadastros: "Cadastros",
  sepultados: "Sepultados & exumações",
  financeiro: "Financeiro",
  documentos: "Documentos",
  mapa: "Mapa",
  relatorios: "Relatórios",
  importacoes: "Importação de legado",
  auditoria: "Auditoria",
  usuarios: "Usuários & configurações",
};

function permsOf(user) {
  return (user || getUser())?.permissions || null;
}

// Sem mapa de permissões (admin/operador legado, ou dado antigo em cache) →
// libera tudo, para não esconder nada de quem não tem perfil customizado.
function semRestricao(perms) {
  return !perms || typeof perms !== "object" || Object.keys(perms).length === 0;
}

/** Pode VER o módulo? (para a sidebar) */
export function canViewModule(moduleKey, user) {
  if (!moduleKey) return true; // itens sem módulo (Início) sempre aparecem
  const perms = permsOf(user);
  if (semRestricao(perms)) return true;
  const acoes = perms[moduleKey];
  return Array.isArray(acoes) && acoes.length > 0;
}

/** Pode ALTERAR (qualquer ação de escrita) no módulo? (para as ações) */
export function canWriteModule(moduleKey, user) {
  if (!moduleKey) return true;
  const perms = permsOf(user);
  if (semRestricao(perms)) return true;
  const acoes = perms[moduleKey];
  return Array.isArray(acoes) && acoes.some((a) => a !== "ver");
}

/** Pode uma ação específica no módulo? (ex.: can("cadastros","excluir")) */
export function can(moduleKey, action, user) {
  if (!moduleKey) return true;
  const perms = permsOf(user);
  if (semRestricao(perms)) return true;
  const acoes = perms[moduleKey];
  return Array.isArray(acoes) && acoes.includes(action);
}
