import { api } from "@/lib/api/client";

// Feature: deceased (Sepultados). Paths/params reais de
// src/features/deceased/deceased.routes.js.

// LISTA paginada → { meta: true } → devolve { data, meta }.
// params reais: page, perPage, search, currentLocationType, deathFrom, deathTo,
//   blockId, cemeteryId. Cada linha traz: id, fullName, cpf, birthDate,
//   deathDate, deathTime, gender, currentLocationType, currentGraveId,
//   currentGrave{ code, unitType, status, parentGrave, lot{ street{ block } } },
//   responsible{ id, name }, lastBurialDate.
export const listDeceased = (params, opts) =>
  api.get("/deceased", { params, meta: true, ...opts });

// Contadores por situação → { total, byLocation: { sepultado, ossario, ... } }.
// Aceita os mesmos filtros de busca/data (ignora currentLocationType).
export const getLocationCounts = (params, opts) =>
  api.get("/deceased/location-counts", { params, ...opts });

// Detalhe → objeto único com currentGrave (hierarquia + parentGrave),
// burials[grave], exhumations[grave/destinationGrave/destinationNiche],
// remainsDeposits[niche/originGrave], responsible.
export const getDeceased = (id, opts) => api.get(`/deceased/${id}`, opts);

export const createDeceased = (body) => api.post("/deceased", body);
export const updateDeceased = (id, body) => api.patch(`/deceased/${id}`, body);
export const deleteDeceased = (id) => api.del(`/deceased/${id}`);
