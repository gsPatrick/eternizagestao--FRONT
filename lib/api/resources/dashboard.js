import { api } from "@/lib/api/client";

/**
 * Painel consolidado do tenant (GET /dashboard).
 * Objeto único (não paginado) — devolve o conteúdo já desembrulhado do envelope.
 *
 * Shape servido pela API (src/features/dashboard/dashboard.service.js):
 * {
 *   occupancy: { total, byStatus: [{ statusName, slug, color, count }] },
 *   burialsThisMonth, burialsThisYear, exhumationsThisMonth, exhumationsThisYear,
 *   finance: { receivedThisMonth, pendingTotal, overdueTotal, overdueCount },
 *   delinquencyRate, activeConcessions,
 *   revenueSeries: [{ month: "YYYY-MM", total }],
 *   todaySchedule: [{ id, scheduleType, title, startsAt, status, place, deceasedName }],
 *   topDebtors: [{ personId, personName, cpf, graveCode, overdueTotal, overdueCount }],
 *   recentActivity: [{ id, action, entityType, entityId, description, userName, createdAt }]
 * }
 *
 * @param {{ cemeteryId?: string }} [params]
 */
export const getDashboard = (params, opts) =>
  api.get("/dashboard", { params, ...opts });

// Alias de conveniência (mesmo contrato).
export const list = getDashboard;
