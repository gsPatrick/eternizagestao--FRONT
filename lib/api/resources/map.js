import { api } from "@/lib/api/client";

/* ============================================================================
 * Mapa do cemitério — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/map (map.routes.js):
 *   - ortofotos (base do mapa, camadas)
 *   - malha de caminhos GPS (map_paths — traçado do visitante)
 *   - geometria/demarcação da sepultura sobre a ortofoto
 * Sem estado, sem React. Adapters de apresentação no fim do arquivo.
 *
 * NOTA de coordenadas: o componente de mapa (MapExplorer) opera num plano
 * ilustrativo (WORLD 800x500). A API guarda pathCoordinates/geoPolygon como
 * JSONB agnóstico ([[x,y], ...]) — então o traçado feito no SVG faz round-trip
 * fiel sem tocar no componente. Quando o cemitério ganhar ortofoto real
 * georreferenciada, os mesmos endpoints passam a guardar lat/lng.
 * ==========================================================================*/

// ---- ortofotos ------------------------------------------------------------
// LISTA (não paginada) → devolve array de ortofotos do cemitério.
export const listOrthophotos = (cemeteryId, opts) =>
  api.get(`/cemeteries/${cemeteryId}/orthophotos`, opts);

// body: { name (obrigatório), contentBase64?, fileName?, mimeType?, fileUrl?,
//         bounds?, widthPx?, heightPx?, resolutionCmPx?, capturedAt?, setActive? }
export const uploadOrthophoto = (cemeteryId, body) =>
  api.post(`/cemeteries/${cemeteryId}/orthophotos`, body);

// body: { name?, bounds?, widthPx?, heightPx?, resolutionCmPx?, capturedAt?, isActive? }
export const updateOrthophoto = (id, body) =>
  api.patch(`/orthophotos/${id}`, body);

// ---- malha de caminhos (GPS) ---------------------------------------------
// LISTA (não paginada) → array de caminhos ativos do cemitério.
export const listMapPaths = (cemeteryId, opts) =>
  api.get(`/cemeteries/${cemeteryId}/map-paths`, opts);

// body: { pathCoordinates ([[x,y], ...] 2+ pontos, obrigatório), name?, notes? }
export const createMapPath = (cemeteryId, body) =>
  api.post(`/cemeteries/${cemeteryId}/map-paths`, body);

export const removeMapPath = (id) => api.del(`/map-paths/${id}`);

// ---- geometria da sepultura (demarcação sobre a ortofoto) -----------------
// body: { geoPolygon? ([[x,y], ...] 3+ pontos), latitude?, longitude? }
export const setGraveGeometry = (graveId, body) =>
  api.patch(`/graves/${graveId}/geometry`, body);

/* ============================================================================
 * Adapters de apresentação — mapeiam o shape da API para o shape que a página
 * do mapa consome (o front é a fonte da verdade).
 * ==========================================================================*/

// caminho da API → item consumido pelo painel e pelo MapExplorer
// (a página usa { id, name, points }).
export function adaptMapPath(p, index = 0) {
  return {
    id: p.id,
    name: p.name || `Caminho ${index + 1}`,
    points: Array.isArray(p.pathCoordinates) ? p.pathCoordinates : [],
    notes: p.notes || null,
    raw: p,
  };
}

// ortofoto da API → info consumida pela página
export function adaptOrthophoto(o) {
  return {
    id: o.id,
    name: o.name,
    fileUrl: o.fileUrl,
    bounds: o.bounds || null,
    active: Boolean(o.isActive),
    capturedAt: o.capturedAt || null,
    resolutionCmPx: o.resolutionCmPx != null ? Number(o.resolutionCmPx) : null,
    raw: o,
  };
}

// há ortofoto ativa neste cemitério?
export function hasActiveOrthophoto(list = []) {
  return list.some((o) => o.isActive);
}
