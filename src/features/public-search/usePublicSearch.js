"use client";

import { useResource } from "@/lib/api/useResource";
import {
  searchPublic,
  buildSearchParams,
  buildFilterParams,
  mapSearchResult,
  resolvePublicTenant,
} from "@/lib/api/resources/public";

/**
 * Busca pública (PDF §3.6): termo amplo `q` + filtros opcionais (quadra, lote,
 * jazigo, situacao). Dispara na API quando há critério válido e tenant resolvido;
 * a concorrência (abort da busca anterior) fica por conta do useResource.
 *
 * @param {string|object} input  texto amplo, OU { q, quadra, lote, jazigo, situacao }
 * @param {object} opts
 * @param {string|null} opts.tenant  slug do tenant (?t= ou [tenant]); dev → guarulhos
 * @returns {{ results, meta, loading, error, refetch, status }}
 *   status: 'idle' | 'too-short' | 'ready'
 */
export function usePublicSearch(input, { tenant } = {}) {
  const raw = typeof input === "string" ? { q: input } : input || {};
  const qParams = buildSearchParams(raw.q || "");
  const filters = buildFilterParams(raw);
  const hasFilters = Object.keys(filters).length > 0;
  const hasQ = Boolean(qParams.q);

  const tenantSub = resolvePublicTenant(tenant);
  const enabled = (hasQ || hasFilters) && Boolean(tenantSub);

  const params = { ...(hasQ ? { q: qParams.q } : {}), ...filters };
  const key = JSON.stringify({ params, tenantSub });

  const { data, loading, error, refetch } = useResource(
    ({ signal }) =>
      enabled
        ? searchPublic({ ...params, perPage: 12 }, { tenant: tenantSub, signal })
        : Promise.resolve({ data: [], meta: null }),
    [key]
  );

  // 'idle' só quando nada foi informado; 'too-short' quando o termo amplo é
  // curto E não há filtros que sustentem a busca sozinhos.
  const status =
    qParams.empty && !hasFilters
      ? "idle"
      : qParams.tooShort && !hasFilters
        ? "too-short"
        : "ready";
  const results = (data?.data || []).map(mapSearchResult);

  return {
    results,
    meta: data?.meta || null,
    loading: enabled ? loading : false,
    error,
    refetch,
    status,
  };
}

/** Formata uma data ISO (YYYY-MM-DD) para DD/MM/AAAA; devolve '' se ausente. */
export function formatDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

/** Ano de uma data ISO, para o traço "nascimento — falecimento". */
export function yearOf(iso) {
  if (!iso) return "";
  return String(iso).slice(0, 4);
}
