import { api } from "@/lib/api/client";

/* ============================================================================
 * Anexos polimórficos (Attachments). Resource fino sobre os endpoints reais de
 *   src/features/attachments/attachments.routes.js
 *
 *   GET    /attachments?attachableType=&attachableId=  → lista (mais recente 1º)
 *   POST   /attachments  { attachableType, attachableId, category, fileName,
 *                          contentBase64, mimeType, description? }  → anexo criado
 *   DELETE /attachments/:id                                          → 204
 *
 * O backend devolve o anexo com a `fileUrl` ASSINADA (serve em <img>/<iframe>).
 * attachableType aceito: grave, deceased, person, exhumation, burial,
 *   concession, billing, payment, grave_maintenance, document, tenant, cemetery.
 * ==========================================================================*/

// Lê um File como base64 puro (separa o prefixo `data:...;base64,` do data URL).
// Mesmo padrão de uploadTenantLogo (lib/api/resources/tenant.js).
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () =>
      reject(new Error("Não foi possível ler o arquivo selecionado."));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

// bytes → rótulo amigável ("240 KB", "1,2 MB") para a UI de anexos.
export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!n || Number.isNaN(n)) return null;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

// Anexo da API → shape que AttachmentList consome ({ id, name, category, size, url }).
export function toAttachmentView(att = {}) {
  return {
    id: att.id,
    name: att.fileName || "arquivo",
    category: att.category || null,
    size: formatBytes(att.sizeBytes),
    url: att.fileUrl || null,
  };
}

/**
 * LISTA os anexos de uma entidade. Devolve o array de anexos crus da API.
 * @param {{ type: string, id: string }} target  attachableType/attachableId
 * @param {object} [opts]  repassa { signal } do useResource ao client
 */
export const listAttachments = ({ type, id, ...opts } = {}) =>
  api.get("/attachments", {
    params: { attachableType: type, attachableId: id },
    ...opts,
  });

/**
 * FAZ UPLOAD de um anexo. Lê o File como base64 e posta no endpoint dedicado,
 * que persiste no storage e devolve o anexo já com a URL assinada.
 * @param {object} args
 * @param {string} args.type          attachableType (grave|deceased|exhumation|concession…)
 * @param {string} args.id            attachableId
 * @param {File}   args.file          arquivo escolhido pelo usuário
 * @param {string} [args.category]    categoria da UI (Foto, Certidão de óbito…)
 * @param {string} [args.description]
 * @param {string} [args.fileName]    sobrescreve file.name (o modal permite renomear)
 * @returns {Promise<object>}  anexo criado (serializado, com fileUrl assinada)
 */
export async function uploadAttachment({ type, id, file, category, description, fileName } = {}) {
  const contentBase64 = await readFileAsBase64(file);
  return api.post("/attachments", {
    attachableType: type,
    attachableId: id,
    category,
    fileName: fileName || file.name,
    mimeType: file.type,
    contentBase64,
    description,
  });
}

// REMOVE um anexo pelo id (204). Recarregue a lista após remover.
export const deleteAttachment = (id) => api.del(`/attachments/${id}`);
