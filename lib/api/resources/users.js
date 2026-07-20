import { api } from "@/lib/api/client";

/* ============================================================================
 * Usuários & controle de acesso (RBAC) — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/users/users.routes.js:
 *   GET    /users                     lista paginada
 *   GET    /users/:id                 item único
 *   POST   /users                     cria (com senha)
 *   POST   /users/invite              CONVIDA (senha temporária + e-mail via fila)
 *   PATCH  /users/:id                 edita (name, email, role)
 *   PATCH  /users/:id/activate        reativa
 *   PATCH  /users/:id/deactivate      desativa
 *   POST   /users/:id/password-reset  envia link de redefinição (e-mail via fila)
 *   POST   /users/:id/resend-invite   reenvia convite (e-mail via fila)
 *   DELETE /users/:id                 remove (soft delete)
 * Sem estado, sem React. Adapter de apresentação no fim do arquivo.
 * ==========================================================================*/

// LISTA paginada → { meta:true } → { data, meta }. perPage alto: a página
// calcula contadores/stats por perfil e situação sobre o conjunto carregado.
export const listUsers = (params, opts) =>
  api.get("/users", { params: { perPage: 100, ...params }, meta: true, ...opts });

export const getUserById = (id, opts) => api.get(`/users/${id}`, opts);

export const createUser = (body) => api.post("/users", body);
export const inviteUser = (body) => api.post("/users/invite", body);
export const updateUser = (id, body) => api.patch(`/users/${id}`, body);
export const activateUser = (id) => api.patch(`/users/${id}/activate`, {});
export const deactivateUser = (id) => api.patch(`/users/${id}/deactivate`, {});
export const resetUserPassword = (id) => api.post(`/users/${id}/password-reset`, {});
export const resendUserInvite = (id) => api.post(`/users/${id}/resend-invite`, {});
export const removeUser = (id) => api.del(`/users/${id}`);

/* ============================================================================
 * Adapter de apresentação — mapeia o shape da API para o shape que a página
 * de usuários consome (o front é a fonte da verdade).
 *
 * A API guarda `active` (boolean) e `lastLoginAt`. A página trabalha com três
 * situações — derivadas sem novas colunas no banco:
 *   inativo  → active === false
 *   pendente → ativo mas nunca acessou (convite não aceito): lastLoginAt vazio
 *   ativo    → ativo e já acessou ao menos uma vez
 * ==========================================================================*/

function pad(n) {
  return String(n).padStart(2, "0");
}

// ISO → { date: "dd/mm/aaaa", time: "HH:MM" } (horário local)
function splitDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function userStatus(u) {
  if (!u.active) return "inativo";
  if (!u.lastLoginAt) return "pendente";
  return "ativo";
}

// usuário da API → linha/detalhe consumidos pela página.
// `currentUserId` marca a própria conta ("você") — não pode se autodesativar.
export function adaptUser(u, currentUserId) {
  const status = userStatus(u);
  const lastAccess = splitDateTime(u.lastLoginAt);
  const invited = splitDateTime(u.createdAt);
  const invitedAt = invited ? invited.date : "—";

  // Sem trilha de sessões por usuário na API: montamos um único registro a
  // partir do último acesso (sem IP/dispositivo, que não temos aqui).
  const accesses = lastAccess
    ? [{ when: `${lastAccess.date} · ${lastAccess.time}`, meta: "Acesso ao painel" }]
    : [];

  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || "", // a API de usuários ainda não persiste telefone
    role: u.role,
    status,
    you: currentUserId != null && u.id === currentUserId,
    lastAccess,
    invitedAt,
    accesses,
    raw: u,
  };
}

export function adaptUsers(rows = [], currentUserId) {
  return rows.map((u) => adaptUser(u, currentUserId));
}
