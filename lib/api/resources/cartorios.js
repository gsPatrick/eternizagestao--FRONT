import { api } from "@/lib/api/client";

/* ------------------------------------------------------------------ *
 * Cartórios — cadastro de referência por cidade.                     *
 * Rotas reais: src/features/cartorios/cartorios.routes.js            *
 * ------------------------------------------------------------------ */

// GET /cartorios — lista paginada → { data, meta }
export const listCartorios = (params, opts) =>
  api.get("/cartorios", { params, meta: true, ...opts });

export const getCartorio = (id, opts) => api.get(`/cartorios/${id}`, opts);
export const createCartorio = (body) => api.post("/cartorios", body);
export const updateCartorio = (id, body) => api.patch(`/cartorios/${id}`, body);
export const deleteCartorio = (id) => api.del(`/cartorios/${id}`);

/* ------------------------------------------------------------------ *
 * Adaptadores de shape (API → view model)                            *
 * ------------------------------------------------------------------ */

// Linha da tabela / card
export function toCartorioRow(c) {
  return {
    id: c.id,
    name: c.name || "",
    state: c.addressState || "",
    city: c.addressCity || "",
    cnpj: c.cnpj || "",
    phone: c.phone || "",
    email: c.email || "",
    street: c.addressStreet || "",
    notes: c.notes || "",
  };
}

// view model do formulário → payload aceito pela API (EDITABLE_FIELDS)
export function toCartorioPayload(form) {
  return {
    name: form.name?.trim(),
    addressState: form.state?.trim().toUpperCase() || null,
    addressCity: form.city?.trim() || null,
    cnpj: form.cnpj?.trim() || null,
    phone: form.phone?.trim() || null,
    email: form.email?.trim() || null,
    addressStreet: form.street?.trim() || null,
    notes: form.notes?.trim() || null,
  };
}
