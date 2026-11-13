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

import { api, API_URL } from "@/lib/api/client";
import { getToken } from "@/lib/api/session";

/* --------------------------------- helpers -------------------------------- */

// "2019-03-12" | ISO → "12/03/2019"
function fmtDate(value) {
  if (!value) return "";
  const iso = String(value).slice(0, 10);
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

// Timestamp (ISO com hora) → "dd/mm/aaaa" no fuso de São Paulo — evita que
// uma emissão à noite apareça com a data do dia seguinte (UTC).
function fmtDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fmtDate(value);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  });
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
    // localização REAL no mapa (para o PublicCemeteryMap do portal)
    cemeteryId: grave.cemeteryId || null,
    mapLocation: {
      block: loc.block || null,
      street: loc.street || null,
      lot: loc.lot || null,
    },
    geoPolygon: grave.geoPolygon || null,
    latitude: grave.latitude ?? null,
    longitude: grave.longitude ?? null,
    // gavetas do jazigo — documentos emitidos para uma gaveta aparecem no jazigo
    drawerIds: grave.drawerIds || [],
    deceased: (grave.deceased || []).map((d) => ({
      name: d.fullName,
      // parentesco não é modelado na base; quando o sepultado está numa gaveta
      // do jazigo, identifica a gaveta no lugar do parentesco.
      role: d.drawerCode ? `Gaveta ${d.drawerCode}` : "",
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

// Documento oficial do titular (GET /portal/documents) → item da tela.
// `portalGraveId` = jazigo do card (gaveta já resolvida para o jazigo pai) —
// usado para filtrar os documentos no detalhe do jazigo.
function adaptPortalDocument(doc) {
  const hasGrave = Boolean(doc.graveCode);
  return {
    id: doc.id,
    type: doc.documentType,
    title: doc.typeLabel || "Documento",
    number: doc.formattedNumber || "",
    issuedAt: fmtDateTime(doc.issuedAt),
    isReissue: Boolean(doc.isReissue),
    deceased: doc.deceasedName || "",
    grave: hasGrave ? graveLabel({ unitType: doc.graveUnitType, code: doc.graveCode }) : "",
    graveId: doc.graveId || null,
    portalGraveId: doc.portalGraveId || null,
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

/**
 * ATIVAÇÃO do acesso (link "Ative seu acesso" enviado por e-mail).
 *
 * O e-mail leva para `/ativar/<token>` no subdomínio da cidade. O titular
 * confirma o próprio e-mail e define a senha; a API confere e-mail + token
 * (guardado como hash, uso único) e ativa a conta.
 *
 * Rota PÚBLICA: `auth: false` (ninguém está logado ainda) e `tenant` é
 * obrigatório — o endpoint exige o cliente resolvido (X-Tenant-Subdomain).
 *
 * @param {{email:string, activationToken:string, password:string, tenant?:string}} params
 * @returns {Promise<{accountId:string, status:string}>}
 */
export async function activatePortalAccess({ email, activationToken, password, tenant }, opts) {
  return api.post(
    "/portal/activate",
    { email, activationToken, password },
    { auth: false, tenant, ...opts }
  );
}

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
    // Imagem REAL do QR devolvida pelo gateway (data:image/png;base64,...).
    // Sem ela não desenhamos QR nenhum: um QR ilustrativo é pior que nenhum —
    // o cidadão escaneia, não paga, e culpa o próprio banco.
    pixQrImage: bill.pixQrCode || null,
    boletoLine: bill.boletoDigitableLine || "",
    boletoUrl: bill.boletoUrl || "",
  };
}

// Documentos oficiais do titular (certidão de perpetuidade / autorização de
// sepultamento) — só a via mais recente de cada um, já adaptados para a tela.
export async function listPortalDocuments(opts) {
  const rows = await api.get("/portal/documents", opts);
  return (rows || []).map(adaptPortalDocument);
}

// Busca o PDF do documento pelo endpoint AUTENTICADO do portal
// (GET /portal/documents/:id/pdf — a API confere se o documento é do titular e
// gera o PDF na hora). Mesmo padrão do fetchDocumentPdf do painel: fetch cru
// com Bearer (o client JSON não lida com blob) + o header do cliente (tenant),
// obrigatório nas rotas do portal. Devolve um object URL (blob).
export async function fetchPortalDocumentPdf(id, { tenant, signal } = {}) {
  const token = getToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenant) headers["X-Tenant-Subdomain"] = tenant;
  const res = await fetch(`${API_URL}/portal/documents/${id}/pdf`, { headers, signal });
  if (!res.ok) throw new Error("Não foi possível baixar o documento. Tente novamente.");
  return URL.createObjectURL(await res.blob());
}

// "Baixar PDF": dispara o download do documento com um nome legível
// (ex.: "Certidão de Perpetuidade 0007-2026.pdf") e libera o blob em seguida.
export async function downloadPortalDocument(doc, opts) {
  const url = await fetchPortalDocumentPdf(doc.id, opts);
  const name = `${doc.title || "Documento"} ${String(doc.number || "").replace(/\//g, "-")}`.trim();
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
