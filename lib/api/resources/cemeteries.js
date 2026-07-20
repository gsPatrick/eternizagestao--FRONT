import { api } from "@/lib/api/client";

/* ============================================================================
 * Cemitérios + estrutura física (quadras → ruas → lotes) — resource fino sobre
 * o client da API. Uma função por endpoint real de:
 *   - src/features/cemeteries/cemeteries.routes.js
 *   - src/features/cemetery-structure/cemetery-structure.routes.js
 * A importação/gestão da ortofoto vive na feature `map` (não editamos): as
 * funções ficam ao final marcadas como CONSUMO.
 * Sem estado, sem React. Adapters de apresentação no fim do arquivo.
 * ==========================================================================*/

// ---- cemeteries -----------------------------------------------------------
// LISTA paginada → { meta:true } → { data, meta }
export const listCemeteries = (params, opts) =>
  api.get("/cemeteries", { params, meta: true, ...opts });

// item único → cemitério + stats agregadas
export const getCemetery = (id, opts) => api.get(`/cemeteries/${id}`, opts);

export const createCemetery = (body) => api.post("/cemeteries", body);
export const updateCemetery = (id, body) => api.patch(`/cemeteries/${id}`, body);
export const removeCemetery = (id) => api.del(`/cemeteries/${id}`);

// ---- cemetery-structure (árvore quadra → rua → lote) ----------------------
// árvore completa → { cemetery, blocks:[{...block, stats, streets:[{...street, stats, lots:[{...lot, stats}]}]}] }
export const getStructure = (cemeteryId, opts) =>
  api.get(`/cemeteries/${cemeteryId}/structure`, opts);

// criação por nível (name + code obrigatórios em todos os níveis)
export const createBlock = (cemeteryId, body) =>
  api.post(`/cemeteries/${cemeteryId}/blocks`, body);
export const createStreet = (blockId, body) =>
  api.post(`/blocks/${blockId}/streets`, body);
export const createLot = (streetId, body) =>
  api.post(`/streets/${streetId}/lots`, body);

/* ---- CONSUMO da feature `map` (importação de ortofoto) — não editada ------ */
export const listOrthophotos = (cemeteryId, opts) =>
  api.get(`/cemeteries/${cemeteryId}/orthophotos`, opts);
// body: { name, contentBase64?, fileName?, mimeType?, fileUrl?, bounds?, setActive? }
export const uploadOrthophoto = (cemeteryId, body) =>
  api.post(`/cemeteries/${cemeteryId}/orthophotos`, body);

/* ============================================================================
 * Adapters de apresentação — mapeiam o shape da API para o shape que as
 * páginas de cemitérios já consomem (o front é a fonte da verdade).
 * ==========================================================================*/

// cores de marca padrão (identidade navy Eterniza) quando o cemitério não
// tem cores próprias configuradas ainda.
const DEFAULT_COLOR = "#032e59";
const DEFAULT_COLOR2 = "#5b8ac2";

// "Cidade — UF" a partir dos campos de endereço
export function cityLabel(c) {
  const city = c.addressCity?.trim();
  const uf = c.addressState?.trim();
  if (city && uf) return `${city} — ${uf}`;
  return city || uf || "—";
}

// endereço em uma linha: "Rua, número · bairro"
export function addressLabel(c) {
  const line1 = [c.addressStreet, c.addressNumber].filter(Boolean).join(", ");
  const parts = [line1, c.addressDistrict].filter(Boolean);
  return parts.join(" · ") || "—";
}

// "lat, lng" (6 casas) a partir das coordenadas de entrada
export function entranceLabel(c) {
  const lat = c.entranceLatitude;
  const lng = c.entranceLongitude;
  if (lat === null || lat === undefined || lng === null || lng === undefined) return "";
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

// cemitério da API → card/hero do front
export function adaptCemetery(c) {
  const s = c.stats || {};
  return {
    id: c.id,
    name: c.name,
    code: c.code || "—",
    city: cityLabel(c),
    address: addressLabel(c),
    color: c.brandPrimaryColor || DEFAULT_COLOR,
    color2: c.brandSecondaryColor || DEFAULT_COLOR2,
    organ: c.managerName || "—",
    active: c.active,
    ortofoto: Boolean(s.hasOrthophoto),
    stats: {
      blocks: s.blocks ?? 0,
      streets: s.streets ?? 0,
      lots: s.lots ?? 0,
      graves: s.graves ?? 0,
      occupancy: s.occupancy ?? 0,
    },
    entrance: entranceLabel(c),
    raw: c,
  };
}

// árvore da API → estrutura quadra→rua→lote consumida pelo detalhe
export function adaptStructure(blocks = []) {
  return blocks.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
    geo: Boolean(b.geoPolygon),
    streets: (b.streets || []).map((s) => ({
      id: s.id,
      code: s.code,
      name: s.name,
      geo: Boolean(s.geoPolygon),
      lots: (s.lots || []).map((l) => ({
        id: l.id,
        code: l.code,
        name: l.name,
        graves: l.stats?.graves ?? 0,
        free: l.stats?.free ?? 0,
      })),
    })),
  }));
}

// primeira letra do "último nome" — usada no logo/avatar do cemitério
export function cemeteryInitial(name = "") {
  const last = name.trim().split(/\s+/).pop() || "?";
  return last[0]?.toUpperCase() || "?";
}
