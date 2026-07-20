import "./globals.css";

export const metadata = {
  title: "Eterniza Gestão",
  description: "Sistema de gestão de cemitérios — plataforma multi-cliente",
};

// Anti-flash (FOUC) da marca da cidade: script SÍNCRONO e bloqueante no <head>.
// Roda ANTES da primeira pintura e aplica em :root as variáveis de cor da cidade
// guardadas no último acesso (cache por subdomínio). Assim a página já nasce na
// cor da cidade — sem o "piscar" navy até o TenantTheme/getMe resolverem.
//
// Segurança visual: só aplica quando há o cookie `eterniza_tenant` (subdomínio da
// cidade) E existe cache daquele subdomínio. No apex/plataforma (sem cookie) não
// faz nada → a landing/admin seguem no navy padrão. Falha silenciosa.
const THEME_SCRIPT = `(function(){try{
var m=document.cookie.match(/(?:^|;\\s*)eterniza_tenant=([^;]+)/);
if(!m)return;
var raw=localStorage.getItem('eterniza:themeVars:'+decodeURIComponent(m[1]));
if(!raw)return;
var v=JSON.parse(raw),r=document.documentElement;
for(var k in v){if(k.indexOf('--color-navy')===0)r.style.setProperty(k,v[k]);}
}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
