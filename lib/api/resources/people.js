import { api } from "@/lib/api/client";

/* ------------------------------------------------------------------ *
 * Endpoints (funções finas — uma por rota real de people.routes.js)  *
 * ------------------------------------------------------------------ */

// GET /people — lista paginada → { data, meta }
export const listPeople = (params, opts) =>
  api.get("/people", { params, meta: true, ...opts });

// GET /people/summary — contadores dos chips de filtro
export const getPeopleSummary = (opts) => api.get("/people/summary", opts);

// GET /people/:id — detalhe (concessões, vínculos, conta do portal)
export const getPerson = (id, opts) => api.get(`/people/${id}`, opts);

export const createPerson = (body) => api.post("/people", body);
export const updatePerson = (id, body) => api.patch(`/people/${id}`, body);
export const deletePerson = (id) => api.del(`/people/${id}`);

// Vínculos familiares
export const addRelationship = (id, body) =>
  api.post(`/people/${id}/relationships`, body);
export const removeRelationship = (id, relationshipId) =>
  api.del(`/people/${id}/relationships/${relationshipId}`);

// Portal da Família — convite (dispara e-mail de ativação via fila) e revogação
export const invitePortal = (id, body) =>
  api.post(`/people/${id}/portal-invite`, body || {});
export const revokePortal = (id) => api.del(`/people/${id}/portal`);

/* ------------------------------------------------------------------ *
 * Adaptadores de shape (API → view model consumido pela página)      *
 * ------------------------------------------------------------------ */

const CONCESSION_TYPE_LABEL = { perpetua: "Perpétua", temporaria: "Temporária" };
const CONCESSION_STATUS_LABEL = {
  ativa: "Ativa", vencida: "Vencida", transferida: "Transferida",
  encerrada: "Encerrada", cancelada: "Cancelada",
};

function ymdToBr(ymd) {
  if (!ymd) return "";
  const [y, m, d] = String(ymd).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "";
}
function brToYmd(br) {
  if (!br) return null;
  const m = String(br).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function isoToBr(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("pt-BR");
}

function toPortalView(portal) {
  if (!portal) return { active: false };
  return {
    active: Boolean(portal.active),
    invited: portal.status === "pendente_ativacao",
    email: portal.email || "",
    since: isoToBr(portal.since),
  };
}

// Linha da tabela (vem de GET /people — anotado com roles/concessionsCount/portal)
export function toPersonRow(p) {
  return {
    id: p.id,
    name: p.fullName,
    cpf: p.cpf || "",
    rg: p.rg || "",
    email: p.email || "",
    phone: p.phonePrimary || p.phoneSecondary || "",
    whatsapp: p.whatsapp || "",
    city: [p.addressCity, p.addressState].filter(Boolean).join(" — "),
    roles: p.roles || [],
    concessionsCount: p.concessionsCount || 0,
    portal: toPortalView(p.portal),
    active: p.active !== false,
  };
}

// Detalhe completo (vem de GET /people/:id — inclui concessions/relationships)
export function toPersonDetail(p) {
  if (!p) return null;
  const street = [p.addressStreet, p.addressNumber].filter(Boolean).join(", ");
  return {
    id: p.id,
    name: p.fullName,
    cpf: p.cpf || "",
    rg: p.rg || "",
    birth: ymdToBr(p.birthDate),
    gender: p.gender || "",
    email: p.email || "",
    phone: p.phonePrimary || p.phoneSecondary || "",
    whatsapp: p.whatsapp || "",
    address: [street, p.addressDistrict].filter(Boolean).join(" · "),
    city: [p.addressCity, p.addressState].filter(Boolean).join(" — "),
    zipcode: p.addressZipcode || "",
    roles: p.roles || [],
    concessions: (p.concessions || []).map((c) => ({
      id: c.id,
      grave: c.grave?.code || c.graveId || "—",
      type: CONCESSION_TYPE_LABEL[c.concessionType] || c.concessionType || "",
      status: CONCESSION_STATUS_LABEL[c.status] || c.status || "",
    })),
    relationships: (p.relationships || []).map((r) => ({
      id: r.id,
      person: r.relatedPerson?.fullName || "",
      type: r.relationshipType || "",
    })),
    portal: toPortalView(p.portal),
    active: p.active !== false,
    notes: p.notes || "",
  };
}

// view model do formulário → payload aceito pela API (EDITABLE_FIELDS)
export function toPersonPayload(form) {
  const [city, state] = String(form.city || "")
    .split("—")
    .map((s) => s.trim());
  return {
    fullName: form.fullName?.trim(),
    cpf: form.cpf?.trim() || null,
    rg: form.rg?.trim() || null,
    birthDate: brToYmd(form.birth),
    gender: form.gender || null,
    email: form.email?.trim() || null,
    whatsapp: form.whatsapp?.trim() || null,
    phonePrimary: form.phonePrimary?.trim() || null,
    addressStreet: form.street?.trim() || null,
    addressCity: city || null,
    addressState: state || null,
    addressZipcode: form.zip?.trim() || null,
    notes: form.notes?.trim() || null,
  };
}
