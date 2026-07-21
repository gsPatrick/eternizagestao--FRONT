import { notFound } from "next/navigation";
import TenantLanding from "@/components/templates/TenantLanding/TenantLanding";
import { normalizeApiTenant, resolveTenant } from "@/lib/tenants";
import { getPublicTenants } from "@/lib/api/resources/public";

/**
 * Página PÚBLICA do tenant — /[cidade] (ex.: /guarulhos). É a cara pública
 * daquele cemitério: temada pela cor/marca do cliente, com a busca do cidadão,
 * SEM as seções de venda (isso é só da landing institucional da Eterniza).
 * O tenant é definido pelo início da URL e resolvido pela API (fonte da verdade).
 */

// Slugs dinâmicos: a lista de cidades vive na API, não no build. Geramos zero
// rotas estáticas e deixamos o Next resolver cada slug sob demanda.
export const dynamicParams = true;
// Sempre resolve a lista de cidades ao vivo — uma cidade recém-criada precisa
// abrir na hora (sem o cache de fetch padrão do Next servindo lista velha).
export const dynamic = "force-dynamic";
export function generateStaticParams() {
  return [];
}

// Fonte ÚNICA das cidades: GET /public/tenants. Se a API falhar, retorna null
// (≠ lista vazia) e a página mostra um erro honesto — nunca uma lista estática
// de prefeituras, que exibiria municípios que não são clientes.
// Slug inexistente (com API no ar) → notFound().
async function loadTenants() {
  try {
    const apiTenants = await getPublicTenants({ cache: "no-store" });
    if (Array.isArray(apiTenants)) return apiTenants.map(normalizeApiTenant);
  } catch {
    // offline / erro → null (indisponibilidade, não "cidade inexistente")
  }
  return null;
}

// Estado honesto de indisponibilidade: não sabemos se a cidade existe porque o
// serviço está fora. Um 404 aqui seria mentira; dados inventados, pior ainda.
function ServicoIndisponivel() {
  return (
    <main
      style={{
        minHeight: "70vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        padding: "48px 24px",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: 24, fontWeight: 600 }}>
        Serviço temporariamente indisponível
      </h1>
      <p style={{ maxWidth: "52ch", lineHeight: 1.6, opacity: 0.75 }}>
        Não foi possível carregar os dados desta cidade agora. Tente novamente em
        alguns minutos.
      </p>
    </main>
  );
}

export default async function TenantPublicPage({ params }) {
  const list = await loadTenants();
  if (list === null) return <ServicoIndisponivel />;

  const tenant = resolveTenant(list, params.tenant);
  if (!tenant) notFound();

  return <TenantLanding tenant={tenant} />;
}
