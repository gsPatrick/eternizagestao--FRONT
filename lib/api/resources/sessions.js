import { api } from "@/lib/api/client";

/* ============================================================================
 * Recuperação de senha ("Esqueci minha senha") — rotas PÚBLICAS (auth:false,
 * ninguém está logado aqui). Uma função por endpoint real:
 *   POST /password-resets          { email, origin } -> 202 (sempre; não revela
 *                                   se o e-mail existe — anti-enumeração)
 *   POST /password-resets/verify   { email, code }   -> { valid: true } | 400
 *   POST /password-resets/confirm  { email, code, password } -> 204
 *
 * `origin` separa o fluxo do ADMIN da cidade ("admin") do PORTAL DA FAMÍLIA
 * ("portal") — contas distintas podem ter o mesmo e-mail.
 *
 * O header X-Tenant-Subdomain vai junto quando a cidade está resolvida (cookie
 * ou `?t=`), pelo mesmo motivo do login: contas de portal são por cidade.
 *
 * Erros que a tela precisa tratar:
 *   503 EMAIL_NOT_CONFIGURED  provedor de e-mail não configurado na plataforma
 *   400  código inválido/expirado
 *   429  rate limit (aguardar antes de tentar de novo)
 * Sem estado, sem React.
 * ==========================================================================*/

// Opções comuns: rota pública + cidade (quando houver) no header.
function publicOpts(tenant) {
  return tenant ? { auth: false, tenant } : { auth: false };
}

// Dispara o envio do código de 6 dígitos. Responde 202 mesmo para e-mail
// inexistente — a tela NÃO deve prometer entrega, só instruir a checar a caixa.
export const requestPasswordReset = ({ email, origin = "admin", tenant } = {}) =>
  api.post("/password-resets", { email, origin }, publicOpts(tenant));

// Confere o código antes de pedir a nova senha (evita o usuário digitar a senha
// e só então descobrir que o código expirou). 400 = inválido/expirado.
export const verifyPasswordReset = ({ email, code, tenant } = {}) =>
  api.post("/password-resets/verify", { email, code }, publicOpts(tenant));

// Efetiva a troca. 204 sem corpo. O código é de uso único: se falhar aqui, o
// usuário precisa pedir um novo.
export const confirmPasswordReset = ({ email, code, password, tenant } = {}) =>
  api.post("/password-resets/confirm", { email, code, password }, publicOpts(tenant));
