import { api } from "@/lib/api/client";

// LISTA paginada de concessões → { meta: true } → devolve { data, meta }.
// params aceitos pela API: page, perPage, status ('ativa'|'vencida'|... ou o
// pseudo-status 'a_vencer'), type ('perpetua'|'temporaria'), search, personId.
export const listConcessions = (params, opts) =>
  api.get("/concessions", { params, meta: true, ...opts });

// Contadores dos cartões/chips: { active, perpetual, expiring, expired, total, byStatus }.
export const getConcessionsSummary = (opts) =>
  api.get("/concessions/summary", opts);

// Detalhe: concessão + person + grave (status/lote/rua/quadra) + maintenanceFees + transfers.
export const getConcession = (id, opts) =>
  api.get(`/concessions/${id}`, opts);

// Emissão de concessão numa sepultura sem concessão ativa.
export const issueConcession = (graveId, body) =>
  api.post(`/graves/${graveId}/concessions`, body);

// Transferência de titularidade (encerra a origem como 'transferida' e emite nova).
export const transferConcession = (id, body) =>
  api.post(`/concessions/${id}/transfer`, body);

// Renovação: estende a vigência de uma concessão temporária. body: { endDate }.
export const renewConcession = (id, body) =>
  api.patch(`/concessions/${id}/renew`, body);

// Encerramento da concessão (jazigo fica sem concessão ativa).
export const terminateConcession = (id) =>
  api.patch(`/concessions/${id}/terminate`, {});
