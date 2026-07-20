/* ============================================================================
 * Gavetas — wrapper FINO sobre o resource de sepulturas (graves).
 * Uma gaveta é uma UNIDADE do tipo `gaveta` (grave.unitType === 'gaveta').
 * Não há endpoint próprio: reusamos /graves fixando o filtro unitType=gaveta.
 * Zero duplicação de lógica de dados — só re-exportamos e pré-escopamos.
 * ==========================================================================*/
import {
  listGraves,
  getGraveStatusCounts,
  getGraveSummary,
  changeGraveStatus,
  listGraveStatuses,
  listCemeteries,
  listBlocks,
  adaptGraveRow,
  normalizeStatusSlug,
  frontStatusToApiSlug,
} from "./graves";

const DRAWER_UNIT_TYPE = "gaveta";

// LISTA paginada de gavetas → { data, meta } (mesmo shape de /graves)
export const listDrawers = (params, opts) =>
  listGraves({ ...params, unitType: DRAWER_UNIT_TYPE }, opts);

// contadores por situação (StatCards/chips) escopados a gavetas
export const getDrawerStatusCounts = (params, opts) =>
  getGraveStatusCounts({ ...params, unitType: DRAWER_UNIT_TYPE }, opts);

// re-exports úteis (detalhe/ação e filtros) — sem reimplementar nada
export {
  getGraveSummary as getDrawerSummary,
  changeGraveStatus,
  listGraveStatuses,
  listCemeteries,
  listBlocks,
  adaptGraveRow,
  normalizeStatusSlug,
  frontStatusToApiSlug,
};
