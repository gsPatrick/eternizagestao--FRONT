import { api } from "@/lib/api/client";

/* ------------------------------------------------------------------ *
 * Instituições — cadastro de referência por cidade.                  *
 * Rotas reais: src/features/institutions/institutions.routes.js      *
 * ------------------------------------------------------------------ */

// GET /institutions — lista paginada → { data, meta }
export const listInstitutions = (params, opts) =>
  api.get("/institutions", { params, meta: true, ...opts });

export const getInstitution = (id, opts) => api.get(`/institutions/${id}`, opts);
export const createInstitution = (body) => api.post("/institutions", body);
export const updateInstitution = (id, body) => api.patch(`/institutions/${id}`, body);
export const deleteInstitution = (id) => api.del(`/institutions/${id}`);

/* ------------------------------------------------------------------ *
 * Adaptadores de shape (API → view model)                            *
 * ------------------------------------------------------------------ */

export function toInstitutionRow(i) {
  return {
    id: i.id,
    name: i.name || "",
    type: i.type || "",
    cnpj: i.cnpj || "",
    phone: i.phone || "",
    email: i.email || "",
    street: i.addressStreet || "",
    state: i.addressState || "",
    city: i.addressCity || "",
    notes: i.notes || "",
  };
}

// view model do formulário → payload aceito pela API (EDITABLE_FIELDS)
export function toInstitutionPayload(form) {
  return {
    name: form.name?.trim(),
    type: form.type?.trim() || null,
    cnpj: form.cnpj?.trim() || null,
    phone: form.phone?.trim() || null,
    email: form.email?.trim() || null,
    addressStreet: form.street?.trim() || null,
    addressState: form.state?.trim().toUpperCase() || null,
    addressCity: form.city?.trim() || null,
    notes: form.notes?.trim() || null,
  };
}
