// lib/api/resources/payments.js
// Resource fino da feature `payments` — paths/params REAIS de
// src/features/payments/payments.routes.js (montado em /v1, paths absolutos).
import { api } from "@/lib/api/client";

// baixa manual da cobrança
// body: { method, paidAt?, amountPaid?, notes? }
export const createManualPayment = (billingId, body) =>
  api.post(`/billings/${billingId}/payments`, body);

// simula a confirmação do gateway (baixa automática) — exercita o webhook endurecido
// body: { method? } → devolve a cobrança já baixada (com payments)
export const simulateGatewayPayment = (billingId, body) =>
  api.post(`/billings/${billingId}/simulate-gateway-payment`, body || {});

// LISTA paginada de pagamentos → { data, meta }
// params: page, perPage, method, billingId, paidFrom, paidTo
export const listPayments = (params, opts) =>
  api.get("/payments", { params, meta: true, ...opts });

export const getPayment = (id, opts) => api.get(`/payments/${id}`, opts);

// recibo → { receiptNumber, fileUrl, payment, billing }
export const getPaymentReceipt = (id, opts) =>
  api.get(`/payments/${id}/receipt`, opts);

// métodos aceitos pela API (payments.service.PAYMENT_METHODS)
export const PAYMENT_METHODS = [
  "pix",
  "boleto",
  "dinheiro",
  "cartao_credito",
  "cartao_debito",
  "transferencia",
  "outro",
];
