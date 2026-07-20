"use client";

import { useResource } from "@/lib/api/useResource";
import { getGraveRoute, getCemeteryMap, resolvePublicTenant } from "@/lib/api/resources/public";
import { haversineMeters } from "./haversine";

/**
 * Rota pública da entrada do cemitério até a sepultura. Busca lat/long reais na
 * API e deriva distância/tempo a pé por Haversine (o roteamento fino na malha
 * de caminhos é responsabilidade do app do visitante).
 *
 * Dois caminhos, ambos com dados REAIS:
 *  - com graveId  → GET /public/graves/:id/route (entrada + alvo autoritativos)
 *  - sem graveId  → GET /public/cemeteries/:id/map (entrada) + coords do jazigo
 *    já trazidas na busca. Cobre a API antes de expor o graveId no /search.
 *
 * @param {object|null} place  resultado da busca ({ graveId, cemeteryId, latitude, longitude, code })
 * @param {object} opts
 * @param {string|null} opts.tenant  slug do tenant (dev → demo)
 */
export function usePublicGraveRoute(place, { tenant } = {}) {
  const tenantSub = resolvePublicTenant(tenant);
  const graveId = place?.graveId || null;
  const cemeteryId = place?.cemeteryId || null;
  const lat = place?.latitude ?? null;
  const lng = place?.longitude ?? null;
  const hasCoords = lat != null && lng != null;
  const enabled = Boolean(tenantSub && (graveId || (cemeteryId && hasCoords)));

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => {
      if (!enabled) return Promise.resolve(null);
      if (graveId) return getGraveRoute(graveId, { tenant: tenantSub, signal });
      // fallback: entrada via mapa do cemitério + coords do próprio jazigo
      return getCemeteryMap(cemeteryId, { tenant: tenantSub, signal }).then((m) => ({
        entrance: {
          latitude: m?.cemetery?.entranceLatitude ?? null,
          longitude: m?.cemetery?.entranceLongitude ?? null,
        },
        target: { latitude: lat, longitude: lng, code: place?.code },
        paths: [],
      }));
    },
    [graveId, cemeteryId, lat, lng, tenantSub]
  );

  let meters = null;
  let minutes = null;
  const e = data?.entrance;
  const t = data?.target;
  if (e && t && e.latitude != null && e.longitude != null && t.latitude != null && t.longitude != null) {
    meters = Math.round(
      haversineMeters(Number(e.latitude), Number(e.longitude), Number(t.latitude), Number(t.longitude))
    );
    minutes = Math.max(1, Math.round(meters / 70)); // ~70 m/min a pé
  }

  // sepultura ainda sem GPS → a API responde 404 GRAVE_NOT_MAPPED (não é erro de UI)
  const notMapped = error?.code === "GRAVE_NOT_MAPPED" || (enabled && !loading && !error && meters == null);

  return {
    route: data || null,
    meters,
    minutes,
    mapped: meters != null,
    notMapped,
    loading: enabled ? loading : false,
    error: notMapped ? null : error,
    refetch,
  };
}
