// Portal da Família — resource + adaptadores de exibição.
//
// O FRONT manda: estas funções chamam os endpoints /portal/* (que exigem
// Bearer do person + header X-Tenant-Subdomain) e devolvem os dados JÁ no
// formato que as telas consomem (o mesmo shape do antigo lib/mock-portal).
// A API serve os dados estruturados; a formatação pt-BR (datas/moeda/rótulos)
// mora aqui, na borda do front.
//
// Todas as funções aceitam `opts` (repasse de { signal, tenant }): as telas
// passam `{ tenant }` (subdomínio do cliente) e o useResource passa `{ signal }`.

import { api } from "@/lib/api/client";

/* --------------------------------- helpers -------------------------------- */

// "2019-03-12" | ISO → "12/03/2019"
function fmtDate(value) {
  if (!value) return "";
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

// só o ano (data de nascimento no card do sepultado)
function fmtYear(value) {
  if (!value) return "";
  return String(value).slice(0, 4);
}

function num(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function capitalize(text) {
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// dias de atraso a partir do vencimento (só quando vencida)
function daysOverdue(dueDate) {
  if (!dueDate) return 0;
  const due = new Date(`${String(dueDate).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((today - due) / 86_400_000);
  return diff > 0 ? diff : 0;
}

// "Jazigo A-R1-L01-012" a partir de { unitType, code }
function graveLabel(grave) {
  if (!grave) return "—";
  const type = grave.unitType ? capitalize(grave.unitType) : "Jazigo";
  return grave.code ? `${type} ${grave.code}` : type;
}

export function formatBRL(value) {
  return num(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function billTotal(bill) {
  return num(bill.amount) + num(bill.fine) + num(bill.interest);
}

/* -------------------------------- adapters -------------------------------- */

function adaptUser(me) {
  if (!me) return null;
  const fullName = me.fullName || "";
  const firstName = fullName.split(" ").filter(Boolean)[0] || fullName;

  const streetLine = [me.addressStreet, me.addressNumber].filter(Boolean).join(", ");
  const address = [streetLine, me.addressDistrict].filter(Boolean).join(" · ");
  const city = [me.addressCity, me.addressState].filter(Boolean).join(" — ");

  return {
    name: fullName,
    firstName,
    cpf: me.cpf || "",
    email: me.email || me.account?.email || "",
    phone: me.phonePrimary || "",
    whatsapp: me.whatsapp || "",
    address,
    city,
    zipcode: me.addressZipcode || "",
    cemetery: me.cemetery || "Cemitério",
    // guarda os campos crus para a edição mapear de volta pros nomes da API
    raw: me,
  };
}

const CONCESSION_TYPE_LABEL = {
  perpetua: "Concessão perpétua",
  temporaria: "Concessão temporária",
};

function adaptGrave(grave) {
  const loc = grave.location || {};
  const trailParts = [
    loc.block ? `Quadra ${loc.block}` : null,
    loc.street ? `Rua ${loc.street}` : null,
    loc.lot ? `Lote ${loc.lot}` : null,
  ].filter(Boolean);

  return {
    id: grave.id,
    code: grave.code || "",
    label: graveLabel(grave),
    trail: trailParts.join(" › "),
    type: CONCESSION_TYPE_LABEL[grave.concessionType] || "Concessão",
    status: grave.status === "pendente" ? "pendente" : "em_dia",
    since: fmtDate(grave.startDate),
    contract: grave.contractNumber || "—",
    cemetery: grave.cemetery || "",
    deceased: (grave.deceased || []).map((d) => ({
      name: d.fullName,
      // parentesco não é modelado na base — fica vazio (ver divergências)
      role: "",
      birth: fmtYear(d.birthDate),
      death: fmtDate(d.deathDate),
      buried: fmtDate(d.burialDate),
    })),
    timeline: (grave.timeline || []).map((e) => ({
      date: fmtDate(e.date),
      type: e.type,
      text: e.text,
    })),
  };
}

const BILLING_STATUS = {
  em_atraso: "vencido",
  pendente: "a_vencer",
  pago: "pago",
};

function adaptBilling(bill) {
  const status = BILLING_STATUS[bill.status] || "a_vencer";
  const paidPayment = (bill.payments || [])
    .filter((p) => p.paidAt)
    .sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt))[0];

  return {
    id: bill.id,
    grave: graveLabel(bill.grave),
    description: bill.description || "Cobrança",
    due: fmtDate(bill.dueDate),
    status,
    amount: num(bill.amount),
    fine: num(bill.fineAmount),
    interest: num(bill.interestAmount),
    days: status === "vencido" ? daysOverdue(bill.dueDate) : 0,
    paidAt: status === "pago" && paidPayment ? fmtDate(paidPayment.paidAt) : undefined,
  };
}

/* ------------------------------- API calls -------------------------------- */

// Resumo do titular (nome, contato, endereço, cemitério).
export async function getMe(opts) {
  return adaptUser(await api.get("/portal/me", opts));
}

// Atualiza contato/endereço. `body` já nos nomes de campo da API.
export async function updateMe(body, opts) {
  return adaptUser(await api.patch("/portal/me", body, opts));
}

// Troca de senha do titular. `body` = { currentPassword, newPassword }.
export async function changePassword(body, opts) {
  return api.patch("/portal/password", body, opts);
}

// Meus jazigos (lista + detalhe usam o mesmo fetch; o detalhe acha por id).
export async function getGraves(opts) {
  const rows = await api.get("/portal/graves", opts);
  return (rows || []).map(adaptGrave);
}

// Cobranças (histórico completo, paginado). Devolve a lista já adaptada.
export async function getBillings(opts) {
  const { data } = await api.get("/portal/billings", { meta: true, ...opts });
  return (data || []).map(adaptBilling);
}

// 2ª via — cancela a origem e gera nova cobrança pendente com PIX/boleto.
export async function reissueBilling(id, opts) {
  const bill = await api.post(`/portal/billings/${id}/reissue`, undefined, opts);
  return {
    id: bill.id,
    pixCode: bill.pixCopyPaste || "",
    boletoLine: bill.boletoDigitableLine || "",
    boletoUrl: bill.boletoUrl || "",
  };
}
