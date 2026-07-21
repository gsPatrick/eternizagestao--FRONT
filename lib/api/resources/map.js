import { api, apiUpload } from "@/lib/api/client";
import { fileHref } from "@/lib/api/file-url";

/* ============================================================================
 * Mapa do cemitério — resource fino sobre o client da API.
 *
 * Georreferenciamento por ORTOFOTO: a empresa carrega uma imagem aérea e a
 * posiciona (arrasta/escala/rotaciona os cantos) sobre a base OpenStreetMap
 * em coordenadas reais. Os 4 cantos (lat/lng) são salvos e, ao recarregar, a
 * ortofoto reaparece exatamente onde foi alinhada. Depois, cada sepultura é
 * demarcada como polígono (também em lat/lng) sobre a ortofoto.
 *
 * Contrato dos endpoints (base do client já inclui /api/v1):
 *   GET   /orthophotos?cemeteryId=  → [{ id, fileUrl, corners, opacity, active }]
 *   POST  /orthophotos              → { id, fileUrl }  (upload base64 + cemeteryId)
 *   PATCH /orthophotos/:id          → salva { corners, opacity, active }
 *   GET   /map/context?cemeteryId=  → { cemetery:{id,name,center}, orthophoto }
 *   GET   /graves?cemeteryId=       → sepulturas (com geoPolygon/latitude/longitude)
 *   PATCH /graves/:id/geometry      → { geoPolygon, latitude, longitude }
 *
 * Sem estado, sem React. Adapters de apresentação no fim do arquivo.
 * ==========================================================================*/

// ---- ortofotos ------------------------------------------------------------
// LISTA (não paginada) → array de ortofotos do cemitério.
export const listOrthophotos = (cemeteryId, opts) =>
  api.get("/orthophotos", { params: { cemeteryId }, ...opts });

// Upload BINÁRIO da ortofoto (arquivo cru no corpo) — aguenta imagens grandes
// de drone (dezenas de MB). Metadados (cemeteryId, fileName) vão na query.
// { cemeteryId, file } → { id, fileUrl }. opts.tenant p/ super_admin operar cidade.
export const uploadOrthophoto = ({ cemeteryId, file }, opts) =>
  apiUpload("/orthophotos", file, {
    params: { cemeteryId, fileName: file.name },
    tenant: opts?.tenant,
  });

// body: { corners:{tl,tr,br,bl}, opacity, active } — salva a posição/estado.
export const updateOrthophoto = (id, body, opts) => api.patch(`/orthophotos/${id}`, body, opts);

// Remove a ortofoto (registro + arquivo). Usada para limpar envios errados e
// ortofotos cujo arquivo se perdeu — elas ficavam na lista dando erro de carga.
export const deleteOrthophoto = (id, opts) => api.del(`/orthophotos/${id}`, opts);

// ---- contexto do mapa (centro do cemitério + ortofoto ativa) --------------
export const getMapContext = (cemeteryId, opts) =>
  api.get("/map/context", { params: { cemeteryId }, ...opts });

// ---- sepulturas com geometria (para renderizar/demarcar no mapa) ----------
// LISTA paginada (perPage alto) → { data, meta }. Traz geoPolygon/lat/long.
export const listMapGraves = (cemeteryId, opts) =>
  api.get("/graves", { params: { cemeteryId, perPage: 500 }, meta: true, ...opts });

// demarcação: body: { geoPolygon:[[lat,lng],...], latitude, longitude }
export const setGraveGeometry = (graveId, body) =>
  api.patch(`/graves/${graveId}/geometry`, body);

/* ============================================================================
 * Helpers de coordenadas
 * ==========================================================================*/

function numOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// aceita [lat,lng] (array) ou {lat,lng}/{latitude,longitude} → [lat,lng] ou null
function pair(v) {
  if (Array.isArray(v) && v.length >= 2) {
    const lat = numOrNull(v[0]);
    const lng = numOrNull(v[1]);
    return lat === null || lng === null ? null : [lat, lng];
  }
  if (v && typeof v === "object") {
    const lat = numOrNull(v.lat ?? v.latitude);
    const lng = numOrNull(v.lng ?? v.lon ?? v.longitude);
    return lat === null || lng === null ? null : [lat, lng];
  }
  return null;
}

// normaliza os 4 cantos → { tl, tr, br, bl } com [lat,lng] em cada, ou null
export function normalizeCorners(c) {
  if (!c || typeof c !== "object") return null;
  const tl = pair(c.tl);
  const tr = pair(c.tr);
  const br = pair(c.br);
  const bl = pair(c.bl);
  if (!tl || !tr || !br || !bl) return null;
  return { tl, tr, br, bl };
}

// geoPolygon → array de [lat,lng] (aceita [lat,lng] ou {lat,lng})
function normalizePolygon(poly) {
  if (!Array.isArray(poly)) return null;
  const pts = poly.map(pair).filter(Boolean);
  return pts.length >= 3 ? pts : null;
}

/* ============================================================================
 * Adapters de apresentação — o FRONT é a fonte da verdade do shape consumido.
 * ==========================================================================*/

// ortofoto da API → shape consumido pela página/mapa
export function adaptOrthophoto(o) {
  if (!o) return null;
  return {
    id: o.id,
    // ABSOLUTA: a URL assinada vem relativa e o <img> do overlay resolveria
    // contra a origem do FRONT (a foto nunca aparecia no mapa).
    fileUrl: fileHref(o.fileUrl || o.url || null),
    corners: normalizeCorners(o.corners),
    opacity: o.opacity != null ? Number(o.opacity) : 1,
    active: o.active != null ? Boolean(o.active) : Boolean(o.isActive),
    raw: o,
  };
}

// camada de quadra/rua/lote → item com polígono normalizado (ou null se sem geom)
function adaptLayerFeature(f) {
  if (!f) return null;
  return {
    id: f.id,
    code: f.code || null,
    name: f.name || null,
    geoPolygon: normalizePolygon(f.geoPolygon),
  };
}

// lista de camada → só os que têm geometria desenhável ([[lat,lng],...])
function adaptLayerList(list) {
  return (Array.isArray(list) ? list : [])
    .map(adaptLayerFeature)
    .filter((f) => f && f.geoPolygon);
}

// contexto do mapa → { center:[lat,lng]|null, name, orthophoto, layers }
export function adaptMapContext(ctx) {
  const c = (ctx && ctx.cemetery) || {};
  const l = (ctx && ctx.layers) || {};
  return {
    center: pair(c.center),
    name: c.name || null,
    orthophoto: ctx && ctx.orthophoto ? adaptOrthophoto(ctx.orthophoto) : null,
    layers: {
      blocks: adaptLayerList(l.blocks),
      streets: adaptLayerList(l.streets),
      lots: adaptLayerList(l.lots),
    },
  };
}

// sepultura da API → item consumido pelo mapa/busca
export function adaptMapGrave(g) {
  const block = g.lot?.street?.block;
  const owner = g.owner?.person?.fullName || g.owner?.fullName;
  return {
    id: g.id,
    code: g.code || "—",
    status: g.status?.slug || "livre",
    statusName: g.status?.name || null,
    occupant: owner || null,
    block: block?.name || block?.code || null,
    geoPolygon: normalizePolygon(g.geoPolygon),
    latitude: numOrNull(g.latitude),
    longitude: numOrNull(g.longitude),
    mapped: Boolean(g.geoPolygon) || (g.latitude != null && g.longitude != null),
    raw: g,
  };
}

// centro entre vários cemitérios (quando há 2+ e o selecionado não tem centro)
export function averageCenter(points = []) {
  const valid = points.map(pair).filter(Boolean);
  if (!valid.length) return null;
  const sum = valid.reduce((a, [lat, lng]) => [a[0] + lat, a[1] + lng], [0, 0]);
  return [sum[0] / valid.length, sum[1] / valid.length];
}
