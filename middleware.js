import { NextResponse } from "next/server";

/**
 * Middleware de SUBDOMÍNIO → tenant (Host → cidade).
 *
 * Em produção cada cidade tem seu subdomínio (guarulhos.eterniza.com.br). Este
 * middleware lê o Host, extrai o subdomínio e o EXPÕE para a app resolver a
 * cidade automaticamente (telas de login/públicas/portal) via:
 *   - header de request `x-tenant-subdomain` (lido por server components/rotas)
 *   - cookie `eterniza_tenant` (lido no cliente por login/TenantTheme)
 *
 * Contexto PLATAFORMA (super_admin) — NÃO seta tenant — quando:
 *   - o path começa com `/admin`, OU
 *   - o subdomínio é `admin`/`www`/vazio (apex `eterniza.com.br`).
 *
 * DEV (localhost / IP) é NO-OP: não há subdomínio, então nada é setado e a app
 * continua resolvendo a cidade pelo `?t=` do fluxo atual (não quebra o dev).
 *
 * DNS wildcard (*.eterniza.com.br) + TLS é infraestrutura, fora do código.
 */

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "eterniza.com.br";
const TENANT_COOKIE = "eterniza_tenant";
const TENANT_HEADER = "x-tenant-subdomain";

// Labels que NÃO são cidade — caem no contexto plataforma.
const RESERVED = new Set(["www", "admin", "app", "api", "portal"]);

// Host é dev/local? (localhost, *.localhost, 127.0.0.1, IPs) → sem subdomínio.
function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

/**
 * Extrai o subdomínio de cidade do Host, ou null quando não há (dev, apex,
 * www/admin, domínio desconhecido). Só considera hosts sob o BASE_DOMAIN.
 */
function extractSubdomain(host) {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase().trim(); // remove porta
  if (isLocalHost(hostname)) return null; // DEV → no-op
  const suffix = `.${BASE_DOMAIN}`;
  // apex (eterniza.com.br) ou domínio fora da base → sem tenant.
  if (hostname === BASE_DOMAIN || !hostname.endsWith(suffix)) return null;
  // primeira label antes do domínio base: "guarulhos.eterniza.com.br" → "guarulhos"
  const label = hostname.slice(0, -suffix.length).split(".")[0];
  return label || null;
}

export function middleware(request) {
  const host = request.headers.get("host") || "";
  const hostname = host.split(":")[0].toLowerCase().trim();

  // DEV é no-op absoluto: não toca headers nem cookies (segue o fluxo `?t=`).
  if (isLocalHost(hostname)) return NextResponse.next();

  const { pathname } = request.nextUrl;
  const sub = extractSubdomain(host);

  // PLATAFORMA (super_admin): /admin, subdomínio reservado ou sem subdomínio.
  const isPlatform = pathname.startsWith("/admin") || !sub || RESERVED.has(sub);

  if (isPlatform) {
    // Garante que nenhum tenant vaze no contexto plataforma.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.delete(TENANT_HEADER);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.cookies.delete(TENANT_COOKIE);
    return res;
  }

  // CIDADE: expõe o subdomínio (header de request + cookie legível no cliente).
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(TENANT_HEADER, sub);
  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.cookies.set(TENANT_COOKIE, sub, { path: "/", sameSite: "lax" });
  return res;
}

// Não roda em assets/_next/arquivos estáticos (qualquer path com extensão).
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|files|.*\\.).*)"],
};
