import "./globals.css";
import { headers } from "next/headers";
import { getPublicTenants } from "@/lib/api/resources/public";
import { normalizeApiTenant, themeVarsFor } from "@/lib/tenants";

export const metadata = {
  title: "Eterniza Gestão",
  description: "Sistema de gestão de cemitérios — plataforma multi-cliente",
};

// Anti-flash (FOUC) da marca da cidade — 2 camadas:
//
// 1) SSR (server): lê o subdomínio (header do middleware), busca as cores da
//    cidade na API e injeta um <style>:root com as variáveis JÁ no 1º HTML.
//    Assim a página nasce na cor da cidade até no PRIMEIRÍSSIMO acesso (sem
//    cache no navegador). Cacheado por 5 min (revalidate) para não pesar o SSR;
//    o cliente ainda reconfirma a cor após a hidratação.
// 2) Cliente (fallback): script síncrono que aplica o cache do último acesso.
//    Só roda quando o SSR NÃO resolveu (data-theme-ssr ausente) — ex.: API fora
//    do ar no SSR. No apex/plataforma (sem subdomínio) nenhuma das duas age →
//    a landing/admin seguem no navy padrão.
const THEME_SCRIPT = `(function(){try{
if(document.documentElement.getAttribute('data-theme-ssr'))return;
var m=document.cookie.match(/(?:^|;\\s*)eterniza_tenant=([^;]+)/);
if(!m)return;
var raw=localStorage.getItem('eterniza:themeVars:'+decodeURIComponent(m[1]));
if(!raw)return;
var v=JSON.parse(raw),r=document.documentElement;
for(var k in v){if(k.indexOf('--color-navy')===0)r.style.setProperty(k,v[k]);}
}catch(e){}})();`;

// Resolve o CSS :root do tema da cidade no SSR (ou null → navy padrão).
async function resolveTenantThemeCss() {
  try {
    const sub = headers().get("x-tenant-subdomain");
    if (!sub) return null; // apex/plataforma → sem tema (navy)
    const list = await getPublicTenants({ auth: false, next: { revalidate: 300 } });
    if (!Array.isArray(list)) return null;
    const match = list.find(
      (t) => String(t.subdomain || "").toLowerCase() === sub.toLowerCase()
    );
    if (!match) return null;
    const vars = themeVarsFor(normalizeApiTenant(match));
    const body = Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
    return `:root{${body}}`;
  } catch {
    return null; // API fora do ar no SSR → cai no script de cache/no navy
  }
}

export default async function RootLayout({ children }) {
  const themeCss = await resolveTenantThemeCss();

  return (
    <html lang="pt-BR" data-theme-ssr={themeCss ? "1" : undefined}>
      <head>
        {themeCss && <style dangerouslySetInnerHTML={{ __html: themeCss }} />}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
