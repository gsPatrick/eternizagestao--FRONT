import { api } from "@/lib/api/client";

/* ============================================================================
 * Sepultamentos (burials) — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/burials/burials.routes.js.
 * Sem estado, sem React. O front é a fonte da verdade do shape consumido pela
 * página; os adapters ao final mapeiam o payload da API para o modelo de linha
 * que app/painel/sepultamentos já renderiza.
 *
 * Endpoints de OUTRAS features (schedules/documents/deceased/graves/people) ficam
 * marcados como CONSUMO — chamamos como estão, sem editar aquelas features.
 * ==========================================================================*/

// ---- burials --------------------------------------------------------------
// LISTA paginada → { meta:true } → { data, meta }. params: page, perPage, search,
// status, burialFrom, burialTo, cemeteryId, graveId, deceasedId. Cada linha traz
// deceased, grave{status,geoPolygon}, declarant e authorizationDocument{id,fileUrl}.
export const listBurials = (params, opts) =>
  api.get("/burials", { params, meta: true, ...opts });

// StatCards da tela → { total, monthCount, yearCount, exhumedCount, transferredCount, byStatus }
export const getBurialsStats = (params, opts) =>
  api.get("/burials/stats", { params, ...opts });

export const getBurial = (id, opts) => api.get(`/burials/${id}`, opts);

// registrar sepultamento. body: { graveId, deceasedId, burialDate, burialTime?,
//   declarantPersonId?, funeralHome?, notes?, autoAuthorize? }. A API auto-emite a
//   Autorização de Sepultamento (autoAuthorize !== false) e devolve o burial já
//   com authorizationNumber + authorizationDocument.
export const createBurial = (body) => api.post("/burials", body);

/* ---- CONSUMO de outras features (não editamos) --------------------------- */

// "Agendados hoje" → { total, byType:{ velorio, sepultamento, exumacao } }
export const getSchedulesTodayCount = (opts) =>
  api.get("/schedules/today-count", opts);

// documentos oficiais — 2ª via (nova emissão copiando refs) e emissão avulsa da
// autorização (quando o sepultamento ainda não tem documento vinculado).
export const reissueDocument = (id) => api.post(`/documents/${id}/reissue`, {});
export const issueBurialAuthorization = (burialId, extra) =>
  api.post("/documents", {
    documentType: "autorizacao_sepultamento",
    referenceType: "burial",
    referenceId: burialId,
    ...extra,
  });

// pickers do modal de registro
export const listDeceasedForBurial = (params, opts) =>
  api.get("/deceased", { params, meta: true, ...opts });
export const listFreeGraves = (params, opts) =>
  api.get("/graves", { params: { statusSlug: "livre", ...params }, meta: true, ...opts });
export const listPeople = (params, opts) =>
  api.get("/people", { params, meta: true, ...opts });

/* ============================================================================
 * Adapters de apresentação — payload da API → shape que a página já consome.
 * ==========================================================================*/

// Origem da API (sem /api/v1) para montar URLs de arquivos estáticos (/files/...).
const API_ORIGIN = String(process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/v\d+\/?$/, "");

// path relativo do storage (/files/...) → URL absoluta servida pela API.
export function fileUrl(path) {
  if (!path) return null;
  return /^https?:\/\//.test(path) ? path : `${API_ORIGIN}${path}`;
}

// DATEONLY 'YYYY-MM-DD' → 'dd/mm/aaaa'
export function ymdToBr(ymd) {
  if (!ymd) return "—";
  const [y, m, d] = String(ymd).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}

// TIME 'HH:MM:SS' → 'HH:MM'
export function hm(time) {
  if (!time) return "—";
  return String(time).slice(0, 5);
}

// situação do sepultamento (enum da API == chaves do STATUS_META da página)
export const BURIAL_STATUSES = ["ativo", "exumado", "transladado"];

// A tela coleta o declarante como texto livre (o design usa Input, não picker de
// pessoa). Quando não há Person vinculada (declarantPersonId), guardamos/lemos o
// nome em `notes` de forma legível, para não perder o dado nem quebrar a coluna.
export function composeBurialNotes({ declarant } = {}) {
  return declarant ? `Declarante: ${declarant}` : undefined;
}

export function declarantName(b) {
  if (b.declarant?.fullName) return b.declarant.fullName;
  const m = /^Declarante:\s*(.+)$/im.exec(b.notes || "");
  return m ? m[1].trim() : "—";
}

// linha da tabela/lista — o shape que a página desenha
export function adaptBurialRow(b) {
  return {
    id: b.id,
    date: ymdToBr(b.burialDate),
    time: hm(b.burialTime),
    deceased: b.deceased?.fullName || "—",
    deceasedId: b.deceasedId || b.deceased?.id || "",
    grave: b.grave?.code || "—",
    graveId: b.graveId || b.grave?.id || "",
    graveStatus: b.grave?.status?.name || null,
    drawer: "—",
    auth: b.authorizationNumber || "—",
    authDocId: b.authorizationDocument?.id || null,
    authUrl: fileUrl(b.authorizationDocument?.fileUrl),
    declarant: declarantName(b),
    funeral: b.funeralHome || "—",
    status: BURIAL_STATUSES.includes(b.status) ? b.status : "ativo",
    // geoPolygon do jazigo (mesmo shape do MapCanvas) para o mapa do detalhe
    shape: b.grave?.geoPolygon || null,
  };
}

// jazigo livre → opção do select do modal (vagas = capacidade - sepultamentos ativos)
export function adaptFreeGrave(g) {
  const available = g.available ?? Math.max(0, (g.capacity || 0) - (g.activeBurials || 0));
  return { id: g.id, code: g.code, available };
}

// sepultado disponível para sepultamento (ainda não sepultado) → opção do select
export function adaptDeceasedOption(d) {
  return { id: d.id, name: d.fullName, death: ymdToBr(d.deathDate) };
}

// mantém apenas quem ainda não está sepultado (a API rejeita sepultamento ativo duplo)
export function isAvailableForBurial(d) {
  return d.currentLocationType !== "sepultado";
}
