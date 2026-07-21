import { api } from "@/lib/api/client";

/* ============================================================================
 * Sepulturas (graves) — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/{graves,grave-statuses,
 * grave-timeline,grave-maintenances}. Sem estado, sem React.
 * Endpoints consumidos de outras features (concessions/burials/exhumations/
 * documents/people/deceased/cemetery-structure) ficam ao final, claramente
 * marcados como CONSUMO (não editamos aquelas features).
 * ==========================================================================*/

// ---- graves ---------------------------------------------------------------
// LISTA paginada → { meta:true } → { data, meta }
export const listGraves = (params, opts) =>
  api.get("/graves", { params, meta: true, ...opts });

// contadores por status para os chips → { total, byStatus:[{slug,name,color,count,statusId}] }
export const getGraveStatusCounts = (params, opts) =>
  api.get("/graves/status-counts", { params, ...opts });

export const getGrave = (id, opts) => api.get(`/graves/${id}`, opts);

// visão 360º: { grave (com status/lot/childGraves/concessions/burials), occupancy }
export const getGraveSummary = (id, opts) => api.get(`/graves/${id}/summary`, opts);

export const createGrave = (body) => api.post("/graves", body);
export const updateGrave = (id, body) => api.patch(`/graves/${id}`, body);
export const removeGrave = (id) => api.del(`/graves/${id}`);

// mudança de status (registra na timeline). body: { statusId?|slug?, reason? }
export const changeGraveStatus = (id, body) => api.patch(`/graves/${id}/status`, body);

export const blockGrave = (id, reason) => api.patch(`/graves/${id}/block`, { reason });
export const unblockGrave = (id) => api.patch(`/graves/${id}/unblock`, {});

// ---- grave-statuses -------------------------------------------------------
export const listGraveStatuses = (opts) => api.get("/grave-statuses", opts);

// ---- grave-timeline (somente leitura) ------------------------------------
export const getGraveTimeline = (graveId, params, opts) =>
  api.get(`/graves/${graveId}/timeline`, { params, meta: true, ...opts });

// ---- grave-maintenances ---------------------------------------------------
export const listGraveMaintenances = (graveId, opts) =>
  api.get(`/graves/${graveId}/maintenances`, opts);

// body: { maintenanceType, description?, requestedByPersonId?, startDate?, cost? }
export const createGraveMaintenance = (graveId, body) =>
  api.post(`/graves/${graveId}/maintenances`, body);

export const changeMaintenanceStatus = (id, status) =>
  api.patch(`/maintenances/${id}/status`, { status });

/* ---- CONSUMO de outras features (necessário para as telas de sepulturas) --
 * Não editamos essas features; apenas chamamos seus endpoints como estão.  */

// estrutura física (para popular filtros de quadra)
export const listCemeteries = (opts) => api.get("/cemeteries", { meta: true, ...opts });
export const listBlocks = (cemeteryId, opts) =>
  api.get(`/cemeteries/${cemeteryId}/blocks`, opts);

// pessoas / falecidos (pickers do detalhe)
export const listPeople = (params, opts) =>
  api.get("/people", { params, meta: true, ...opts });
export const listDeceased = (params, opts) =>
  api.get("/deceased", { params, meta: true, ...opts });

// concessões do jazigo (ativa + encerradas/transferidas) → histórico de titulares
export const getGraveConcessions = (graveId, opts) =>
  api.get(`/graves/${graveId}/concessions`, opts);

// concessão — transferência de titularidade
// body: { toPersonId, transferReason, kinship?, transferDate?, ... }
export const transferConcession = (concessionId, body) =>
  api.post(`/concessions/${concessionId}/transfer`, body);

// sepultamento. body: { graveId, deceasedId, burialDate, burialTime?, funeralHome?, ... }
export const createBurial = (body) => api.post("/burials", body);

// exumação. body: { graveId, deceasedId, reason?, requestedByPersonId? }
export const createExhumation = (body) => api.post("/exhumations", body);

// documentos oficiais (certidão de perpetuidade). body: { documentType, graveId, personId? }
export const issueDocument = (body) => api.post("/documents", body);
export const reissueDocument = (id) => api.post(`/documents/${id}/reissue`, {});

/* ============================================================================
 * Adapters e helpers de apresentação — mapeiam o shape da API para o shape
 * que as páginas de sepulturas já consomem (o front é a fonte da verdade).
 * ==========================================================================*/

// slug do status na API → chave usada pelo STATUS_META do front
const STATUS_SLUG_TO_FRONT = {
  livre: "livre",
  ocupada: "ocupada",
  reservada: "reservada",
  em_manutencao: "manutencao",
  interditada: "interditada",
  em_perpetuidade: "perpetuidade",
};
// e o inverso (front → slug da API) para enviar filtros
const FRONT_TO_STATUS_SLUG = Object.fromEntries(
  Object.entries(STATUS_SLUG_TO_FRONT).map(([api, front]) => [front, api])
);

export const normalizeStatusSlug = (slug) => STATUS_SLUG_TO_FRONT[slug] || slug || "livre";
export const frontStatusToApiSlug = (front) => FRONT_TO_STATUS_SLUG[front] || front;

// unitType (enum minúsculo da API) ↔ rótulo do front
const UNIT_TYPE_TO_LABEL = {
  cova: "Cova",
  jazigo: "Jazigo",
  gaveta: "Gaveta",
  tumulo: "Túmulo",
  outro: "Outro",
};
const LABEL_TO_UNIT_TYPE = Object.fromEntries(
  Object.entries(UNIT_TYPE_TO_LABEL).map(([enumV, label]) => [label, enumV])
);
export const unitTypeLabel = (t) => UNIT_TYPE_TO_LABEL[t] || t || "—";
export const labelToUnitType = (label) => LABEL_TO_UNIT_TYPE[label] || label;

// "Tipo do túmulo" (campo oficial dos modelos de documento) — opções comuns do
// cliente; o Select permite valor livre (o último item abre campo digitável).
export const TOMB_TYPE_OPTIONS = [
  "Campas ou jazigos-perpétuos",
  "Carneiras de adultos",
  "Bloco de gaveta",
  "Lápides no chão / cavas",
];

// "Utilização" — regime de uso da sepultura (Rotativo = revezamento por prazo).
export const UTILIZACAO_OPTIONS = ["Rotativo", "Perpétuo"];

// linha da tabela de listagem
export function adaptGraveRow(g) {
  const block = g.lot?.street?.block;
  const owner = g.owner?.person?.fullName;
  const occupants = (g.occupants || []).map((d) => d.fullName).filter(Boolean);
  return {
    id: g.id,
    code: g.code,
    type: unitTypeLabel(g.unitType),
    unitType: g.unitType || null,
    cemetery: g.cemetery?.name || "—",
    block: block?.name || block?.code || "—",
    street: g.lot?.street?.name || g.lot?.street?.code || "—",
    lot: g.lot?.code || g.lot?.name || "—",
    owner: owner || "—",
    // sepultado(s) atualmente na sepultura (pode ter mais de um)
    buried: occupants,
    buriedLabel: occupants.length ? occupants.join(", ") : "—",
    utilizacao: g.utilizacao || "—",
    status: normalizeStatusSlug(g.status?.slug),
    statusName: g.status?.name || null,
    occupancy: g.occupancy || `${g.activeBurials || 0}/${g.capacity || 0}`,
    mapped: Boolean(g.isMapped),
  };
}

// data ISO/DATEONLY → dd/mm/aaaa (formato usado nas telas)
export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("pt-BR");
}
