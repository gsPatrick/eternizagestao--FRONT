import { api } from "@/lib/api/client";

/* ------------------------------------------------------------------ *
 * Funerárias — cadastro de referência por cidade (com bloco Contato). *
 * Rotas reais: src/features/funerarias/funerarias.routes.js          *
 * ------------------------------------------------------------------ */

// GET /funerarias — lista paginada → { data, meta }
export const listFunerarias = (params, opts) =>
  api.get("/funerarias", { params, meta: true, ...opts });

export const getFuneraria = (id, opts) => api.get(`/funerarias/${id}`, opts);
export const createFuneraria = (body) => api.post("/funerarias", body);
export const updateFuneraria = (id, body) => api.patch(`/funerarias/${id}`, body);
export const deleteFuneraria = (id) => api.del(`/funerarias/${id}`);

/* ------------------------------------------------------------------ *
 * Adaptadores de shape (API → view model)                            *
 * ------------------------------------------------------------------ */

export function toFunerariaRow(f) {
  return {
    id: f.id,
    name: f.name || "",
    cnpj: f.cnpj || "",
    phone: f.phone || "",
    email: f.email || "",
    street: f.addressStreet || "",
    district: f.addressDistrict || "",
    state: f.addressState || "",
    city: f.addressCity || "",
    contactName: f.contactName || "",
    contactCpf: f.contactCpf || "",
    contactPhone: f.contactPhone || "",
    contactEmail: f.contactEmail || "",
    contactAddress: f.contactAddress || "",
    notes: f.notes || "",
  };
}

// view model do formulário → payload aceito pela API (EDITABLE_FIELDS)
export function toFunerariaPayload(form) {
  return {
    name: form.name?.trim(),
    cnpj: form.cnpj?.trim() || null,
    phone: form.phone?.trim() || null,
    email: form.email?.trim() || null,
    addressStreet: form.street?.trim() || null,
    addressDistrict: form.district?.trim() || null,
    addressState: form.state?.trim().toUpperCase() || null,
    addressCity: form.city?.trim() || null,
    contactName: form.contactName?.trim() || null,
    contactCpf: form.contactCpf?.trim() || null,
    contactPhone: form.contactPhone?.trim() || null,
    contactEmail: form.contactEmail?.trim() || null,
    contactAddress: form.contactAddress?.trim() || null,
    notes: form.notes?.trim() || null,
  };
}
