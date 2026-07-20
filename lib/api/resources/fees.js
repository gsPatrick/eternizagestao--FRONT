import { api } from "@/lib/api/client";

// =============================================================================
// Taxas de manutenção — catálogo de tipos (fee-types) + taxas por jazigo
// (maintenance-fees). Funções finas, uma por endpoint.
// Paths/params reais de:
//   src/features/fee-types/fee-types.routes.js
//   src/features/maintenance-fees/maintenance-fees.routes.js
// =============================================================================

// ---- Catálogo de tipos de taxa (fee-types) ----------------------------------
// Catálogo pequeno por tenant → lista COMPLETA (sem paginação, devolve o array).
// Cada item: { id, name, description, defaultAmount, periodicity, active, inUse }.
export const listFeeTypes = (opts) => api.get("/fee-types", opts);
export const getFeeType = (id, opts) => api.get(`/fee-types/${id}`, opts);
export const createFeeType = (body) => api.post("/fee-types", body);
export const updateFeeType = (id, body) => api.patch(`/fee-types/${id}`, body);
export const deleteFeeType = (id) => api.del(`/fee-types/${id}`);

// ---- Taxas aplicadas por jazigo (maintenance-fees) --------------------------
// LISTA paginada → { meta: true } → devolve { data, meta }.
// Cada linha inclui: grave{id,code}, feeType, payer{id,fullName}, amount,
//   periodicity, nextDueDate, lastAdjustedAt, adjustmentNotes,
//   adjustments[{date,from,to,reason}], status.
// Filtros aceitos: graveId, payerPersonId, status, page, perPage.
export const listFees = (params, opts) =>
  api.get("/maintenance-fees", { params, meta: true, ...opts });

export const getFee = (id, opts) => api.get(`/maintenance-fees/${id}`, opts);

// body: { graveId, feeTypeId, payerPersonId, amount?, periodicity?,
//   dueDay?, dueMonth?, nextDueDate?, concessionId?, notes? }
export const createFee = (body) => api.post("/maintenance-fees", body);
export const updateFee = (id, body) => api.patch(`/maintenance-fees/${id}`, body);

// Ciclo de vida da taxa (encerrada é estado final).
export const suspendFee = (id) => api.patch(`/maintenance-fees/${id}/suspend`, {});
export const reactivateFee = (id) => api.patch(`/maintenance-fees/${id}/reactivate`, {});
export const terminateFee = (id) => api.patch(`/maintenance-fees/${id}/terminate`, {});

// Reajuste individual — { newAmount } (absoluto) OU { percent } + reason.
// Registra o item no histórico (campo adjustments).
export const adjustFee = (id, body) => api.patch(`/maintenance-fees/${id}/adjust`, body);

// Reajuste EM LOTE das taxas ativas de um tipo — { feeTypeId, percent|newAmount,
//   reason?, dryRun? }. dryRun=true → prévia { dryRun, affected, sample[{id,from,to}] }
//   sem gravar; dryRun=false → { dryRun, adjusted, ids }.
export const batchAdjustFees = (body) => api.post("/maintenance-fees/batch-adjust", body);

// ---- Opções para os seletores do formulário "Aplicar taxa" ------------------
// Jazigos: cada linha traz owner{ concessionId, person{ id, fullName } } → usado
// para preencher o pagador com o concessionário atual (automático).
export const listGraveOptions = (opts) =>
  api.get("/graves", { params: { perPage: 100, sort: "code" }, meta: true, ...opts });

// Pessoas (pagador alternativo).
export const listPayerOptions = (opts) =>
  api.get("/people", { params: { perPage: 100 }, meta: true, ...opts });
