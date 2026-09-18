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

/**
 * Faz upload da FOTO da pessoa. Lê o File como base64 (data URL → separa o
 * prefixo `data:...;base64,`) e envia ao endpoint dedicado, que persiste no
 * storage e grava person.photoUrl.
 *   POST /people/:id/photo → { photoUrl }  (assinado, algo em /files/...)
 * @param {string} id    id da pessoa (precisa já existir)
 * @param {File}   file  arquivo de imagem (PNG/JPEG)
 * @returns {Promise<{ photoUrl: string }>}
 */
export function uploadPersonPhoto(id, file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = async () => {
      try {
        const result = String(reader.result || "");
        const contentBase64 = result.includes(",")
          ? result.slice(result.indexOf(",") + 1)
          : result;
        const data = await api.post(`/people/${id}/photo`, {
          contentBase64,
          fileName: file.name,
          mimeType: file.type,
        });
        resolve(data); // { photoUrl }
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

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

/**
 * Monta a linha de endereço só para EXIBIÇÃO (detalhe/tabela). A concatenação
 * vive aqui, na apresentação — nunca no que volta para a API. Antes o endereço
 * era guardado concatenado no view model e regravado inteiro em `addressStreet`,
 * o que apagava número e bairro a cada salvamento.
 */
export function formatAddressLine(p) {
  const street = [p.addressStreet, p.addressNumber].filter(Boolean).join(", ");
  return [street, p.addressDistrict].filter(Boolean).join(" · ");
}

// "Cidade — UF" para exibição (a API guarda cidade e UF em colunas separadas).
export function formatCityLine(p) {
  return [p.addressCity, p.addressState].filter(Boolean).join(" — ");
}

// Linha da tabela (vem de GET /people — anotado com roles/concessionsCount/portal)
// ATENÇÃO: é um resumo de EXIBIÇÃO. Nunca use uma linha para semear o formulário
// de edição — o form só abre a partir do detalhe (GET /people/:id).
export function toPersonRow(p) {
  return {
    id: p.id,
    name: p.fullName,
    photoUrl: p.photoUrl || null, // foto assinada (quando houver) — senão, iniciais
    cpf: p.cpf || "",
    rg: p.rg || "",
    email: p.email || "",
    phone: p.phonePrimary || p.phoneSecondary || "",
    whatsapp: p.whatsapp || "",
    city: formatCityLine(p),
    roles: p.roles || [],
    concessionsCount: p.concessionsCount || 0,
    portal: toPortalView(p.portal),
    active: p.active !== false,
  };
}

// Detalhe completo (vem de GET /people/:id — inclui concessions/relationships)
// Devolve os campos de endereço SEPARADOS (é o que o formulário edita e o que a
// API persiste) e, além deles, as versões concatenadas usadas só na exibição.
export function toPersonDetail(p) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.fullName,
    photoUrl: p.photoUrl || null, // foto assinada (quando houver) — senão, iniciais
    cpf: p.cpf || "",
    rg: p.rg || "",
    birth: ymdToBr(p.birthDate),
    gender: p.gender || "",
    email: p.email || "",
    phonePrimary: p.phonePrimary || "",
    phoneSecondary: p.phoneSecondary || "",
    phone: p.phonePrimary || p.phoneSecondary || "",
    whatsapp: p.whatsapp || "",
    // endereço — campos reais (1:1 com as colunas do model Person)
    street: p.addressStreet || "",
    number: p.addressNumber || "",
    complement: p.addressComplement || "",
    district: p.addressDistrict || "",
    city: p.addressCity || "",
    state: p.addressState || "",
    zipcode: p.addressZipcode || "",
    // versões prontas para exibir (não voltam para a API)
    addressLine: formatAddressLine(p),
    cityLine: formatCityLine(p),
    roles: p.roles || [],
    concessions: (p.concessions || []).map((c) => ({
      id: c.id,
      grave: c.grave?.code || c.graveId || "—",
      type: CONCESSION_TYPE_LABEL[c.concessionType] || c.concessionType || "",
      status: CONCESSION_STATUS_LABEL[c.status] || c.status || "",
    })),
    // concessões em que a pessoa é o RESPONSÁVEL legal (não a proprietária)
    responsibleFor: (p.responsibleConcessions || []).map((c) => ({
      id: c.id,
      grave: c.grave?.code || c.graveId || "—",
      owner: c.person?.fullName || "—",
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

// view model do formulário → payload aceito pela API (EDITABLE_FIELDS).
// Cada campo do endereço vai no SEU campo — sem concatenar/splitar. O split de
// "Cidade — UF" e a concatenação de logradouro/número/bairro corrompiam dados:
// o que era exibido junto voltava gravado numa coluna só.
export function toPersonPayload(form) {
  const t = (v) => (v == null ? "" : String(v).trim());
  return {
    fullName: t(form.fullName),
    cpf: t(form.cpf) || null,
    rg: t(form.rg) || null,
    birthDate: brToYmd(form.birth),
    gender: form.gender || null,
    email: t(form.email) || null,
    whatsapp: t(form.whatsapp) || null,
    phonePrimary: t(form.phonePrimary) || null,
    phoneSecondary: t(form.phoneSecondary) || null,
    addressStreet: t(form.street) || null,
    addressNumber: t(form.number) || null,
    addressDistrict: t(form.district) || null,
    addressCity: t(form.city) || null,
    addressState: t(form.state).toUpperCase() || null,
    addressZipcode: t(form.zip) || null,
    notes: t(form.notes) || null,
  };
}

/**
 * BLINDAGEM CONTRA PERDA DE DADOS (PATCH parcial).
 *
 * O `pick(EDITABLE_FIELDS)` da API aplica TODA chave presente no body — mandar
 * o conjunto completo com `|| null` apaga no banco o que o formulário não
 * carregou. Como o form agora sempre abre a partir do detalhe COMPLETO, o risco
 * some; ainda assim só enviamos o que realmente MUDOU (defesa em profundidade):
 * um campo que o formulário não editou nem sequer viaja no PATCH, então não há
 * como ser zerado por engano.
 *
 * @param {object} payload  payload novo (toPersonPayload do form)
 * @param {object} base     payload equivalente ao estado carregado (original)
 * @returns {object} só as chaves alteradas
 */
export function diffPersonPayload(payload, base) {
  if (!base) return payload;
  const out = {};
  Object.keys(payload).forEach((k) => {
    const a = payload[k] ?? null;
    const b = base[k] ?? null;
    if (a !== b) out[k] = payload[k];
  });
  return out;
}

/** Detalhe (toPersonDetail) → payload, para servir de base no diff acima. */
export function detailToPersonForm(d) {
  if (!d) return null;
  return {
    fullName: d.name || "",
    cpf: d.cpf || "",
    rg: d.rg || "",
    birth: d.birth || "",
    gender: d.gender || "",
    email: d.email || "",
    whatsapp: d.whatsapp || "",
    phonePrimary: d.phonePrimary || "",
    phoneSecondary: d.phoneSecondary || "",
    street: d.street || "",
    number: d.number || "",
    district: d.district || "",
    city: d.city || "",
    state: d.state || "",
    zip: d.zipcode || "",
    notes: d.notes || "",
  };
}
