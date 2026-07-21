import { api } from "@/lib/api/client";
import { API_URL } from "@/lib/api/client";
import { getToken } from "@/lib/api/session";

/* ============================================================================
 * Documentos oficiais — resource fino sobre o client da API.
 * Uma função por endpoint real de:
 *   src/features/documents/documents.routes.js            (/documents)
 *   src/features/document-templates/document-templates.routes.js (/document-templates)
 *   src/features/document-signatures/document-signatures.routes.js (/documents/:id/signatures)
 * Sem estado, sem React. O FRONT é a fonte da verdade do shape consumido pela
 * página app/painel/documentos; os adapters ao final mapeiam o payload da API
 * para o modelo que o layout já renderiza (documento, modelo, assinatura).
 * ==========================================================================*/

// Os arquivos emitidos são servidos ESTATICAMENTE pela API na sua própria origem
// (ex.: http://localhost:3333/files/...), fora do prefixo /api/v1. Derivamos a
// origem da API a partir da base para montar a URL absoluta do arquivo.
// helper compartilhado (mesma regra usada pelo mapa/ortofoto). Importado E
// reexportado: as telas já consomem `fileHref` deste módulo.
import { fileHref } from "@/lib/api/file-url";
export { fileHref };

// Mesma base das demais chamadas (client.js) — resolver por conta própria
// aqui já causou download apontando para localhost em produção.
const API_BASE = API_URL;

// Baixa o PDF oficial pelo endpoint AUTENTICADO GET /documents/:id/pdf (o back
// gera/cacheia sob demanda). Devolve um object URL (blob) pronto para download.
// Usado quando o documento ainda não tem `pdfUrl` assinado (ex.: emitido antes
// do recurso de PDF). Retorna application/pdf.
export async function fetchDocumentPdf(id) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/documents/${id}/pdf`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Não foi possível gerar o PDF do documento.");
  return URL.createObjectURL(await res.blob());
}

/* ============================ Documentos ============================ */

// LISTA paginada → { meta: true } → devolve { data, meta }.
// params aceitos pela API: { page, perPage, documentType, status, year, graveId,
//   deceasedId, personId }.
export const listDocuments = (params, opts) =>
  api.get("/documents", { params, meta: true, ...opts });

// Detalhe (inclui signatures + template).
export const getDocument = (id, opts) => api.get(`/documents/${id}`, opts);

// EMISSÃO — numeração sequencial automática por tenant/tipo/ano (no back).
// body: { documentType (obrigatório), templateId?, data?, graveCode?, notes?,
//   referenceType?, referenceId?, graveId?, deceasedId?, personId? }.
export const issueDocument = (body) => api.post("/documents", body);

// 2ª via — nova emissão (novo número) vinculada ao original.
export const reissueDocument = (id) => api.post(`/documents/${id}/reissue`);

// Cancelamento — a numeração NÃO é reaproveitada; o motivo vai para auditoria.
export const cancelDocument = (id, reason) =>
  api.patch(`/documents/${id}/cancel`, { reason });

/* ============================ Texto legal por cidade ============================ */
// Config do texto legal dos modelos oficiais (certidão/autorização), guardada em
// tenant.settings.documents. GET devolve { legalCertidao, legalAutorizacao } já
// com os defaults aplicados; PATCH persiste os dois textos (admin).
export const getDocumentSettings = (opts) => api.get("/documents/settings", opts);
export const updateDocumentSettings = (body) => api.patch("/documents/settings", body);

/* ============================ Modelos (templates) ============================ */

export const listTemplates = (params, opts) =>
  api.get("/document-templates", { params, meta: true, ...opts });

export const getTemplate = (id, opts) => api.get(`/document-templates/${id}`, opts);

// body: { documentType (obrigatório), name (obrigatório), bodyHtml?, fileUrl?,
//   active?, deactivateOthers? }.
export const createTemplate = (body) => api.post("/document-templates", body);

// UPDATE só altera { name, fileUrl, bodyHtml, active } (tipo é imutável no back).
export const updateTemplate = (id, body) => api.patch(`/document-templates/${id}`, body);

export const deleteTemplate = (id) => api.del(`/document-templates/${id}`);

/* ============================ Assinaturas ============================ */

export const listSignatures = (documentId, opts) =>
  api.get(`/documents/${documentId}/signatures`, opts);

// Envia para assinatura eletrônica. body: { signerName (obrigatório), signerEmail?,
//   signerCpf?, signerRole?, signerPersonId? }. Retorna { signature, signUrl }.
export const createSignature = (documentId, body) =>
  api.post(`/documents/${documentId}/signatures`, body);

// Simula o retorno do provedor (driver mock) — marca a assinatura como assinada.
export const simulateSignature = (documentId) =>
  api.post(`/documents/${documentId}/signatures/simulate`);

/* ============================================================================
 * Adapters de apresentação — payload da API → modelo do front.
 * O layout (app/painel/documentos) espera: documento, modelo e assinatura em um
 * shape estável. Estes adapters toleram tanto o payload rico (com includes de
 * sepultura/pessoa/quem emitiu/2ª via) quanto o enxuto (apenas escalares).
 * ==========================================================================*/

const REFERENCE_LABELS = {
  payment: "Pagamento",
  burial: "Sepultamento",
  concession: "Concessão",
  exhumation: "Exumação",
  grave: "Sepultura",
};

// ISO/Date → "dd/mm/aaaa" (fuso de São Paulo).
export function formatDate(value) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Sao_Paulo",
  });
}

// O motivo do cancelamento é anexado às notes pela API como "Cancelamento: <motivo>".
function cancelReasonFromNotes(notes) {
  if (!notes) return "";
  const m = String(notes).match(/Cancelamento:\s*(.+)/i);
  return m ? m[1].trim() : "";
}

// A linha de "vínculo" (display ref) que o front persiste em notes na emissão —
// removendo a linha de cancelamento, se houver.
function refFromNotes(notes) {
  if (!notes) return "";
  return String(notes)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !/^Cancelamento:/i.test(l))
    .join(" · ")
    .trim();
}

// "Vinculado a": prioriza as associações reais (sepultura/pessoa/sepultado);
// cai para a display-ref persistida em notes; por fim para o tipo de origem.
function docRef(d) {
  const parts = [];
  const graveCode = d.grave?.code;
  if (graveCode) parts.push(`Jazigo ${graveCode}`);
  const name = d.person?.fullName || d.deceased?.fullName;
  if (name) parts.push(name);
  if (parts.length) return parts.join(" · ");

  const noteRef = refFromNotes(d.notes);
  if (noteRef) return noteRef;

  if (d.referenceType) return REFERENCE_LABELS[d.referenceType] || d.referenceType;
  return "—";
}

// Escolhe a assinatura "corrente" de um documento: a assinada, senão a mais recente.
function pickSignature(signatures) {
  if (!Array.isArray(signatures) || signatures.length === 0) return null;
  const signed = signatures.find((s) => s.status === "assinado");
  if (signed) return signed;
  // ordena por createdAt e devolve a última (mais recente).
  return [...signatures].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  ).at(-1);
}

// DocumentSignature da API → bloco de assinatura do front.
// (o cargo do signatário é persistido em `notes` no back — sem coluna própria.)
export function adaptSignature(s) {
  if (!s) return null;
  return {
    id: s.id,
    signer: s.signerName,
    role: s.notes || "",
    sentAt: formatDate(s.createdAt),
    signedAt: s.signedAt ? formatDate(s.signedAt) : null,
    hash: s.signatureHash || null,
    ip: s.ipAddress || null,
    status: s.status,
  };
}

// Document da API → item do front (o shape que a tabela/detalhe já consomem).
// `type` e `number` são preservados crus para a página montar o número formatado
// com o prefixo do tipo (ex.: "CP 0007/2026") a partir do seu próprio DOC_TYPES.
export function adaptDocument(d) {
  return {
    id: d.id,
    type: d.documentType,
    number: d.number,
    formattedNumber: d.formattedNumber,
    status: d.status,
    url: fileHref(d.fileUrl),
    // PDF oficial (URL assinada). Preenchido na emissão; ausente até existir —
    // nesse caso o front cai no endpoint GET /documents/:id/pdf (gera sob demanda).
    pdfUrl: fileHref(d.pdfUrl),
    issuedAt: formatDate(d.issuedAt),
    issuedBy: d.issuedBy?.name || "—",
    ref: docRef(d),
    isReissue: (d.reissueCount || 0) > 0 || Boolean(d.originalDocumentId),
    originalType: d.originalDocument?.documentType || null,
    originalNumber: d.originalDocument?.number ?? null,
    signature: adaptSignature(pickSignature(d.signatures)),
    cancelReason: cancelReasonFromNotes(d.notes),
  };
}

// DocumentTemplate da API → modelo do front (`content` = bodyHtml).
export function adaptTemplate(t) {
  return {
    id: t.id,
    name: t.name,
    type: t.documentType,
    active: t.active,
    content: t.bodyHtml || "",
    version: t.version,
    updated: formatDate(t.updatedAt),
  };
}
