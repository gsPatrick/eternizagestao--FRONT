/**
 * Resolve o subdomínio de cidade do lado do CLIENTE.
 *
 * Em produção o middleware seta o cookie `eterniza_tenant=<sub>` para hosts de
 * cidade (guarulhos.eternizagestao.com.br). Em dev/local o subdomínio não existe, mas
 * o fluxo atual carrega a cidade pelo `?t=` da URL — usamos isso como fallback.
 *
 * Retorna o subdomínio (ex.: "guarulhos") ou null quando estamos no contexto
 * plataforma (apex, sem cookie e sem `?t=`).
 */
const TENANT_COOKIE = "eterniza_tenant";

function readCookie(name) {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  if (!match) return null;
  const value = match.slice(name.length + 1);
  return decodeURIComponent(value) || null;
}

export function getClientSubdomain() {
  if (typeof window === "undefined") return null;
  const fromCookie = readCookie(TENANT_COOKIE);
  if (fromCookie) return fromCookie;
  const fromQuery = new URLSearchParams(window.location.search).get("t");
  return fromQuery || null;
}
