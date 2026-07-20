"use client";

/* ============================================================================
 * CemeteryMap — mapa REAL (Leaflet + OpenStreetMap) do cemitério.
 *
 * CLIENT-ONLY: o Leaflet depende de `window`. Carregue via next/dynamic com
 * { ssr:false } (o módulo nunca é avaliado no servidor).
 *
 *   1. Base OpenStreetMap centralizada no cemitério (ou entre os cemitérios).
 *   2. Posicionar a ortofoto: overlay DISTORCÍVEL (leaflet-distortableimage) que
 *      o operador arrasta/escala/rotaciona pelos cantos até alinhar sobre o OSM.
 *      Ao salvar, a página lê os 4 cantos (lat/lng) via ref → getLiveCorners().
 *   3. Demarcar sepulturas: desenho de polígono (Geoman) sobre a ortofoto →
 *      emite geoPolygon + centro via onGravePolygon. Sepulturas demarcadas
 *      aparecem como camadas; focusGrave centraliza/destaca a cova.
 *
 * O modo de posicionamento é dirigido pelas opções { editable, selected } na
 * (re)montagem do overlay — o próprio plugin inicializa as alças de edição no
 * `load` da imagem (padrão documentado, mais robusto que enable/select manual).
 * ==========================================================================*/

import { useEffect, useRef, useState } from "react";

import "leaflet/dist/leaflet.css";
import "leaflet-distortableimage/dist/vendor.css";
import "leaflet-distortableimage/dist/leaflet.distortableimage.css";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";

import styles from "./CemeteryMap.module.css";

const DEFAULT_CENTER = [-15.7801, -47.9292]; // Brasil (fallback sem centro)
const DEFAULT_ZOOM = 4;
const CEMETERY_ZOOM = 18;

// distortable ordena os cantos como [0]=TL, [1]=TR, [2]=BL, [3]=BR.
function cornersToLatLngs(L, c) {
  return [
    L.latLng(c.tl[0], c.tl[1]),
    L.latLng(c.tr[0], c.tr[1]),
    L.latLng(c.bl[0], c.bl[1]),
    L.latLng(c.br[0], c.br[1]),
  ];
}
function latLngsToCorners(arr) {
  const p = (ll) => [ll.lat, ll.lng];
  return { tl: p(arr[0]), tr: p(arr[1]), bl: p(arr[2]), br: p(arr[3]) };
}

// retângulo default centralizado na viewport atual (ortofoto ainda sem cantos)
function defaultCorners(map) {
  const b = map.getBounds();
  const n = b.getNorth();
  const s = b.getSouth();
  const e = b.getEast();
  const w = b.getWest();
  const latPad = (n - s) * 0.28;
  const lngPad = (e - w) * 0.28;
  return {
    tl: [n - latPad, w + lngPad],
    tr: [n - latPad, e - lngPad],
    br: [s + latPad, e - lngPad],
    bl: [s + latPad, w + lngPad],
  };
}

function polygonCentroid(latlngs) {
  const n = latlngs.length;
  const sum = latlngs.reduce((a, ll) => [a[0] + ll.lat, a[1] + ll.lng], [0, 0]);
  return [sum[0] / n, sum[1] / n];
}

export default function CemeteryMap({
  center = null,
  orthophoto = null, // { id, fileUrl, corners, opacity, rev }
  orthoVisible = true,
  orthoOpacity = 1,
  positioning = false,
  graves = [],
  drawing = false,
  focusGrave = null, // { id, nonce }
  statusColors = {},
  canEdit = false,
  onApi, // recebe { getLiveCorners } (next/dynamic não encaminha ref)
  onReady,
  onCornersChange,
  onGravePolygon,
  onGraveClick,
  height = "100%",
}) {
  const containerRef = useRef(null);
  const LRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const graveGroupRef = useRef(null);
  const graveLayersRef = useRef({});
  const highlightTimerRef = useRef(null);
  const lastOrthoKeyRef = useRef(null);
  const lastFitOrthoRef = useRef(null);
  const lastCenterRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const cbRef = useRef({});
  cbRef.current = { onCornersChange, onGravePolygon, onGraveClick };

  // API imperativa estável (usada no "Salvar posição"). next/dynamic não
  // encaminha ref, então entregamos via callback onApi.
  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      getLiveCorners() {
        try {
          const arr = overlayRef.current && overlayRef.current.getCorners();
          if (arr && arr.length === 4) return latLngsToCorners(arr);
        } catch (_) {}
        return null;
      },
    };
  }
  useEffect(() => {
    if (onApi) onApi(apiRef.current);
  }, [onApi]);

  // ---------------------------------------------------------------- init map
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const leaflet = await import("leaflet");
        const L = leaflet.default || leaflet;
        if (typeof window !== "undefined") window.L = L;
        // vendor.js traz o L.Toolbar2 (leaflet-toolbar) do qual as ações de
        // edição do distortableimage dependem — precisa vir ANTES do plugin.
        await import("leaflet-distortableimage/dist/vendor.js");
        await import("leaflet-distortableimage");
        await import("@geoman-io/leaflet-geoman-free");
        if (!mounted || !containerRef.current) return;

        LRef.current = L;
        const initial = center || DEFAULT_CENTER;
        const initialZoom = center ? CEMETERY_ZOOM : DEFAULT_ZOOM;
        const map = L.map(containerRef.current, {
          center: initial,
          zoom: initialZoom,
          zoomControl: true,
          maxZoom: 22,
        });
        lastCenterRef.current = center ? String(center) : null;

        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxNativeZoom: 19,
          maxZoom: 22,
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);

        graveGroupRef.current = L.layerGroup().addTo(map);
        mapRef.current = map;

        if (map.pm) {
          try {
            map.pm.setLang("pt_br");
          } catch (_) {}
          map.on("pm:create", (e) => {
            const layer = e.layer;
            let latlngs = [];
            try {
              const raw = layer.getLatLngs();
              latlngs = Array.isArray(raw[0]) ? raw[0] : raw;
            } catch (_) {}
            map.removeLayer(layer);
            try {
              map.pm.disableDraw();
            } catch (_) {}
            if (latlngs.length >= 3) {
              const geoPolygon = latlngs.map((ll) => [ll.lat, ll.lng]);
              const [latitude, longitude] = polygonCentroid(latlngs);
              cbRef.current.onGravePolygon &&
                cbRef.current.onGravePolygon({ geoPolygon, latitude, longitude });
            }
          });
        }

        setReady(true);
        onReady && onReady();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("CemeteryMap: falha ao carregar o mapa", err);
        if (mounted) setFailed(true);
      }
    })();

    return () => {
      mounted = false;
      if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------------------------------------------- centralizar mapa
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !center) return;
    const key = String(center);
    if (key === lastCenterRef.current) return;
    lastCenterRef.current = key;
    map.setView(center, Math.max(map.getZoom(), CEMETERY_ZOOM - 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, center && center[0], center && center[1]]);

  // --------------------------------- (re)montar ortofoto / alternar edição
  // O modo de posicionamento é aplicado remontando o overlay com
  // { editable, selected } — o plugin cria as alças de edição no load da imagem.
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    if (!orthophoto || !orthophoto.fileUrl) {
      if (overlayRef.current) {
        map.removeLayer(overlayRef.current);
        overlayRef.current = null;
      }
      lastOrthoKeyRef.current = null;
      return;
    }

    const editableNow = Boolean(positioning && canEdit);
    const key = [
      orthophoto.id || "new",
      orthophoto.fileUrl,
      orthophoto.rev || 0,
      editableNow ? "edit" : "view",
    ].join("::");
    if (key === lastOrthoKeyRef.current && overlayRef.current) return;

    if (overlayRef.current) {
      map.removeLayer(overlayRef.current);
      overlayRef.current = null;
    }

    const corners = orthophoto.corners || defaultCorners(map);

    const actions = [
      L.DragAction,
      L.ScaleAction,
      L.DistortAction,
      L.RotateAction,
      L.FreeRotateAction,
      L.LockAction,
    ].filter(Boolean);

    const overlay = L.distortableImageOverlay(orthophoto.fileUrl, {
      corners: cornersToLatLngs(L, corners),
      mode: "distort",
      editable: editableNow,
      selected: editableNow,
      suppressToolbar: !editableNow,
      // NÃO forçar CORS: URLs assinadas de storage podem não enviar cabeçalhos
      // CORS; como não exportamos para canvas, dispensamos crossOrigin.
      crossOrigin: false,
      actions,
      opacity: orthoVisible ? orthoOpacity : 0,
    });

    overlay.on("edit dragend update", () => {
      try {
        const arr = overlay.getCorners();
        if (arr && arr.length === 4) {
          cbRef.current.onCornersChange &&
            cbRef.current.onCornersChange(latLngsToCorners(arr), { dirty: true });
        }
      } catch (_) {}
    });

    overlay.addTo(map);
    overlayRef.current = overlay;
    lastOrthoKeyRef.current = key;

    // enquadra a ortofoto ao carregá-la (uma vez por id), fora do modo de edição
    const fitKey = orthophoto.id || key;
    if (!editableNow && lastFitOrthoRef.current !== fitKey) {
      lastFitOrthoRef.current = fitKey;
      try {
        map.fitBounds(L.latLngBounds(cornersToLatLngs(L, corners)), {
          padding: [40, 40],
          maxZoom: 21,
        });
      } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ready,
    canEdit,
    positioning,
    orthophoto && orthophoto.id,
    orthophoto && orthophoto.fileUrl,
    orthophoto && orthophoto.rev,
  ]);

  // ------------------------------------------------- opacidade / visibilidade
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!ready || !overlay) return;
    try {
      overlay.setOpacity(orthoVisible ? orthoOpacity : 0);
    } catch (_) {}
  }, [ready, orthoOpacity, orthoVisible]);

  // ------------------------------------------------- desenho (demarcação)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !map.pm) return;
    try {
      if (drawing && canEdit) {
        map.pm.enableDraw("Polygon", {
          snappable: true,
          continueDrawing: false,
          templineStyle: { color: "#0a4a8c" },
          hintlineStyle: { color: "#0a4a8c", dashArray: "4,4" },
          pathOptions: { color: "#0a4a8c", weight: 2, fillOpacity: 0.15 },
        });
      } else {
        map.pm.disableDraw();
      }
    } catch (_) {}
  }, [ready, drawing, canEdit]);

  // ------------------------------------------------- renderizar sepulturas
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    const group = graveGroupRef.current;
    if (!ready || !L || !map || !group) return;

    group.clearLayers();
    graveLayersRef.current = {};

    graves.forEach((g) => {
      const color = statusColors[g.status] || "#032e59";
      let layer = null;
      if (g.geoPolygon && g.geoPolygon.length >= 3) {
        layer = L.polygon(g.geoPolygon, {
          color,
          weight: 1.5,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.35,
        });
      } else if (g.latitude != null && g.longitude != null) {
        layer = L.circleMarker([g.latitude, g.longitude], {
          radius: 6,
          color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.6,
        });
      }
      if (!layer) return;
      layer.bindTooltip(
        `<strong>${g.code}</strong>${g.occupant ? `<br/>${g.occupant}` : ""}`,
        { direction: "top", sticky: true }
      );
      layer.on("click", () => {
        cbRef.current.onGraveClick && cbRef.current.onGraveClick(g.id);
      });
      layer._graveColor = color;
      layer.addTo(group);
      graveLayersRef.current[g.id] = layer;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, graves, statusColors]);

  // ------------------------------------------------- focar/destacar sepultura
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map || !focusGrave || !focusGrave.id) return;
    const layer = graveLayersRef.current[focusGrave.id];
    if (layer) {
      try {
        if (layer.getBounds) {
          map.fitBounds(layer.getBounds(), { padding: [80, 80], maxZoom: 21 });
        } else if (layer.getLatLng) {
          map.setView(layer.getLatLng(), Math.max(map.getZoom(), 20));
        }
        if (layer.setStyle) {
          layer.setStyle({ color: "#0a4a8c", weight: 4, fillOpacity: 0.5 });
          if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);
          highlightTimerRef.current = setTimeout(() => {
            const isPoly = Boolean(layer.getBounds);
            layer.setStyle({
              color: layer._graveColor,
              weight: isPoly ? 1.5 : 2,
              fillColor: layer._graveColor,
              fillOpacity: isPoly ? 0.35 : 0.6,
            });
          }, 1800);
        }
        if (layer.openTooltip) layer.openTooltip();
      } catch (_) {}
      return;
    }
    const g = graves.find((x) => x.id === focusGrave.id);
    if (g && g.latitude != null && g.longitude != null) {
      map.setView([g.latitude, g.longitude], Math.max(map.getZoom(), 20));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focusGrave && focusGrave.nonce, focusGrave && focusGrave.id]);

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
