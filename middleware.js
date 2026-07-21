import { NextResponse } from "next/server";

/**
 * Middleware de SUBDOMÍNIO → tenant (Host → cidade).
 *
 * A cidade é sempre o PRIMEIRO rótulo do Host (guarulhos.<qualquer-domínio>).
 * A regra é do SUBDOMÍNIO — o domínio raiz é IGNORADO de propósito, então o
 * mesmo código funciona para eternizagestao.com.br, um domínio próprio da
 * cidade, ou qualquer apex futuro, sem tocar aqui. O middleware lê o Host,
 * extrai o subdomínio e o EXPÕE para a app resolver a cidade via:
 *   - header de request `x-tenant-subdomain` (lido por server components/rotas)
 *   - cookie `eterniza_tenant` (lido no cliente por login/TenantTheme)
 *
 * Contexto PLATAFORMA (super_admin) — NÃO seta tenant — quando:
 *   - o path começa com `/admin`, OU
 *   - o Host é o apex (sem subdomínio) ou o rótulo é reservado (admin/www/…).
 *
 * DEV (localhost / IP) é NO-OP: não há subdomínio, então nada é setado e a app
 * continua resolvendo a cidade pelo `?t=` do fluxo atual (não quebra o dev).
 */

const TENANT_COOKIE = "eterniza_tenant";
const TENANT_HEADER = "x-tenant-subdomain";

// Labels que NÃO são cidade — caem no contexto plataforma.
const RESERVED = new Set(["www", "admin", "app", "api", "portal"]);

// Rótulos de 2º nível (ccTLDs com SLD): com.br, co.uk, gov.br, etc. Servem só
// para saber quantos rótulos formam o domínio "raiz" (apex) e assim distinguir
// o apex de um host com subdomínio — SEM fixar qual é o domínio.
const SECOND_LEVEL = new Set([
  "com", "co", "org", "net", "gov", "edu", "mil", "gob", "ac", "or", "ne", "in",
]);

// Host é dev/local? (localhost, *.localhost, 127.0.0.1, IPs) → sem subdomínio.
function isLocalHost(hostname) {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
  );
}

// Nº de rótulos do domínio apex: 2 normalmente (dominio.com), 3 quando há SLD
// tipo com.br/co.uk (dominio.com.br).
function apexLabelCount(labels) {
  if (labels.length >= 3 && SECOND_LEVEL.has(labels[labels.length - 2])) return 3;
  return 2;
}

/**
 * Extrai o subdomínio de cidade do Host — agnóstico ao domínio raiz. É o
 * primeiro rótulo quando o Host tem MAIS rótulos que o apex; caso contrário
 * (apex puro, dev, IP) retorna null.
 *   guarulhos.eternizagestao.com.br → "guarulhos"
 *   eternizagestao.com.br           → null (apex → plataforma)
 *   guarulhos.qualquerdominio.com   → "guarulhos"
 */
function extractSubdomain(host) {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase().trim(); // remove porta
  if (isLocalHost(hostname)) return null; // DEV → no-op
  const labels = hostname.split(".").filter(Boolean);
  if (labels.length <= apexLabelCount(labels)) return null; // apex puro
  return labels[0] || null; // 1º rótulo = subdomínio da cidade
}

export function middleware(request) {
  // /design-system é ferramenta INTERNA (paleta/componentes com dados fictícios).
  // Não é linkada em lugar nenhum, mas responderia por URL direta em produção.
  // Bloqueamos aqui, e não com notFound() dentro da page: a página é
  // "use client" e pode ser pré-renderizada estaticamente, então a checagem no
  // middleware é a única que roda em TODA requisição, antes de servir qualquer
  // HTML. Em desenvolvimento a rota continua funcionando normalmente.
  if (
    process.env.NODE_ENV === "production" &&
    request.nextUrl.pathname.startsWith("/design-system")
  ) {
    // rewrite para um path inexistente → Next serve a página 404 com status 404.
    return NextResponse.rewrite(new URL("/rota-inexistente-design-system", request.url));
  }

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
