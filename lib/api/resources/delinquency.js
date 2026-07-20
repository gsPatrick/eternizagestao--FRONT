import { api } from "@/lib/api/client";

// Painel de devedores agrupado por pagador — LISTA paginada → { data, meta }.
// Cada linha: { person, overdueCount, overdueTotal, oldestDueDate,
//   oldestDaysOverdue, graves[{id,code,isBlocked}], blocked, lastNotifiedAt,
//   billings[{id,code,description,referencePeriod,dueDate,daysOverdue,totalAmount,graveId,graveCode}] }
export const getPanel = (params, opts) =>
  api.get("/delinquency", { params, meta: true, ...opts });

// Resumo/aging: { overdueBillings, overdueTotal, delinquentPayers,
//   pendingReceivable, totalReceivable, delinquencyRate, blockedGraves,
//   aging[{label,minDays,maxDays,total,count}] }
export const getSummary = (opts) => api.get("/delinquency/summary", opts);

// Ações por pagador (personId)
export const blockPayer = (personId, reason) =>
  api.post(`/delinquency/payers/${personId}/block`, reason ? { reason } : {});
export const unblockPayer = (personId) =>
  api.post(`/delinquency/payers/${personId}/unblock`, {});
export const notifyPayer = (personId) =>
  api.post(`/delinquency/payers/${personId}/notify`, {});

// Ações em lote
export const notifyAll = () => api.post("/delinquency/notify-all", {});
export const syncBlocks = () => api.post("/delinquency/sync-blocks", {});
