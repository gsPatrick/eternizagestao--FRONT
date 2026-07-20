"use client";

/* ============================================================================
 * PublicCemeteryMap — mapa REAL (Leaflet + OpenStreetMap) do cemitério para o
 * PORTAL PÚBLICO. É SÓ EXIBIÇÃO (read-only): sem Geoman, sem edição, sem toolbar
 * de posicionamento. Diferente do CemeteryMap do painel, aqui a ortofoto é um
 * overlay NÃO editável posicionado pelos mesmos 4 cantos (leaflet-distortableimage
 * em modo suppressToolbar/editable:false).
 *
 * CLIENT-ONLY: o Leaflet depende de `window`. Carregue via next/dynamic com
 * { ssr:false } (o módulo nunca é avaliado no servidor).
 *
 *   1. Base OpenStreetMap.
 *   2. Ortofoto posicionada pelos `corners` da API (mesmos 4 cantos do painel).
 *   3. Polígonos das sepulturas (a focada em DESTAQUE + popup); quadras/ruas
 *      sutis ao fundo.
 *   4. Ponto de ENTRADA + linha entrada→sepultura (via getGraveRoute).
 *
 * Nunca quebra: sem ortofoto/geoPolygon, cai num fitBounds nas coordenadas
 * disponíveis (entrada, sepultura, camadas) ou num centro default.
 * ==========================================================================*/

import { useEffect, useRef, useState } from "react";

import "leaflet/dist/leaflet.css";

import { getCemeteryMap, getGraveRoute, resolvePublicTenant } from "@/lib/api/resources/public";

import styles from "./PublicCemeteryMap.module.css";

const DEFAULT_CENTER = [-15.7801, -47.9292]; // Brasil (fallback sem dados)
const DEFAULT_ZOOM = 4;

const GRAVE_COLOR = "#5b8ac2";
const GRAVE_FOCUS = "#0a4a8c";
const BLOCK_COLOR = "#94a7bd";
const STREET_COLOR = "#b7c4d3";
const ENTRANCE_COLOR = "#1a7f5c";
const ROUTE_COLOR = "#0a4a8c";

// distortable ordena os cantos como [0]=TL, [1]=TR, [2]=BL, [3]=BR.
function cornersToLatLngs(L, c) {
  return [
    L.latLng(c.tl[0], c.tl[1]),
    L.latLng(c.tr[0], c.tr[1]),
    L.latLng(c.bl[0], c.bl[1]),
    L.latLng(c.br[0], c.br[1]),
  ];
}

// aceita [lat,lng] ou {lat,lng} → [lat,lng] | null
function toLatLng(v) {
  if (Array.isArray(v) && v.length >= 2) {
    const a = Number(v[0]);
    const b = Number(v[1]);
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  }
  if (v && typeof v === "object") {
    const a = Number(v.lat ?? v.latitude);
    const b = Number(v.lng ?? v.lon ?? v.longitude);
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : null;
  }
  return null;
}

function normalizePolygon(poly) {
  if (!Array.isArray(poly)) return null;
  const pts = poly.map(toLatLng).filter(Boolean);
  return pts.length >= 3 ? pts : null;
}

function normalizeCorners(c) {
  if (!c || typeof c !== "object") return null;
  const tl = toLatLng(c.tl);
  const tr = toLatLng(c.tr);
  const br = toLatLng(c.br);
  const bl = toLatLng(c.bl);
  if (!tl || !tr || !br || !bl) return null;
  return { tl, tr, br, bl };
}

/**
 * @param {object} props
 * @param {string} props.cemeteryId
 * @param {string|null} props.tenant     slug do tenant (?t= / subdomínio)
 * @param {string|null} props.focusGraveId  jazigo a destacar
 * @param {object|null} props.grave      resultado da busca ({ code, block, street, lot, latitude, longitude, geoPolygon, graveId })
 * @param {number|string} props.height
 */
export default function PublicCemeteryMap({
  cemeteryId,
  tenant = null,
  focusGraveId = null,
  grave = null,
  height = 460,
}) {
  const containerRef = useRef(null);
  const LRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // ---------------------------------------------------------------- init map
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const leaflet = await import("leaflet");
        const L = leaflet.default || leaflet;
        if (typeof window !== "undefined") window.L = L;
        // vendor.js traz o L.Toolbar2 do qual o distortableimage depende — antes do plugin.
        await import("leaflet-distortableimage/dist/vendor.js");
        await import("leaflet-distortableimage");
        if (!mounted || !containerRef.current) return;

        LRef.current = L;
        const map = L.map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
          maxZoom: 22,
        });

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxNativeZoom: 19,
          maxZoom: 22,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        mapRef.current = map;
        setReady(true);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("PublicCemeteryMap: falha ao carregar o mapa", err);
        if (mounted) setFailed(true);
      }
    })();

    return () => {
      mounted = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // ------------------------------------------------- carregar dados + desenhar
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !cemeteryId) return;

    let cancelled = false;
    const controller = new AbortController();
    const tenantSub = resolvePublicTenant(tenant);

    (async () => {
      let mapData = null;
      let route = null;
      try {
        mapData = await getCemeteryMap(cemeteryId, {
          tenant: tenantSub,
          signal: controller.signal,
        });
      } catch (_) {
        mapData = null;
      }
      // rota entrada → sepultura (best-effort; 404 se não mapeada)
      const routeGraveId = grave?.graveId || focusGraveId;
      if (routeGraveId) {
        try {
          route = await getGraveRoute(routeGraveId, {
            tenant: tenantSub,
            signal: controller.signal,
          });
        } catch (_) {
          route = null;
        }
      }
      if (cancelled) return;
      draw(L, map, mapData, route);
    })();

    function draw(L, map, mapData, route) {
      // limpa desenhos anteriores (mantém a base OSM = TileLayer)
      if (overlayRef.current) {
        try { map.removeLayer(overlayRef.current); } catch (_) {}
        overlayRef.current = null;
      }
      map.eachLayer((layer) => {
        if (!(layer instanceof L.TileLayer)) {
          try { map.removeLayer(layer); } catch (_) {}
        }
      });

      const fitPoints = []; // [lat,lng] acumulados p/ fallback de enquadramento
      const layers = mapData?.layers || {};
      const focusId = grave?.graveId || focusGraveId;

      // -------- ortofoto (overlay NÃO editável, pelos 4 cantos) --------
      const ortho = mapData?.orthophoto;
      const corners = ortho ? normalizeCorners(ortho.corners) : null;
      if (ortho?.fileUrl && corners) {
        try {
          const opacity = ortho.opacity != null ? Number(ortho.opacity) : 0.85;
          const overlay = L.distortableImageOverlay(ortho.fileUrl, {
            corners: cornersToLatLngs(L, corners),
            mode: "distort",
            editable: false,
            selected: false,
            suppressToolbar: true,
            crossOrigin: false,
            actions: [],
            opacity,
          });
          overlay.addTo(map);
          overlayRef.current = overlay;
          [corners.tl, corners.tr, corners.br, corners.bl].forEach((p) => fitPoints.push(p));
        } catch (_) {}
      }

      // -------- quadras / ruas (sutis, ao fundo) --------
      (layers.blocks || []).forEach((b) => {
        const poly = normalizePolygon(b.geoPolygon);
        if (poly) {
          L.polygon(poly, {
            color: BLOCK_COLOR, weight: 1, opacity: 0.5,
            fillColor: BLOCK_COLOR, fillOpacity: 0.06, interactive: false,
          }).addTo(map);
        }
      });
      (layers.streets || []).forEach((s) => {
        const poly = normalizePolygon(s.geoPolygon);
        if (poly) {
          L.polygon(poly, {
            color: STREET_COLOR, weight: 1, opacity: 0.45,
            fillColor: STREET_COLOR, fillOpacity: 0.04, interactive: false,
          }).addTo(map);
        }
      });

      // -------- sepulturas (a focada em destaque) --------
      let focusLayer = null;
      let focusPoint = null;
      const graveList = layers.graves || [];
      graveList.forEach((g) => {
        const isFocus = focusId && g.id === focusId;
        const poly = normalizePolygon(g.geoPolygon);
        const point = toLatLng([g.latitude, g.longitude]);
        let layer = null;
        if (poly) {
          layer = L.polygon(poly, {
            color: isFocus ? GRAVE_FOCUS : GRAVE_COLOR,
            weight: isFocus ? 3 : 1.2,
            opacity: 0.9,
            fillColor: isFocus ? GRAVE_FOCUS : GRAVE_COLOR,
            fillOpacity: isFocus ? 0.55 : 0.28,
          });
          if (isFocus) { focusLayer = layer; focusPoint = poly[0]; }
        } else if (point) {
          layer = L.circleMarker(point, {
            radius: isFocus ? 8 : 5,
            color: isFocus ? GRAVE_FOCUS : GRAVE_COLOR,
            weight: isFocus ? 3 : 1.5,
            fillColor: isFocus ? GRAVE_FOCUS : GRAVE_COLOR,
            fillOpacity: isFocus ? 0.75 : 0.45,
          });
          if (isFocus) { focusLayer = layer; focusPoint = point; }
        }
        if (!layer) return;
        if (g.code) layer.bindTooltip(String(g.code), { direction: "top", sticky: true });
        layer.addTo(map);
      });

      // se o jazigo focado não veio nas camadas, usa o polígono/coords da busca
      if (!focusLayer && grave) {
        const poly = normalizePolygon(grave.geoPolygon);
        const point = toLatLng([grave.latitude, grave.longitude]);
        if (poly) {
          focusLayer = L.polygon(poly, {
            color: GRAVE_FOCUS, weight: 3, opacity: 0.95,
            fillColor: GRAVE_FOCUS, fillOpacity: 0.55,
          }).addTo(map);
          focusPoint = poly[0];
        } else if (point) {
          focusLayer = L.circleMarker(point, {
            radius: 8, color: GRAVE_FOCUS, weight: 3,
            fillColor: GRAVE_FOCUS, fillOpacity: 0.75,
          }).addTo(map);
          focusPoint = point;
        }
      }

      // -------- entrada + rota entrada→sepultura --------
      const entrance =
        toLatLng([route?.entrance?.latitude, route?.entrance?.longitude]) ||
        toLatLng([mapData?.cemetery?.entranceLatitude, mapData?.cemetery?.entranceLongitude]);
      const target =
        toLatLng([route?.target?.latitude, route?.target?.longitude]) || focusPoint;

      if (entrance) {
        L.circleMarker(entrance, {
          radius: 7, color: "#fff", weight: 2,
          fillColor: ENTRANCE_COLOR, fillOpacity: 1,
        })
          .bindTooltip("Entrada", { direction: "top" })
          .addTo(map);
        fitPoints.push(entrance);
      }
      if (entrance && target) {
        L.polyline([entrance, target], {
          color: ROUTE_COLOR, weight: 3, opacity: 0.85, dashArray: "6,6",
        }).addTo(map);
        fitPoints.push(target);
      }

      // -------- destaque + popup no jazigo focado --------
      if (focusLayer) {
        const parts = [];
        if (grave?.code) parts.push(`<strong>${grave.code}</strong>`);
        const loc = [grave?.block, grave?.street, grave?.lot].filter(Boolean).join(" › ");
        if (loc) parts.push(loc);
        if (parts.length) {
          try {
            focusLayer.bindPopup(parts.join("<br/>"), { closeButton: false });
            focusLayer.openPopup();
          } catch (_) {}
        }
        if (focusPoint) fitPoints.push(focusPoint);
      }

      // -------- enquadramento (nunca quebra) --------
      try {
        if (focusLayer && focusLayer.getBounds) {
          const b = focusLayer.getBounds();
          if (entrance) b.extend(entrance);
          map.fitBounds(b, { padding: [60, 60], maxZoom: 21 });
        } else if (focusLayer && focusLayer.getLatLng) {
          const pts = [focusLayer.getLatLng()];
          if (entrance) pts.push(entrance);
          map.fitBounds(L.latLngBounds(pts), { padding: [60, 60], maxZoom: 20 });
        } else if (fitPoints.length >= 2) {
          map.fitBounds(L.latLngBounds(fitPoints), { padding: [40, 40], maxZoom: 21 });
        } else if (fitPoints.length === 1) {
          map.setView(fitPoints[0], 19);
        }
      } catch (_) {}
    }

    return () => {
      cancelled = true;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, cemeteryId, tenant, focusGraveId, grave?.graveId, grave?.id]);

  return (
    <div className={styles.root} style={{ height }}>
      <div ref={containerRef} className={styles.canvas} />
      {!ready && !failed && (
        <div className={styles.overlayState}>
          <div className={styles.spinner} />
          <span>Carregando mapa…</span>
        </div>
      )}
      {failed && (
        <div className={styles.overlayState}>
          <span>Não foi possível carregar o mapa. Recarregue a página.</span>
        </div>
      )}
    </div>
  );
}
