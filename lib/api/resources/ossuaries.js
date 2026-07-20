import { api } from "@/lib/api/client";
import { fmtDate } from "@/lib/api/resources/exhumations";

/* ============================================================================
 * Ossários & nichos — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/ossuaries.
 * ==========================================================================*/

// ossários de um cemitério → array (sem paginação)
export const listOssuaries = (cemeteryId, opts) =>
  api.get(`/cemeteries/${cemeteryId}/ossuaries`, opts);

export const getOssuary = (id, opts) => api.get(`/ossuaries/${id}`, opts);

// nichos de um ossário → array. Cada nicho traz `deposits` (depósito ativo com
// deceased{fullName}, originGrave{code}, exhumation{processNumber}).
// params reais: status.
export const listNiches = (ossuaryId, params, opts) =>
  api.get(`/ossuaries/${ossuaryId}/niches`, { params, ...opts });

// body: { status?, notes? }  status ∈ livre|ocupado|reservado|em_manutencao
export const updateNiche = (id, body) => api.patch(`/niches/${id}`, body);

// registrar retirada dos restos mortais de um nicho.
// body: { removalReason (obrigatório), removalDestination? }
export const removeDeposit = (depositId, body) =>
  api.post(`/deposits/${depositId}/remove`, body);

/* ---- adapters (front = fonte da verdade do shape) ---- */

// status da API (em_manutencao) → chave do NICHE_META do front (manutencao)
const NICHE_STATUS_TO_FRONT = { em_manutencao: "manutencao" };
export const nicheStatusToFront = (s) => NICHE_STATUS_TO_FRONT[s] || s || "livre";

// nicho da grade do ossário, com rastreabilidade do depósito ativo
export function adaptNiche(n) {
  const dep = (n.deposits || [])[0];
  const occupant = dep?.deceased?.fullName;
  return {
    id: n.id,
    code: n.code,
    status: nicheStatusToFront(n.status),
    ...(occupant
      ? {
          occupant,
          origin: dep?.originGrave?.code || "—",
          since: fmtDate(dep?.depositedAt) || "—",
          process: dep?.exhumation?.processNumber || "—",
          depositId: dep?.id,
        }
      : {}),
  };
}
