// lib/api/resources/audit.js
// Resource fino da feature `audit-logs` — paths/params REAIS de
// src/features/audit-logs/audit-logs.routes.js (montado em /v1/audit-logs).
//
// Trilha imutável e SOMENTE LEITURA. A API serializa cada registro já no shape
// consumido pela página (ver audit-logs.service.js → serialize):
//   { id, action, entityType, entityId, description, previousData, newData,
//     ipAddress, device (parseDevice do userAgent), userAgent, userId,
//     userName, createdAt }
import { api } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Endpoints (admin-only; o token resolve o tenant)
// ---------------------------------------------------------------------------

// LISTA paginada → { meta: true } → devolve { data, meta }.
// params (todos opcionais/combináveis): page, perPage, action, actionGroup,
//   userId, entityType, dateFrom, dateTo, q
export const listAuditLogs = (params, opts) =>
  api.get("/audit-logs", { params, meta: true, ...opts });

// item único — mesmo shape serializado da lista.
export const getAuditLog = (id, opts) => api.get(`/audit-logs/${id}`, opts);

// ---------------------------------------------------------------------------
// Grupos de ação — espelham ACTION_GROUPS do serviço da API (audit-logs.service).
// Usados nos chips de filtro; `actions:null` = "todas".
// ---------------------------------------------------------------------------
export const ACTION_GROUPS = [
  { key: "todas", label: "Todas", actions: null },
  { key: "criacoes", label: "Criações", actions: ["criacao"] },
  { key: "edicoes", label: "Edições", actions: ["edicao"] },
  { key: "exclusoes", label: "Exclusões", actions: ["exclusao"] },
  { key: "acessos", label: "Acessos", actions: ["login", "logout"] },
  { key: "financeiro", label: "Financeiro", actions: ["pagamento_manual", "bloqueio", "desbloqueio"] },
  { key: "documentos", label: "Documentos", actions: ["emissao_documento", "exportacao"] },
];

// Rótulo/tom visual por ação conhecida. Ações não mapeadas (ex.: fallback do
// middleware que grava "POST /api/v1/...") caem no humanizado + tom neutro,
// para a página trazer TUDO que a API registra sem quebrar.
const ACTION_META = {
  criacao: { label: "Criação", tone: "success" },
  edicao: { label: "Edição", tone: "info" },
  exclusao: { label: "Exclusão", tone: "danger" },
  login: { label: "Login", tone: "neutral" },
  logout: { label: "Logout", tone: "neutral" },
  exportacao: { label: "Exportação", tone: "navy" },
  emissao_documento: { label: "Emissão de documento", tone: "navy" },
  pagamento_manual: { label: "Pagamento manual", tone: "success" },
  bloqueio: { label: "Bloqueio", tone: "warning" },
  desbloqueio: { label: "Desbloqueio", tone: "success" },
};

export function actionMeta(action) {
  if (ACTION_META[action]) return ACTION_META[action];
  // Humaniza fallbacks crus ("POST /api/v1/documents" → "POST · documents").
  const raw = String(action || "").trim();
  if (!raw) return { label: "Ação", tone: "neutral" };
  return { label: raw.length > 40 ? `${raw.slice(0, 37)}…` : raw, tone: "neutral" };
}

// A qual grupo uma ação pertence (para contagem dos chips no client).
export function groupOfAction(action) {
  const g = ACTION_GROUPS.find((grp) => grp.actions && grp.actions.includes(action));
  return g ? g.key : null;
}

// ---------------------------------------------------------------------------
// Datas ISO/UTC → pt-BR
// ---------------------------------------------------------------------------
function parts(iso) {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`,
    time: `${p(dt.getHours())}:${p(dt.getMinutes())}`,
    dt,
  };
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

// Formata um valor de JSONB (previousData/newData) para leitura humana.
function fmtValue(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") {
    if (ISO_RE.test(v)) {
      const p = parts(v);
      return p ? `${p.date} ${p.time}` : v;
    }
    return v;
  }
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

// Rótulo de campo a partir da chave do JSONB (camelCase/snake_case → legível).
function fieldLabel(key) {
  const spaced = String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Diff campo a campo entre previousData e newData (união das chaves).
function buildChanges(prev, next) {
  const keys = Array.from(new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]));
  return keys.map((key) => ({
    field: fieldLabel(key),
    from: fmtValue(prev ? prev[key] : undefined),
    to: fmtValue(next ? next[key] : undefined),
  }));
}

// Snapshot chave→valor de um único lado (criação = newData, exclusão = previousData).
function buildSnapshot(obj) {
  return Object.keys(obj || {}).map((key) => ({
    field: fieldLabel(key),
    value: fmtValue(obj[key]),
  }));
}

// ---------------------------------------------------------------------------
// Normaliza um registro serializado da API para o shape que a página consome.
// Read-only: nenhuma escrita; apenas apresentação do que a API registrou.
// ---------------------------------------------------------------------------
export function normalizeAuditLog(raw) {
  if (!raw) return null;

  const p = parts(raw.createdAt);
  const user = raw.userName || "Sistema";
  const entity = raw.entityType || "—";
  const meta = actionMeta(raw.action);
  const hasPrev = raw.previousData && typeof raw.previousData === "object" && Object.keys(raw.previousData).length > 0;
  const hasNew = raw.newData && typeof raw.newData === "object" && Object.keys(raw.newData).length > 0;

  // diff quando há os dois lados; senão snapshot do lado presente.
  const changes = hasPrev && hasNew ? buildChanges(raw.previousData, raw.newData) : null;
  const snapshot = !changes && (hasNew || hasPrev) ? buildSnapshot(hasNew ? raw.newData : raw.previousData) : null;

  // Metadados extras (só o que a API de fato registrou → sem inventar).
  const extraMeta = [];
  if (raw.userAgent) extraMeta.push({ label: "User-Agent", value: raw.userAgent });
  if (raw.entityId) extraMeta.push({ label: "ID da entidade", value: raw.entityId });

  return {
    id: raw.id,
    action: raw.action,
    actionLabel: meta.label,
    actionTone: meta.tone,
    group: groupOfAction(raw.action),
    user,
    userId: raw.userId || null,
    entity,
    entityId: raw.entityId || null,
    ip: raw.ipAddress || "—",
    device: raw.device || "—",
    userAgent: raw.userAgent || null,
    date: p?.date || "—",
    time: p?.time || "—",
    createdAt: raw.createdAt || null,
    // frase do evento = descrição registrada pela API (a mais fiel ao que houve).
    phrase: raw.description || `${meta.label} · ${entity}`,
    previousData: raw.previousData || null,
    newData: raw.newData || null,
    changes,
    snapshot,
    // rótulo da seção de snapshot conforme a ação.
    snapshotLabel: raw.action === "exclusao" ? "Dados no momento da exclusão" : "Dados registrados",
    meta: extraMeta,
    snapshotIsDeletion: raw.action === "exclusao",
    _raw: raw,
  };
}
