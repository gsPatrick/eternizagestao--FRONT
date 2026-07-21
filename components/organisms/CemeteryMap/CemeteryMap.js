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

// Estilos SUTIS e DISTINTOS por camada (não interativas — só exibição).
// Quadras: contorno azul translúcido com preenchimento leve.
// Ruas: linha (polyline) tracejada cinza. Lotes: contorno fino teal, sem fill.
const LAYER_STYLES = {
  blocks: {
    kind: "polygon",
    color: "#2563eb",
    weight: 2,
    opacity: 0.7,
    fillColor: "#2563eb",
    fillOpacity: 0.08,
  },
  streets: {
    kind: "polyline",
    color: "#64748b",
    weight: 3,
    opacity: 0.65,
    dashArray: "6,4",
  },
  lots: {
    kind: "polygon",
    color: "#0f766e",
    weight: 1,
    opacity: 0.6,
    fill: false,
  },
};
const LAYER_LABELS = { blocks: "Quadras", streets: "Ruas", lots: "Lotes" };

export default function CemeteryMap({
  center = null,
  orthophoto = null, // { id, fileUrl, corners, opacity, rev }
  onOrthoError = null, // (fileUrl) => void — imagem da ortofoto não carregou
  orthoVisible = true,
  orthoOpacity = 1,
  positioning = false,
  graves = [],
  layers = { blocks: [], streets: [], lots: [] }, // camadas de quadra/rua/lote
  drawing = false,
  basemapVisible = true, // mapa de ruas por baixo da ortofoto
  pinning = false, // clique no mapa define os 4 CANTOS da ortofoto
  onPinsChange = null, // (qtd:number) => void — progresso da pinagem
  markingEntrance = false, // clique no mapa define a ENTRADA do cemitério
  entrance = null, // [lat, lng] já marcada — mostra o marcador
  focusGrave = null, // { id, nonce }
  statusColors = {},
  canEdit = false,
  onApi, // recebe { getLiveCorners } (next/dynamic não encaminha ref)
  onReady,
  onCornersChange,
  onGravePolygon,
  onGraveClick,
  onEntrancePick, // (latlng:[lat,lng]) => void
  height = "100%",
}) {
  const containerRef = useRef(null);
  const LRef = useRef(null);
  const baseTilesRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const graveGroupRef = useRef(null);
  const graveLayersRef = useRef({});
  const layerGroupsRef = useRef({}); // { blocks, streets, lots } → L.LayerGroup
  const highlightTimerRef = useRef(null);
  const lastOrthoKeyRef = useRef(null);
  const lastFitOrthoRef = useRef(null);
  const lastCenterRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // visibilidade de cada camada (alternável pelo controle no canto)
  const [layerVis, setLayerVis] = useState({
    blocks: true,
    streets: true,
    lots: true,
    graves: true,
  });

  const cbRef = useRef({});
  cbRef.current = { onCornersChange, onGravePolygon, onGraveClick, onOrthoError, onEntrancePick, onPinsChange };

  // Desentorta o overlay: retângulo alinhado ao norte, mesmo centro e tamanho,
  // na PROPORÇÃO REAL do arquivo. Usada pelo botão "Desentortar" e também no
  // primeiro posicionamento — os cantos iniciais vinham do formato da TELA, o
  // que já entregava a foto esticada antes de o operador encostar nela.
  const resetOverlayShapeRef = useRef(() => null);
  resetOverlayShapeRef.current = () => {
    const overlay = overlayRef.current;
    const L = LRef.current;
    const map = mapRef.current;
    if (!overlay || !L || !map) return null;
    try {
      const arr = overlay.getCorners();
      if (!arr || arr.length !== 4) return null;

      const pts = arr.map((c) => map.latLngToLayerPoint(c));
      const cx = pts.reduce((a, p) => a + p.x, 0) / 4;
      const cy = pts.reduce((a, p) => a + p.y, 0) / 4;
      const width = Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x));

      const img = overlay.getElement && overlay.getElement();
      const ratio = img && img.naturalWidth && img.naturalHeight
        ? img.naturalHeight / img.naturalWidth
        : 0.75;
      const half = Math.max(width, 40) / 2;
      const halfH = half * ratio;

      const toLatLng = (x, y) => map.layerPointToLatLng(L.point(x, y));
      overlay.setCorners([
        toLatLng(cx - half, cy - halfH), // tl
        toLatLng(cx + half, cy - halfH), // tr
        toLatLng(cx - half, cy + halfH), // bl
        toLatLng(cx + half, cy + halfH), // br
      ]);
      const atualizados = latLngsToCorners(overlay.getCorners());
      cbRef.current.onCornersChange
        && cbRef.current.onCornersChange(atualizados, { dirty: true });
      return atualizados;
    } catch (_) {
      return null;
    }
  };

  // API imperativa estável (usada no "Salvar posição"). next/dynamic não
  // encaminha ref, então entregamos via callback onApi.
  // centro vigente (prop) acessível dentro da API imperativa estável
  const centerRef = useRef(null);
  centerRef.current = center;

  const apiRef = useRef(null);
  if (!apiRef.current) {
    apiRef.current = {
      /**
       * Desentorta: volta a um retângulo alinhado ao norte, no MESMO centro e
       * tamanho aproximado, respeitando a proporção real do arquivo.
       * Sem isto, uma vez empenada não havia como recuperar a foto — só
       * apagando e reenviando.
       */
      resetShape() {
        return resetOverlayShapeRef.current();
      },

      getLiveCorners() {
        try {
          const arr = overlayRef.current && overlayRef.current.getCorners();
          if (arr && arr.length === 4) return latLngsToCorners(arr);
        } catch (_) {}
        return null;
      },
      /**
       * "Localizar": reenquadra o mapa no que importa — a ortofoto (mesmo em
       * pleno posicionamento, lendo os cantos vivos) ou, na falta dela, o centro
       * do cemitério. Evita o operador se perder ao arrastar/dar zoom.
       */
      locate() {
        const map = mapRef.current;
        const L = LRef.current;
        if (!map || !L) return;
        try {
          const arr = overlayRef.current && overlayRef.current.getCorners();
          if (arr && arr.length === 4) {
            map.fitBounds(L.latLngBounds(arr), { padding: [40, 40], maxZoom: 21 });
            return;
          }
        } catch (_) {}
        const c = centerRef.current;
        if (c) map.setView(c, Math.max(map.getZoom(), CEMETERY_ZOOM));
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

        // Mapa de RUAS por baixo. É a referência para alinhar a ortofoto às
        // ruas reais durante o posicionamento; depois de posicionada, vira
        // ruído — por isso pode ser desligado (ver efeito de basemapVisible).
        baseTilesRef.current = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
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
      // ARRASTAR como modo inicial. O padrão do plugin é "distort": qualquer
      // toque empenava a foto num losango, e georreferenciar virava um martírio.
      // A distorção continua disponível na barra do próprio overlay, para a
      // correção fina de perspectiva — mas deixa de ser o comportamento padrão.
      mode: "drag",
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

    // DIAGNÓSTICO: o overlay é criado mesmo quando a imagem não carrega, então
    // o operador via "ortofoto posicionada" com o mapa vazio e não havia como
    // saber por quê. Agora o erro de carregamento aparece no console com a URL
    // exata que falhou — quase sempre origem errada (NEXT_PUBLIC_API_URL
    // ausente no build) ou URL assinada expirada.
    overlay.on("load", () => {
      console.info("[ortofoto] imagem carregada:", orthophoto.fileUrl);
      // Ainda não posicionada: ajusta à proporção real do arquivo. Os cantos
      // default vêm do formato da viewport, então a foto entrava esticada.
      if (!orthophoto.corners) {
        setTimeout(() => resetOverlayShapeRef.current(), 0);
      }
    });
    overlay.on("error", () => {
      cbRef.current.onOrthoError && cbRef.current.onOrthoError(orthophoto.fileUrl);
      console.error(
        "[ortofoto] a imagem NÃO carregou. URL usada:", orthophoto.fileUrl,
        "\nA origem é a mesma das chamadas de API, então normalmente a causa é",
        "a URL assinada expirada ou o arquivo ausente no storage da API."
      );
    });

    overlay.addTo(map);
    overlayRef.current = overlay;
    lastOrthoKeyRef.current = key;

    // Enquadra a ortofoto ao carregá-la (uma vez por id).
    //
    // Quando ela AINDA NÃO tem cantos salvos, os cantos vêm do viewport atual —
    // e se o cemitério não tem coordenadas o mapa abre no centro do Brasil, com
    // a foto caindo lá. O operador então "sobe a ortofoto e o mapa não muda",
    // porque a imagem está a centenas de quilômetros de onde ele está olhando.
    // Por isso, sem cantos, enquadramos TAMBÉM no modo de edição — que é
    // justamente o modo em que a foto recém-enviada é posicionada.
    const semCantos = !orthophoto.corners;
    const fitKey = orthophoto.id || key;
    if ((!editableNow || semCantos) && lastFitOrthoRef.current !== fitKey) {
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

  // ------------------------------------------- mapa de ruas ligado/desligado
  useEffect(() => {
    const map = mapRef.current;
    const tiles = baseTilesRef.current;
    if (!ready || !map || !tiles) return;
    if (basemapVisible) {
      if (!map.hasLayer(tiles)) tiles.addTo(map);
    } else if (map.hasLayer(tiles)) {
      map.removeLayer(tiles);
    }
  }, [ready, basemapVisible]);

  // ------------------------------- POSICIONAR POR PINOS (4 cliques no mapa)
  //
  // Arrastar a imagem é ruim justamente porque ela tapa o que se precisa
  // enxergar para alinhar. Clicando canto a canto dá para dar zoom em cada
  // ponto e acertar. É a MESMA transformação de 4 cantos de sempre — muda só
  // a forma de informá-los.
  const pinsRef = useRef([]);
  const pinMarkersRef = useRef([]);
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!ready || !map || !L) return undefined;

    const limparPinos = () => {
      pinMarkersRef.current.forEach((m) => map.removeLayer(m));
      pinMarkersRef.current = [];
      pinsRef.current = [];
    };

    if (!pinning) {
      limparPinos();
      map.getContainer().style.cursor = "";
      return undefined;
    }

    limparPinos();
    map.getContainer().style.cursor = "crosshair";
    cbRef.current.onPinsChange && cbRef.current.onPinsChange(0);

    const handler = (e) => {
      const { lat, lng } = e.latlng || {};
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      if (pinsRef.current.length >= 4) return;

      pinsRef.current.push([lat, lng]);
      const n = pinsRef.current.length;
      const marker = L.marker([lat, lng], {
        title: `Canto ${n}`,
        icon: L.divIcon({
          className: "",
          html: `<div style="background:#0a4a8c;color:#fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font:600 12px/1 sans-serif;box-shadow:0 0 0 2px #fff">${n}</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        }),
      }).addTo(map);
      pinMarkersRef.current.push(marker);
      cbRef.current.onPinsChange && cbRef.current.onPinsChange(n);

      if (n === 4) {
        // ordem pedida ao operador: superior-esq, superior-dir, inferior-dir,
        // inferior-esq. O overlay espera [tl, tr, bl, br].
        const [tl, tr, br, bl] = pinsRef.current;
        const overlay = overlayRef.current;
        if (overlay) {
          try {
            overlay.setCorners([
              L.latLng(tl[0], tl[1]),
              L.latLng(tr[0], tr[1]),
              L.latLng(bl[0], bl[1]),
              L.latLng(br[0], br[1]),
            ]);
            cbRef.current.onCornersChange
              && cbRef.current.onCornersChange(latLngsToCorners(overlay.getCorners()), { dirty: true });
          } catch (_) {}
        }
      }
    };

    map.on("click", handler);
    return () => {
      map.off("click", handler);
      limparPinos();
      map.getContainer().style.cursor = "";
    };
  }, [ready, pinning]);

  // --------------------------------------- marcar a ENTRADA (clique no mapa)
  //
  // A entrada é a origem das rotas do visitante. Marcá-la SOBRE a ortofoto já
  // posicionada é o único jeito de acertar o portão de verdade — por isso este
  // modo vive aqui, no mapa real, e não no cadastro do cemitério.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!markingEntrance) {
      map.getContainer().style.cursor = "";
      return undefined;
    }
    map.getContainer().style.cursor = "crosshair";
    const handler = (e) => {
      const { lat, lng } = e.latlng || {};
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        cbRef.current.onEntrancePick && cbRef.current.onEntrancePick([lat, lng]);
      }
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
      map.getContainer().style.cursor = "";
    };
  }, [ready, markingEntrance]);

  // marcador da entrada já definida
  const entranceMarkerRef = useRef(null);
  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!ready || !map || !L) return;
    if (entranceMarkerRef.current) {
      map.removeLayer(entranceMarkerRef.current);
      entranceMarkerRef.current = null;
    }
    if (!entrance) return;
    entranceMarkerRef.current = L.marker(entrance, { title: "Entrada do cemitério" })
      .addTo(map)
      .bindTooltip("Entrada do cemitério", { direction: "top" });
  }, [ready, entrance]);

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

  // ------------------------- camadas de quadra/rua/lote (abaixo das sepulturas)
  // Cada camada vira um L.LayerGroup próprio; recriamos ao trocar `layers` e
  // adicionamos/removemos do mapa conforme o toggle. NÃO interativas (só exibem)
  // e mantidas ABAIXO das sepulturas (bringToFront nas sepulturas ao final).
  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!ready || !L || !map) return;

    // limpa grupos antigos
    Object.values(layerGroupsRef.current).forEach((grp) => {
      try {
        map.removeLayer(grp);
      } catch (_) {}
    });
    layerGroupsRef.current = {};

    ["blocks", "streets", "lots"].forEach((key) => {
      const feats = (layers && layers[key]) || [];
      const style = LAYER_STYLES[key];
      const group = L.layerGroup();
      feats.forEach((f) => {
        const pts = f.geoPolygon;
        if (!Array.isArray(pts) || pts.length < 2) return;
        const shape =
          style.kind === "polyline"
            ? L.polyline(pts, { ...style, interactive: false })
            : L.polygon(pts, { ...style, interactive: false });
        shape.addTo(group);
      });
      layerGroupsRef.current[key] = group;
      if (layerVis[key]) group.addTo(map);
    });

    // garante as sepulturas por cima das camadas recém-adicionadas
    if (graveGroupRef.current) {
      try {
        Object.values(graveLayersRef.current).forEach(
          (lyr) => lyr.bringToFront && lyr.bringToFront()
        );
      } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layers]);

  // toggle de visibilidade das camadas (adiciona/remove os grupos do mapa)
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    ["blocks", "streets", "lots"].forEach((key) => {
      const grp = layerGroupsRef.current[key];
      if (!grp) return;
      const on = map.hasLayer(grp);
      if (layerVis[key] && !on) grp.addTo(map);
      else if (!layerVis[key] && on) map.removeLayer(grp);
    });
    // sepulturas
    const gg = graveGroupRef.current;
    if (gg) {
      const on = map.hasLayer(gg);
      if (layerVis.graves && !on) gg.addTo(map);
      else if (!layerVis.graves && on) map.removeLayer(gg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, layerVis]);

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

  const layerCounts = {
    blocks: (layers?.blocks || []).length,
    streets: (layers?.streets || []).length,
    lots: (layers?.lots || []).length,
  };
  const hasAnyLayer =
    layerCounts.blocks > 0 || layerCounts.streets > 0 || layerCounts.lots > 0;

  const toggleLayer = (key) =>
    setLayerVis((v) => ({ ...v, [key]: !v[key] }));

  return (
    <div className={styles.root} style={{ height }}>
      <div ref={containerRef} className={styles.canvas} />

      {/* controle de camadas (só aparece quando há geometria de quadra/rua/lote) */}
      {ready && hasAnyLayer && (
        <div className={styles.layerControl}>
          <span className={styles.layerControlTitle}>Camadas</span>
          {["blocks", "streets", "lots"].map((key) =>
            layerCounts[key] > 0 ? (
              <label key={key} className={styles.layerRow}>
                <input
                  type="checkbox"
                  checked={layerVis[key]}
                  onChange={() => toggleLayer(key)}
                />
                <span
                  className={styles.layerSwatch}
                  data-kind={LAYER_STYLES[key].kind}
                  style={{ "--swatch": LAYER_STYLES[key].color }}
                />
                <span className={styles.layerName}>
                  {LAYER_LABELS[key]}
                  <span className={styles.layerCount}>{layerCounts[key]}</span>
                </span>
              </label>
            ) : null
          )}
          <label className={styles.layerRow}>
            <input
              type="checkbox"
              checked={layerVis.graves}
              onChange={() => toggleLayer("graves")}
            />
            <span
              className={styles.layerSwatch}
              data-kind="polygon"
              style={{ "--swatch": "#032e59" }}
            />
            <span className={styles.layerName}>Sepulturas</span>
          </label>
        </div>
      )}

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
