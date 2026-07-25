import { api } from "@/lib/api/client";

/* ============================================================================
 * Perfis de permissão (RBAC customizável) — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/roles/roles.routes.js (todos
 * authorize('admin'), tenant-scoped):
 *   GET    /roles/catalog   módulos × ações disponíveis (monta os checkboxes)
 *   GET    /roles           lista os perfis (3 de sistema + customizados)
 *   GET    /roles/:id       item único
 *   POST   /roles           cria perfil customizado
 *   PATCH  /roles/:id       edita perfil customizado (sistema é somente-leitura)
 *   DELETE /roles/:id       exclui (bloqueado se for de sistema ou estiver em uso)
 *
 * O `baseRole` (admin|operador|consulta) é o TETO herdado: as permissões são
 * clampadas a ele no backend. Por isso o perfil de SISTEMA de cada baseRole
 * funciona como o "teto" exibido na tela (checkbox fora do teto fica travado).
 * ==========================================================================*/

export const getRolesCatalog = (opts) => api.get("/roles/catalog", opts);
export const listRoles = (opts) => api.get("/roles", opts);
export const getRole = (id, opts) => api.get(`/roles/${id}`, opts);
export const createRole = (body) => api.post("/roles", body);
export const updateRole = (id, body) => api.patch(`/roles/${id}`, body);
export const removeRole = (id) => api.del(`/roles/${id}`);

// Rótulo/tonalidade por baseRole — reaproveitado nas telas de perfis e usuários.
export const BASE_ROLE_META = {
  admin: { label: "Administrador", tone: "navy" },
  operador: { label: "Operador", tone: "info" },
  consulta: { label: "Consulta", tone: "neutral" },
};

// Total de ações concedidas num mapa de permissões { modulo: [acoes] }.
export function countPermissions(permissions = {}) {
  return Object.values(permissions || {}).reduce(
    (sum, actions) => sum + (Array.isArray(actions) ? actions.length : 0),
    0
  );
}
