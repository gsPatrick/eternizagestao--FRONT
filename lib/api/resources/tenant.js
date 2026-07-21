import { api } from "@/lib/api/client";

/* ============================================================================
 * Onboarding / Configuração da PRÓPRIA cidade (admin da prefeitura).
 * Resource fino sobre o client da API. Uma função por endpoint real de:
 *   - src/features/tenants/onboarding.routes.js
 * Ambas exigem token de admin da cidade. O tenant é resolvido SEMPRE pelo
 * token (o backend ignora header/subdomínio aqui), então não é preciso enviar
 * X-Tenant-Subdomain — o admin só consegue configurar o próprio tenant.
 *   GET   /tenant/onboarding   → status + config atual do tenant do token
 *   PATCH /tenant/onboarding   → grava marca/órgão gestor/contato; conclui
 * ==========================================================================*/

// STATUS + config atual. Recebe { signal } do useResource e repassa ao client.
export const getOnboarding = (opts) => api.get("/tenant/onboarding", opts);

/**
 * Salva a configuração da cidade.
 * @param {object} body  campos do onboarding (primaryColor, secondaryColor,
 *   logoUrl, documentHeader, legalName, cnpj, email, phone, address...).
 * @param {boolean} [body.concluir]  padrão true (conclui o onboarding);
 *   passe { concluir:false } para SALVAR sem concluir (rascunho).
 */
export const saveOnboarding = (body) => api.patch("/tenant/onboarding", body);

/**
 * Faz upload da LOGO do tenant. Lê o File como base64 (data URL → separa o
 * prefixo `data:...;base64,`) e envia ao endpoint dedicado, que persiste no
 * storage e grava tenant.logoUrl.
 *   POST /tenant/logo → { logoUrl }  (algo em /files/...)
 * @param {File} file  arquivo de imagem (PNG/JPEG/SVG)
 * @returns {Promise<{ logoUrl: string }>}
 */
export function uploadTenantLogo(file) {
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
        const data = await api.post("/tenant/logo", {
          contentBase64,
          fileName: file.name,
          mimeType: file.type,
        });
        resolve(data); // { logoUrl }
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Upload de uma IMAGEM DA PÁGINA PÚBLICA da cidade (hero ou rodapé). Cada
 * cidade pode ter a própria arte — sem upload, a landing usa a da plataforma.
 *   POST /tenant/public-image/:kind → { heroImageUrl } | { footerImageUrl }
 * @param {'hero'|'footer'} kind
 * @param {File} file  imagem PNG/JPEG/WEBP (até 12 MB)
 */
export function uploadTenantPublicImage(kind, file) {
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
        const data = await api.post(`/tenant/public-image/${kind}`, {
          contentBase64,
          fileName: file.name,
          mimeType: file.type,
        });
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

/* ============================================================================
 * Integrações POR CIDADE (financeiro/Asaas, e-mail/SMTP, WhatsApp).
 * Resource fino sobre os endpoints de src/features/tenants/integrations.routes.js.
 * Tenant resolvido SEMPRE pelo token — não precisa de X-Tenant-Subdomain. O GET
 * devolve status MASCARADO (segredos nunca vêm em claro):
 *   GET   /tenant/integrations             → { financeiro, email, whatsapp }
 *   PATCH /tenant/integrations/financeiro  → { apiKey?, environment }
 *   PATCH /tenant/integrations/email       → { host, port, secure, user, password?, fromName, fromEmail }
 * ==========================================================================*/

// STATUS mascarado das integrações. Recebe { signal } do useResource.
export const getIntegrations = (opts) => api.get("/tenant/integrations", opts);

// Salva o Asaas. apiKey só quando o admin digita uma nova (senão mantém a atual).
export const saveFinanceiro = (body) => api.patch("/tenant/integrations/financeiro", body);

// Testa a conexão com o Asaas da cidade (usa a chave já salva). O backend chama
// o driver.testConnection e devolve { ok, account? , message? } — nunca 500 por
// credencial inválida (key ruim → { ok:false, message } amigável).
//   POST /tenant/integrations/financeiro/test
export const testFinanceiro = () => api.post("/tenant/integrations/financeiro/test");

// Salva o SMTP. password só quando o admin digita uma nova (senão mantém a atual).
export const saveEmail = (body) => api.patch("/tenant/integrations/email", body);

// Envia um e-mail de teste pelo SMTP da cidade (usa a config já salva). O backend
// nunca lança por credencial/host ruim → { ok, message } amigável.
//   POST /tenant/integrations/email/test
export const testEmail = () => api.post("/tenant/integrations/email/test");

/* ============================================================================
 * WhatsApp (instância Evolution POR CIDADE) — conectar/status/desconectar.
 *   POST /tenant/integrations/whatsapp/connect     → { ok, qrCode, status, mock? }
 *   GET  /tenant/integrations/whatsapp/status       → { status, instanceName, mock? }
 *   POST /tenant/integrations/whatsapp/disconnect   → { ok, status }
 * ==========================================================================*/

// Inicia a conexão: garante a instância + webhook e devolve o QR (base64).
export const whatsappConnect = () => api.post("/tenant/integrations/whatsapp/connect");

// Estado atual da conexão (o backend também atualiza settings). Recebe { signal }.
export const whatsappStatus = (opts) => api.get("/tenant/integrations/whatsapp/status", opts);

// Desconecta/limpa a instância da cidade.
export const whatsappDisconnect = () => api.post("/tenant/integrations/whatsapp/disconnect");

/* ============================================================================
 * Helpers de apresentação — o FRONT é dono do formato do formulário.
 * ==========================================================================*/

// Config da API → shape plano do formulário. O "órgão gestor" mora em
// documentHeader (JSON livre no backend): { nome, cnpj, telefone, email,
// cabecalho }. Pré-preenche a partir dele e cai nos campos de topo quando
// vazio, para uma primeira configuração já vir com dados coerentes.
export function toFormState(t = {}) {
  const dh = t.documentHeader || {};
  return {
    // identidade visual
    primaryColor: t.primaryColor || "#032e59",
    secondaryColor: t.secondaryColor || "#0a4a8c",
    logoUrl: t.logoUrl || "",
    // imagens da página pública da cidade (topo e rodapé)
    heroImageUrl: t.heroImageUrl || "",
    footerImageUrl: t.footerImageUrl || "",
    // órgão gestor (documentHeader)
    orgaoNome: dh.nome || t.legalName || t.name || "",
    orgaoCnpj: dh.cnpj || t.cnpj || "",
    orgaoTelefone: dh.telefone || t.phone || "",
    orgaoEmail: dh.email || t.email || "",
    orgaoCabecalho: dh.cabecalho || "",
    // contato & endereço
    email: t.email || "",
    phone: t.phone || "",
    whatsapp: t.whatsapp || "",
    addressStreet: t.addressStreet || "",
    addressNumber: t.addressNumber || "",
    addressComplement: t.addressComplement || "",
    addressDistrict: t.addressDistrict || "",
    addressCity: t.addressCity || "",
    addressState: t.addressState || "",
    addressZipcode: t.addressZipcode || "",
  };
}

// Shape plano do formulário → payload do PATCH. Espelha o órgão gestor tanto
// no documentHeader (fonte para cabeçalho de documentos) quanto em
// legalName/cnpj de topo, mantendo o tenant serializado coerente.
export function toPatchPayload(form = {}, { concluir } = {}) {
  const payload = {
    primaryColor: form.primaryColor || null,
    secondaryColor: form.secondaryColor || null,
    logoUrl: form.logoUrl?.trim() || null,
    heroImageUrl: form.heroImageUrl?.trim() || null,
    footerImageUrl: form.footerImageUrl?.trim() || null,
    legalName: form.orgaoNome?.trim() || null,
    cnpj: form.orgaoCnpj?.trim() || null,
    documentHeader: {
      nome: form.orgaoNome?.trim() || "",
      cnpj: form.orgaoCnpj?.trim() || "",
      telefone: form.orgaoTelefone?.trim() || "",
      email: form.orgaoEmail?.trim() || "",
      cabecalho: form.orgaoCabecalho?.trim() || "",
    },
    email: form.email?.trim() || null,
    phone: form.phone?.trim() || null,
    whatsapp: form.whatsapp?.trim() || null,
    addressStreet: form.addressStreet?.trim() || null,
    addressNumber: form.addressNumber?.trim() || null,
    addressComplement: form.addressComplement?.trim() || null,
    addressDistrict: form.addressDistrict?.trim() || null,
    addressCity: form.addressCity?.trim() || null,
    addressState: form.addressState?.trim() || null,
    addressZipcode: form.addressZipcode?.trim() || null,
  };
  // concluir:false → salva rascunho; ausência/true → o backend conclui.
  if (concluir === false) payload.concluir = false;
  return payload;
}
