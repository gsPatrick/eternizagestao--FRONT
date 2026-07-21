import { api } from "@/lib/api/client";

/* ============================================================================
 * Exumações — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/exhumations.
 * O FRONT é a fonte da verdade do shape: os adapters no fim mapeiam o retorno
 * da API para o shape que a página app/painel/exumacoes já consome, sem que a
 * página precise conhecer os includes/campos crus da API.
 * ==========================================================================*/

// LISTA paginada → { meta:true } → { data, meta }.
// params reais: page, perPage, status, graveId, deceasedId, cemeteryId.
// Cada linha traz: deceased{fullName}, grave{code}, requestedBy{fullName},
// destinationGrave{code}, destinationNiche{code}.
export const listExhumations = (params, opts) =>
  api.get("/exhumations", { params, meta: true, ...opts });

// Indicadores da tela → { total, inProgress, awaitingAuthorization,
// performedThisYear, byStatus:{ solicitada, autorizada, agendada, realizada, cancelada } }.
export const getExhumationStats = (params, opts) =>
  api.get("/exhumations/stats", { params, ...opts });

export const getExhumation = (id, opts) => api.get(`/exhumations/${id}`, opts);

// body: { graveId, deceasedId, reason?, requestedByPersonId?, requestDate?, burialId? }
export const createExhumation = (body) => api.post("/exhumations", body);

/**
 * Exumação JÁ REALIZADA em uma chamada — usada pelo bloco "Exumação" do
 * cadastro do sepultado, onde o fato já aconteceu e não há solicitação,
 * autorização e agendamento a percorrer. A API percorre o fluxo oficial por
 * dentro, então o registro final é igual ao da tela de Exumações.
 * body: { graveId, deceasedId, destinationType, destinationOssuaryNicheId?,
 *         authorizationNumber?, performedAt?, destinationDetails? }
 */
export const registerPerformedExhumation = (body) =>
  api.post("/exhumations/performed", body);

// STEPPER — transições de estado (mantêm auditoria/concorrência na API).
// body: { authorizationNumber? }
export const authorizeExhumation = (id, body = {}) =>
  api.patch(`/exhumations/${id}/authorize`, body);
// body: { scheduledDate } (YYYY-MM-DD, obrigatório)
export const scheduleExhumation = (id, body) =>
  api.patch(`/exhumations/${id}/schedule`, body);
// body: { destinationType, destinationOssuaryNicheId?, destinationGraveId?,
//         destinationDetails?, performedAt?, performedBy? }
export const performExhumation = (id, body) =>
  api.patch(`/exhumations/${id}/perform`, body);
// body: { reason? }
export const cancelExhumation = (id, body = {}) =>
  api.patch(`/exhumations/${id}/cancel`, body);

/* ============================================================================
 * Adapters e helpers de apresentação (front = fonte da verdade do shape).
 * ==========================================================================*/

// data ISO/DATEONLY → dd/mm/aaaa. Nulo → "" (o layout já trata ausência).
export function fmtDate(value) {
  if (!value) return "";
  const d = new Date(String(value).length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}

// destino legível dos restos mortais (usa o nicho/jazigo rastreado quando houver)
function destinationDetail(e) {
  if (e.destinationType === "ossario") {
    return e.destinationNiche?.code ? `Ossário · ${e.destinationNiche.code}` : "Ossário";
  }
  if (e.destinationType === "outro_jazigo") {
    return e.destinationGrave?.code || e.destinationDetails || "Outro jazigo";
  }
  return e.destinationDetails || null;
}

// linha da lista de processos (mesmo shape que a página já renderiza)
export function adaptProcess(e) {
  return {
    id: e.id,
    number: e.processNumber || "—",
    deceased: e.deceased?.fullName || "—",
    grave: e.grave?.code || "—",
    graveId: e.graveId,
    requester: e.requestedBy?.fullName || "—",
    reason: e.reason || "—",
    status: e.status,
    requestDate: fmtDate(e.requestDate),
    authorizedAt: fmtDate(e.authorizedAt),
    scheduledDate: fmtDate(e.scheduledDate),
    performedAt: fmtDate(e.performedAt),
    destination: e.destinationType || null,
    destinationDetail: destinationDetail(e),
  };
}
