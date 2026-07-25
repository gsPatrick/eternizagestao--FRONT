/**
 * CATÁLOGO DE PERMISSÕES (RBAC) — fonte única da verdade dos RECURSOS × AÇÕES no
 * front. Espelha, chave por chave, o catálogo do backend
 * (src/features/roles/permissions.catalog.js) e a matriz "Permissões por perfil"
 * que o cliente já usa na tela de usuários.
 *
 * Usado por:
 *  - app/painel/usuarios/page.js  → matriz bonita (uma coluna por PERFIL, marcas
 *    lidas das permissões reais de cada Role).
 *  - app/painel/configuracoes/perfis/page.js → mesma matriz com CHECKBOXES para
 *    criar/editar um perfil (nome + marcações).
 *
 * As `key` são o contrato com a API (role.permissions = { recurso: [acoes] }); os
 * `label` são só apresentação. NÃO mude uma key sem mudar o backend junto.
 */
export const PERMISSION_MODULES = [
  {
    key: "cadastros",
    label: "Cadastros",
    desc: "Sepulturas, pessoas, concessões e sepultados",
    actions: [
      { key: "ver", label: "Visualizar" },
      { key: "criar", label: "Criar" },
      { key: "editar", label: "Editar" },
      { key: "excluir", label: "Excluir" },
      { key: "bloquear", label: "Bloquear jazigo" },
    ],
  },
  {
    key: "sepultados",
    label: "Sepultados & exumações",
    desc: "Registros, agendamentos e autorizações",
    actions: [
      { key: "ver", label: "Visualizar" },
      { key: "registrar", label: "Registrar / agendar" },
      { key: "autorizar", label: "Autorizar exumação" },
    ],
  },
  {
    key: "financeiro",
    label: "Financeiro",
    desc: "Cobranças, baixas e 2ª via",
    actions: [
      { key: "ver", label: "Visualizar" },
      { key: "gerar", label: "Gerar cobrança" },
      { key: "baixar", label: "Registrar pagamento" },
      { key: "cancelar", label: "Cancelar / estornar" },
    ],
  },
  {
    key: "documentos",
    label: "Documentos",
    desc: "Certidões, autorizações e recibos",
    actions: [
      { key: "ver", label: "Visualizar" },
      { key: "emitir", label: "Emitir / 2ª via" },
      { key: "cancelar", label: "Cancelar" },
    ],
  },
  {
    key: "mapa",
    label: "Mapa",
    desc: "Ortofoto, camadas e demarcação",
    actions: [
      { key: "ver", label: "Visualizar" },
      { key: "editar", label: "Demarcar / importar ortofoto" },
    ],
  },
  {
    key: "relatorios",
    label: "Relatórios & exportações",
    desc: "Indicadores e exportação de dados",
    actions: [
      { key: "ver", label: "Visualizar relatórios" },
      { key: "exportar", label: "Exportar dados" },
    ],
  },
  {
    key: "importacoes",
    label: "Importação de legado",
    desc: "Planilhas e migração histórica",
    actions: [
      { key: "enviar", label: "Enviar / validar lote" },
      { key: "confirmar", label: "Confirmar em produção" },
    ],
  },
  {
    key: "auditoria",
    label: "Auditoria",
    desc: "Trilha imutável de ações",
    actions: [{ key: "ver", label: "Consultar trilha" }],
  },
  {
    key: "usuarios",
    label: "Usuários & configurações",
    desc: "Perfis, convites e parâmetros",
    actions: [{ key: "gerenciar", label: "Gerenciar tudo" }],
  },
];

// Uma permissão está concedida quando a ação consta no array do recurso.
export function hasPermission(permissions, moduleKey, actionKey) {
  const actions = permissions && permissions[moduleKey];
  return Array.isArray(actions) && actions.includes(actionKey);
}

// Total de ações marcadas num mapa { recurso: [acoes] }.
export function countPermissions(permissions = {}) {
  return Object.values(permissions || {}).reduce(
    (sum, actions) => sum + (Array.isArray(actions) ? actions.length : 0),
    0
  );
}
