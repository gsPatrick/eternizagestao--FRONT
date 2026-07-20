// lib/api/resources/notifications.js
// Resource fino da feature `notifications` — paths/params REAIS de
// src/features/notifications/notifications.routes.js (montado em /v1/notifications).
import { api } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// LISTA paginada → { meta: true } → devolve { data, meta }
// params: page, perPage, status, channel, notificationType, recipientPersonId
export const listNotifications = (params, opts) =>
  api.get("/notifications", { params, meta: true, ...opts });

// item único (inclui recipientPerson)
export const getNotification = (id, opts) => api.get(`/notifications/${id}`, opts);

// AVULSA (manual) — admin/operador.
// body: { personId? | contact, channel, message, subject?, referenceType? }
export const sendNotification = (body) => api.post("/notifications", body);

// disparo em LOTE (bulk) — admin.
// body: { recipients:[{personId|contact, channel}], notificationType, message?, subject?, template? }
//       OU { segment:'inadimplentes', notificationType?, message?, subject?, vars? }
export const sendBulkNotifications = (body) => api.post("/notifications/bulk", body);

// reenvio de uma notificação em falha — admin/operador.
export const retryNotification = (id) => api.post(`/notifications/${id}/retry`);

// disparo de teste (admin) — valida provider/contato. body: { personId, message }
export const testNotification = (body) => api.post("/notifications/test", body);

// ---------------------------------------------------------------------------
// Tradução de enums API <-> vocabulário visual da página
// (a página só conhece 6 tipos e 5 status — mapeie SEMPRE para um deles)
// ---------------------------------------------------------------------------
// notificationType (API) → type (página)
const TYPE_FROM_API = {
  vencimento_taxa: "vencimento_proximo",
  cobranca_gerada: "vencimento_proximo",
  cobranca_vencida: "cobranca_vencida",
  pagamento_confirmado: "pagamento_confirmado",
  autorizacao_sepultamento: "autorizacao_emitida",
  documento_emitido: "autorizacao_emitida",
  agendamento: "lembrete_agendamento",
  lembrete: "lembrete_agendamento",
  avulsa: "avulsa",
  portal_acesso: "avulsa",
  outro: "avulsa",
};

// status (API) → status (página)
const STATUS_FROM_API = {
  pendente: "pendente",
  enfileirada: "pendente", // "na fila" — a UI trata pendente como aguardando envio
  enviada: "enviada",
  entregue: "entregue",
  lida: "lida",
  falha: "erro",
};

export const toUiType = (t) => TYPE_FROM_API[t] || "avulsa";
export const toUiStatus = (s) => STATUS_FROM_API[s] || "pendente";

// ---------------------------------------------------------------------------
// Formatação de datas (ISO/UTC → pt-BR)
// ---------------------------------------------------------------------------
function parts(iso) {
  if (!iso) return null;
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return null;
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()}`,
    time: `${p(dt.getHours())}:${p(dt.getMinutes())}`,
  };
}

function fmtDateTime(iso) {
  const p = parts(iso);
  return p ? `${p.date} ${p.time}` : null;
}

// ---------------------------------------------------------------------------
// Normaliza a Notification da API para o shape que a página consome.
//
// A linha da API não guarda timestamps separados de entregue/lida (não há
// coluna nem migração possível aqui) — a linha do tempo é derivada, best-effort,
// de createdAt/sentAt/updatedAt + status, sem inventar dados: passos sem
// carimbo ficam null e a UI mostra "—".
// ---------------------------------------------------------------------------
export function normalizeNotification(raw) {
  if (!raw) return null;

  const uiStatus = toUiStatus(raw.status);
  const channel = raw.channel === "email" ? "email" : "whatsapp";
  const hasPerson = Boolean(raw.recipientPerson?.fullName);
  const sent = parts(raw.sentAt);
  const created = parts(raw.createdAt);
  const stamp = sent || created; // "enviada em" prefere sentAt, cai pra criação

  const reached = (target) => {
    const order = ["pendente", "enviada", "entregue", "lida"];
    return order.indexOf(uiStatus) >= order.indexOf(target);
  };

  return {
    id: raw.id,
    name: raw.recipientPerson?.fullName || raw.recipientContact || "Sem destinatário",
    // secundário: contato real quando há pessoa; senão rótulo do envio manual
    contact: hasPerson
      ? raw.recipientContact || "—"
      : channel === "whatsapp"
        ? "Envio avulso · WhatsApp"
        : "Envio avulso · e-mail",
    channel,
    type: toUiType(raw.notificationType),
    status: uiStatus,
    date: uiStatus === "pendente" ? null : stamp?.date || null,
    time: uiStatus === "pendente" ? null : stamp?.time || null,
    message: raw.message || raw.subject || "",
    timeline: {
      criada: fmtDateTime(raw.createdAt),
      enviada: fmtDateTime(raw.sentAt),
      // sem carimbo próprio: usa updatedAt quando o status já passou do ponto
      entregue: reached("entregue") ? fmtDateTime(raw.updatedAt) : null,
      lida: reached("lida") ? fmtDateTime(raw.updatedAt) : null,
    },
    error: raw.status === "falha" ? raw.errorMessage || "Falha no envio" : null,
    _raw: raw,
  };
}
