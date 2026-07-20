import { api } from "@/lib/api/client";

/* ============================================================================
 * Capelas (chapels) — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/chapels/chapels.routes.js.
 * As rotas de lista/criação são aninhadas em cemitério; as demais são diretas.
 * ==========================================================================*/

// LISTA paginada por cemitério → { meta:true } → { data, meta }.
// params: { page?, perPage?, active? }
export const listChapels = (cemeteryId, params, opts) =>
  api.get(`/cemeteries/${cemeteryId}/chapels`, { params, meta: true, ...opts });

export const getChapel = (id, opts) => api.get(`/chapels/${id}`, opts);

// body: { name, code?, capacity?, active?, notes? }
export const createChapel = (cemeteryId, body) =>
  api.post(`/cemeteries/${cemeteryId}/chapels`, body);

export const updateChapel = (id, body) => api.patch(`/chapels/${id}`, body);
export const removeChapel = (id) => api.del(`/chapels/${id}`);

/* ---- CONSUMO de outra feature (cemetery-structure) -----------------------
 * A agenda precisa descobrir o cemitério ativo (e suas capelas). Não editamos
 * essa feature; apenas listamos os cemitérios do tenant.                     */
export const listCemeteries = (opts) => api.get("/cemeteries", { meta: true, ...opts });
