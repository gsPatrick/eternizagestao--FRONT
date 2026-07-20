// lib/api/resources/billings.js
// Resource fino da feature `billings` — paths/params REAIS de
// src/features/billings/billings.routes.js (montado em /v1/billings).
import { api } from "@/lib/api/client";

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------

// LISTA paginada → { meta: true } → devolve { data, meta }
// params: page, perPage, status, origin, payerPersonId, graveId, dueFrom, dueTo
export const listBillings = (params, opts) =>
  api.get("/billings", { params, meta: true, ...opts });

// contadores por status (chips) + totais + recebido no mês (StatCards)
export const getBillingsSummary = (params, opts) =>
  api.get("/billings/summary", { params, ...opts });

// item único (inclui payments + maintenanceFee)
export const getBilling = (id, opts) => api.get(`/billings/${id}`, opts);

// avulsa / serviço
export const createBilling = (body) => api.post("/billings", body);

// geração em lote das taxas de manutenção ativas → { generated, billings }
export const generateBillings = (body) => api.post("/billings/generate", body);

// 2ª via / reemissão (nova cobrança + cancela a origem)
export const reissueBilling = (id, body) => api.post(`/billings/${id}/reissue`, body);

// cancelamento
export const cancelBilling = (id, body) => api.patch(`/billings/${id}/cancel`, body);

// marca vencidas como em atraso
export const markBillingsOverdue = () => api.post("/billings/mark-overdue");

// ---------------------------------------------------------------------------
// Tradução de enums API <-> vocabulário visual da página
// (API: em_atraso / taxa_manutencao · Página: atraso / taxa)
// ---------------------------------------------------------------------------
const STATUS_FROM_API = { em_atraso: "atraso" };
const STATUS_TO_API = { atraso: "em_atraso" };
const ORIGIN_FROM_API = { taxa_manutencao: "taxa" };
const ORIGIN_TO_API = { taxa_manutencao: "taxa", servico: "servico", avulsa: "avulsa" };
const ORIGIN_UI_TO_API = { taxa: "taxa_manutencao", servico: "servico", avulsa: "avulsa" };

export const toApiStatus = (s) => (s ? STATUS_TO_API[s] || s : s);
export const toApiOrigin = (o) => (o ? ORIGIN_UI_TO_API[o] || o : o);

const METHOD_LABEL = {
  pix: "PIX",
  boleto: "Boleto",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão",
  cartao_debito: "Cartão",
  transferencia: "Transferência",
  outro: "Outro",
};

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// 'YYYY-MM-DD' → 'DD/MM/YYYY'
function fmtDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
}

// ISO datetime → 'DD/MM/YYYY · HH:mm'
function fmtDateTime(iso) {
  if (!iso) return "";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return fmtDate(iso);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} · ${p(dt.getHours())}:${p(dt.getMinutes())}`;
}

// pagamento confirmado mais recente (baixa efetiva) de uma cobrança
function latestPayment(payments) {
  if (!Array.isArray(payments) || !payments.length) return null;
  return [...payments].sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];
}

// ---------------------------------------------------------------------------
// Normaliza a Billing da API para o shape que a página consome.
// ---------------------------------------------------------------------------
export function normalizeBilling(raw) {
  if (!raw) return null;
  const pay = latestPayment(raw.payments);
  const paid = raw.status === "pago";
  return {
    id: raw.id,
    number: raw.code,
    description: raw.description || "",
    period: raw.referencePeriod || "",
    payer: raw.payer?.fullName || "—",
    payerPersonId: raw.payerPersonId,
    grave: raw.grave?.code || "",
    graveId: raw.graveId,
    amount: num(raw.amount),
    fine: num(raw.fineAmount),
    interest: num(raw.interestAmount),
    due: fmtDate(raw.dueDate),
    status: STATUS_FROM_API[raw.status] || raw.status,
    origin: ORIGIN_FROM_API[raw.origin] || raw.origin,
    reissued: (raw.reissueCount || 0) > 0 || Boolean(raw.originalBillingId),
    // dados de pagamento (só existem quando há baixa)
    auto: paid ? Boolean(pay?.isAutomatic) : false,
    paidAt: pay ? fmtDateTime(pay.paidAt) : null,
    method: pay ? METHOD_LABEL[pay.method] || pay.method : null,
    receipt: pay?.receiptNumber || null,
    paymentId: pay?.id || null,
    // canais de pagamento do gateway
    pixCopyPaste: raw.pixCopyPaste || null,
    boletoDigitableLine: raw.boletoDigitableLine || null,
    boletoUrl: raw.boletoUrl || null,
  };
}

export { STATUS_TO_API, ORIGIN_TO_API };
