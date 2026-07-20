"use client";

import { useEffect, useState } from "react";
import { useResource } from "@/lib/api/useResource";
import {
  searchPublic,
  buildSearchParams,
  mapSearchResult,
  resolvePublicTenant,
} from "@/lib/api/resources/public";

/**
 * Autocomplete da busca pública (Hero / SearchBand). Debounce curto sobre o
 * texto e consulta real à API; o useResource cancela a requisição anterior.
 * Devolve o mesmo shape que os componentes já renderizam: { id, label, meta }.
 *
 * @param {string} query           texto sendo digitado
 * @param {object} opts
 * @param {string|null} opts.tenant  slug do tenant (dev → guarulhos)
 * @param {number} [opts.delay=220]  debounce em ms
 * @returns {{ id:string, label:string, meta:string }[]}
 */
export function usePublicSuggestions(query, { tenant, delay = 220 } = {}) {
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), delay);
    return () => clearTimeout(t);
  }, [query, delay]);

  const params = buildSearchParams(debounced);
  const tenantSub = resolvePublicTenant(tenant);
  const enabled = Boolean(params.q) && Boolean(tenantSub);

  const { data } = useResource(
    ({ signal }) =>
      enabled
        ? searchPublic({ ...params, perPage: 6 }, { tenant: tenantSub, signal })
        : Promise.resolve({ data: [], meta: null }),
    [debounced, tenantSub]
  );

  if (!enabled) return [];

  const seen = new Set();
  const out = [];
  for (const item of data?.data || []) {
    const r = mapSearchResult(item);
    const label = r.name || r.code;
    if (!label || seen.has(label)) continue;
    seen.add(label);
    // meta cobre os novos campos: cova + quadra e/ou cemitério
    const bits = [];
    if (r.code) bits.push(r.code);
    if (r.block) bits.push(r.block);
    if (!bits.length && r.cemetery) bits.push(r.cemetery);
    out.push({
      id: r.id,
      label,
      meta: bits.join(" · ") || "Consulta pública",
    });
    if (out.length >= 6) break;
  }
  return out;
}
