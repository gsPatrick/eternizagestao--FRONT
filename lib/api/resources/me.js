import { api } from "@/lib/api/client";
import { updateStoredUser } from "@/lib/api/session";

/* ============================================================================
 * Self-service do usuário logado (qualquer papel autenticado). Resource fino
 * sobre o client da API. Uma função por endpoint real de:
 *   - src/features/sessions/sessions.routes.js
 *   GET   /sessions/me           dados do usuário logado
 *   PATCH /sessions/me           atualiza o próprio perfil { name?, email? }
 *   PATCH /sessions/me/password  troca a própria senha { currentPassword, newPassword }
 * Sem estado, sem React.
 * ==========================================================================*/

// Dados do usuário logado.
export const getMe = (opts) => api.get("/sessions/me", opts);

// Atualiza o próprio perfil. Em caso de sucesso, sincroniza o usuário guardado
// na sessão (para o nome/e-mail refletirem no header/sidebar) preservando o
// token. 409 EMAIL_IN_USE quando o e-mail já pertence a outro usuário.
export async function updateMyProfile(body) {
  const user = await api.patch("/sessions/me", body);
  if (user) updateStoredUser(user);
  return user;
}

// Troca a própria senha. 401 INVALID_PASSWORD (senha atual errada),
// 400 WEAK_PASSWORD (nova < 6 chars). Sucesso → { ok: true }.
export const changeMyPassword = (body) => api.patch("/sessions/me/password", body);
