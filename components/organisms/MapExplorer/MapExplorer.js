"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import styles from "./MapExplorer.module.css";

/**
 * Mapa geral do cemitério (PDF 3.5): ortofoto como base, sepulturas demarcadas
 * como polígonos interativos, camadas por quadra/rua/lote e caminhos GPS.
 * Gestos idênticos ao MapCanvas: dois dedos navegam, pinça/Ctrl+scroll = zoom.
 */

const WORLD = { w: 800, h: 500 };
const MIN_VIEW = 40;

const BLOCKS = [
  { x: 60, y: 60, w: 200, h: 150, label: "A" },
  { x: 300, y: 60, w: 200, h: 150, label: "B" },
  { x: 540, y: 60, w: 200, h: 150, label: "C" },
  { x: 60, y: 260, w: 200, h: 180, label: "D" },
  { x: 300, y: 260, w: 200, h: 180, label: "E" },
  { x: 540, y: 260, w: 200, h: 180, label: "F" },
];

export const ENTRANCE = [400, 486];

export const STATUS_META = {
  livre: { label: "Livre", color: "#2e9e6b" },
  ocupada: { label: "Ocupada", color: "#032e59" },
  reservada: { label: "Reservada", color: "#c98a1b" },
  em_manutencao: { label: "Em manutenção", color: "#5b8ac2" },
  em_perpetuidade: { label: "Perpetuidade", color: "#0e1c2f" },
  interditada: { label: "Interditada", color: "#c0392b" },
};

// distribuição realista: ocupada domina, livres e demais aparecem
const STATUS_CYCLE = [
  "ocupada", "ocupada", "ocupada", "livre", "ocupada", "reservada",
  "ocupada", "livre", "em_perpetuidade", "ocupada", "em_manutencao",
  "ocupada", "livre", "ocupada", "reservada", "ocupada", "interditada",
];

const NAMES = [
  "Antônio Ferreira", "Helena Duarte", "José Martins", "Cecília Ramos",
  "Manoel Barbosa", "Tereza Nogueira", "Francisco Leal", "Iracema Pontes",
  "Sebastião Cruz", "Odete Sampaio", "Waldemar Torres", "Zilda Moreira",
];

function lotsFor(block) {
  const lots = [];
  const cols = 5;
  const rows = 3;
  const gap = 8;
  const w = (block.w - gap * (cols + 1)) / cols;
  const h = (block.h - 26 - gap * (rows + 1)) / rows;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      lots.push({ x: block.x + gap + c * (w + gap), y: block.y + 26 + gap + r * (h + gap), w, h, row: r, col: c });
    }
  }
  return lots;
}

// gera as sepulturas de forma determinística (mock até a API alimentar o mapa)
function buildGraves() {
  const graves = [];
  BLOCKS.forEach((block, bi) => {
    lotsFor(block).forEach((lot, li) => {
      const cols = 3;
      const rows = 2;
      const gap = 2.4;
      const w = (lot.w - gap * (cols + 1)) / cols;
      const h = (lot.h - gap * (rows + 1)) / rows;
      for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
          const index = r * cols + c;
          const seed = bi * 131 + li * 17 + index * 7;
          const status = STATUS_CYCLE[seed % STATUS_CYCLE.length];
          const blocked = status === "ocupada" && seed % 23 === 0;
          const x = lot.x + gap + c * (w + gap);
          const y = lot.y + gap + r * (h + gap);
          graves.push({
            id: `${block.label}${li}${index}`,
            code: `${block.label}-R${lot.row + 1}-L${String(lot.col + 1).padStart(2, "0")}-${String(index + 1).padStart(3, "0")}`,
            block: block.label,
            street: `Rua ${lot.row + 1}`,
            lot: `Lote ${String(lot.col + 1).padStart(2, "0")}`,
            x, y, w, h,
            cx: x + w / 2,
            cy: y + h / 2,
            status,
            blocked,
            occupant: status === "ocupada" || status === "em_perpetuidade" ? NAMES[seed % NAMES.length] : null,
          });
        }
      }
    });
  });
  return graves;
}

export const GRAVES = buildGraves();

// rota simulada da entrada até a sepultura pelos caminhos principais (map_paths)
export function routeTo(grave) {
  const roadY = 232;
  const points = [ENTRANCE, [400, roadY]];
  if (Math.abs(grave.cx - 400) > 8) points.push([grave.cx, roadY]);
  points.push([grave.cx, grave.cy]);
  let dist = 0;
  for (let i = 1; i < points.length; i += 1) {
    dist += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  const meters = Math.round(dist * 0.55);
  return { points, meters, minutes: Math.max(1, Math.round(meters / 70)) };
}

function clampView(vb) {
  const w = Math.min(Math.max(vb.w, MIN_VIEW), WORLD.w);
  const h = (w * WORLD.h) / WORLD.w;
  const x = Math.min(Math.max(vb.x, 0), WORLD.w - w);
  const y = Math.min(Math.max(vb.y, 0), WORLD.h - h);
  return { x, y, w, h };
}

const MapExplorer = forwardRef(function MapExplorer(
  {
    layers,
    statusFilter = null,
    selectedId = null,
    onSelect,
    route = null,
    height = 520,
    paths = [],
    drawing = false,
    draftPath = [],
    onDraftPoint,
  },
  apiRef
) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const actionRef = useRef(null);
  const pointersRef = useRef(new Map());
  const viewRef = useRef({ x: 0, y: 0, w: WORLD.w, h: WORLD.h });
  const [view, setViewState] = useState(viewRef.current);
  const [panning, setPanning] = useState(false);

  const scale = WORLD.w / view.w;

  function setView(next) {
    viewRef.current = clampView(typeof next === "function" ? next(viewRef.current) : next);
    setViewState(viewRef.current);
  }

  useImperativeHandle(apiRef, () => ({
    zoomTo: (cx, cy, w = 130) => {
      setView({ x: cx - w / 2, y: cy - ((w * WORLD.h) / WORLD.w) / 2, w, h: (w * WORLD.h) / WORLD.w });
    },
    reset: () => setView({ x: 0, y: 0, w: WORLD.w, h: WORLD.h }),
  }));

  function toSvgCoords(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    const vb = viewRef.current;
    return [
      vb.x + ((clientX - rect.left) / rect.width) * vb.w,
      vb.y + ((clientY - rect.top) / rect.height) * vb.h,
    ];
  }

  function zoomAt(factor, clientX, clientY) {
    setView((vb) => {
      const rect = svgRef.current.getBoundingClientRect();
      const px = vb.x + (((clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width) * vb.w;
      const py = vb.y + (((clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height) * vb.h;
      const w = Math.min(Math.max(vb.w * factor, MIN_VIEW), WORLD.w);
      const ratio = w / vb.w;
      return { x: px - (px - vb.x) * ratio, y: py - (py - vb.y) * ratio, w, h: (w * WORLD.h) / WORLD.w };
    });
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onWheel(event) {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        zoomAt(event.deltaY > 0 ? 1.12 : 0.89, event.clientX, event.clientY);
        return;
      }
      const isMouseWheel = event.deltaX === 0 && Math.abs(event.deltaY) >= 50;
      if (isMouseWheel) {
        zoomAt(event.deltaY > 0 ? 1.18 : 0.85, event.clientX, event.clientY);
        return;
      }
      const rect = el.getBoundingClientRect();
      setView((vb) => ({
        ...vb,
        x: vb.x + (event.deltaX / rect.width) * vb.w,
        y: vb.y + (event.deltaY / rect.height) * vb.h,
      }));
    }
    el.addEventListener("wheel", onWheel, { passive: false });

    let gestureScale = 1;
    function onGestureStart(event) {
      event.preventDefault();
      gestureScale = event.scale || 1;
    }
    function onGestureChange(event) {
      event.preventDefault();
      const factor = gestureScale / (event.scale || 1);
      gestureScale = event.scale || 1;
      zoomAt(Math.min(Math.max(factor, 0.8), 1.25), event.clientX, event.clientY);
    }
    el.addEventListener("gesturestart", onGestureStart);
    el.addEventListener("gesturechange", onGestureChange);

    function onGlobalPointerEnd(event) {
      pointersRef.current.delete(event.pointerId);
      if (pointersRef.current.size < 2 && actionRef.current?.kind === "pinch") {
        actionRef.current = null;
      }
    }
    window.addEventListener("pointerup", onGlobalPointerEnd);
    window.addEventListener("pointercancel", onGlobalPointerEnd);

    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("gesturestart", onGestureStart);
      el.removeEventListener("gesturechange", onGestureChange);
      window.removeEventListener("pointerup", onGlobalPointerEnd);
      window.removeEventListener("pointercancel", onGlobalPointerEnd);
    };
  }, []);

  function trackPointer(event) {
    if (event.pointerType !== "touch") return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 2) {
      const [a, b] = [...pointersRef.current.values()];
      actionRef.current = {
        kind: "pinch",
        startDist: Math.hypot(a.x - b.x, a.y - b.y),
        startMid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        view: { ...viewRef.current },
      };
    }
  }

  function onSvgPointerDown(event) {
    try {
      svgRef.current.setPointerCapture(event.pointerId);
    } catch {
      /* segue sem capture */
    }
    trackPointer(event);
    if (pointersRef.current.size >= 2) return;
    actionRef.current = {
      kind: "pan",
      startX: event.clientX,
      startY: event.clientY,
      view: { ...viewRef.current },
    };
  }

  function onPointerMove(event) {
    if (pointersRef.current.has(event.pointerId)) {
      pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    }
    const action = actionRef.current;
    if (!action) return;

    if (action.kind === "pinch") {
      const points = [...pointersRef.current.values()];
      if (points.length === 2) {
        const [a, b] = points;
        const dist = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 10);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const rect = svgRef.current.getBoundingClientRect();
        const start = action;
        const worldX = start.view.x + ((start.startMid.x - rect.left) / rect.width) * start.view.w;
        const worldY = start.view.y + ((start.startMid.y - rect.top) / rect.height) * start.view.h;
        const w = Math.min(Math.max(start.view.w * (start.startDist / dist), MIN_VIEW), WORLD.w);
        setView({
          x: worldX - ((mid.x - rect.left) / rect.width) * w,
          y: worldY - ((mid.y - rect.top) / rect.height) * ((w * WORLD.h) / WORLD.w),
          w,
          h: (w * WORLD.h) / WORLD.w,
        });
      }
      return;
    }

    if (action.kind === "pan") {
      const dx = event.clientX - action.startX;
      const dy = event.clientY - action.startY;
      if (panning || Math.hypot(dx, dy) > 3) {
        if (!panning) setPanning(true);
        const rect = svgRef.current.getBoundingClientRect();
        setView({
          ...action.view,
          x: action.view.x - (dx / rect.width) * action.view.w,
          y: action.view.y - (dy / rect.height) * action.view.h,
        });
      }
    }
  }

  function onPointerUp(event) {
    const action = actionRef.current;
    pointersRef.current.delete(event.pointerId);
    actionRef.current = null;
    // clique seco: traçando caminho adiciona ponto; senão desmarca a seleção
    if (!panning && action?.kind === "pan") {
      const moved = Math.hypot(event.clientX - action.startX, event.clientY - action.startY);
      if (moved <= 4) {
        if (drawing && onDraftPoint) {
          const [x, y] = toSvgCoords(event.clientX, event.clientY);
          onDraftPoint([Math.round(x), Math.round(y)]);
        } else {
          onSelect?.(null);
        }
      }
    }
    setPanning(false);
  }

  function onGravePointerUp(event, grave) {
    if (panning || drawing) return; // traçando caminho, o clique atravessa para o fundo

    event.stopPropagation();
    const action = actionRef.current;
    actionRef.current = null;
    pointersRef.current.delete(event.pointerId);
    if (action?.kind === "pan") {
      const moved = Math.hypot(event.clientX - action.startX, event.clientY - action.startY);
      if (moved <= 4) onSelect?.(grave);
    }
  }

  const selected = selectedId ? GRAVES.find((g) => g.id === selectedId) : null;
  const dimmed = (grave) => statusFilter && grave.status !== statusFilter;

  return (
    <div className={styles.wrap} style={{ height }} ref={wrapRef}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className={`${styles.svg} ${panning ? styles.panning : ""} ${drawing ? styles.drawingMode : ""}`}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="mapGrass" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#e7ebe4" />
            <circle cx="4" cy="5" r="0.9" fill="#dde3d8" />
            <circle cx="11" cy="11" r="0.9" fill="#dde3d8" />
          </pattern>
        </defs>

        {/* ---- ortofoto base (sempre visível) ---- */}
        <g className={styles.bg}>
          <rect width="800" height="500" fill="url(#mapGrass)" />
          <rect x="0" y="215" width="800" height="34" rx="4" fill="#f2f3ef" />
          <rect x="272" y="0" width="20" height="500" fill="#f2f3ef" />
          <rect x="512" y="0" width="20" height="500" fill="#f2f3ef" />
          <rect x="390" y="249" width="20" height="251" fill="#f2f3ef" />
          <line x1="0" y1="232" x2="800" y2="232" stroke="#d8dcd2" strokeWidth="1.5" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
          {[[30, 30], [770, 40], [40, 470], [760, 470], [285, 470], [530, 30]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="11" fill="#c9d4bf" opacity="0.85" />
          ))}
        </g>

        {/* ---- camada: quadras ---- */}
        <g className={styles.bg}>
          {BLOCKS.map((block) => (
            <g key={block.label}>
              <rect
                x={block.x}
                y={block.y}
                width={block.w}
                height={block.h}
                rx="8"
                fill={layers.quadras ? "#dfe5da" : "transparent"}
                stroke={layers.quadras ? "#cbd3c4" : "#d5dbcf"}
                strokeWidth="1"
                strokeDasharray={layers.quadras ? "none" : "6 5"}
                vectorEffect="non-scaling-stroke"
              />
              {layers.quadras && (
                <text x={block.x + 12} y={block.y + 19} className={styles.blockLabel}>
                  QUADRA {block.label}
                </text>
              )}
            </g>
          ))}
        </g>

        {/* ---- camada: lotes + ruas internas ---- */}
        <g className={styles.bg}>
          {BLOCKS.map((block) =>
            lotsFor(block).map((lot, index) => (
              <g key={`${block.label}-${index}`}>
                {layers.lotes && (
                  <rect
                    x={lot.x}
                    y={lot.y}
                    width={lot.w}
                    height={lot.h}
                    rx="2.5"
                    fill="#eef1ea"
                    stroke="#d4dacb"
                    strokeWidth="0.8"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
                {layers.ruas && lot.col === 0 && scale > 2.4 && (
                  <text x={lot.x - 3} y={lot.y + lot.h / 2 + 2} className={styles.streetLabel} textAnchor="end">
                    R{lot.row + 1}
                  </text>
                )}
              </g>
            ))
          )}
        </g>

        {/* ---- camada: sepulturas (polígonos interativos) ---- */}
        {layers.sepulturas && (
          <g>
            {GRAVES.map((grave) => (
              <rect
                key={grave.id}
                x={grave.x}
                y={grave.y}
                width={grave.w}
                height={grave.h}
                rx="1.2"
                className={`${styles.grave} ${drawing ? styles.graveInert : ""} ${dimmed(grave) ? styles.graveDimmed : ""} ${selectedId === grave.id ? styles.graveSelected : ""}`}
                fill={STATUS_META[grave.status].color}
                stroke={grave.blocked ? "#c0392b" : "rgba(255,255,255,0.7)"}
                strokeWidth={grave.blocked ? 1.6 : 0.6}
                strokeDasharray={grave.blocked ? "3 2" : "none"}
                vectorEffect="non-scaling-stroke"
                onPointerUp={(e) => onGravePointerUp(e, grave)}
              />
            ))}
          </g>
        )}

        {/* ---- camada: caminhos GPS (map_paths) ---- */}
        {layers.caminhos && (
          <g className={styles.bg}>
            <polyline points="400,486 400,232" className={styles.pathLine} vectorEffect="non-scaling-stroke" />
            <polyline points="20,232 780,232" className={styles.pathLine} vectorEffect="non-scaling-stroke" />
            <polyline points="282,20 282,480" className={styles.pathLine} vectorEffect="non-scaling-stroke" />
            <polyline points="522,20 522,480" className={styles.pathLine} vectorEffect="non-scaling-stroke" />
            {paths.map((path) => (
              <polyline
                key={path.id}
                points={path.points.map((p) => p.join(",")).join(" ")}
                className={styles.customPath}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}

        {/* ---- caminho sendo traçado ---- */}
        {drawing && draftPath.length > 0 && (
          <g className={styles.bg}>
            <polyline
              points={draftPath.map((p) => p.join(",")).join(" ")}
              className={styles.draftLine}
              vectorEffect="non-scaling-stroke"
            />
            {draftPath.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={2.6 / scale} className={styles.draftDot} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}

        {/* ---- rota simulada do visitante ---- */}
        {route && (
          <g className={styles.bg}>
            <polyline
              points={route.points.map((p) => p.join(",")).join(" ")}
              className={styles.routeLine}
              vectorEffect="non-scaling-stroke"
            />
            {route.points.map((p, i) => (
              <circle key={i} cx={p[0]} cy={p[1]} r={i === route.points.length - 1 ? 3.2 / scale : 2 / scale} className={styles.routeDot} vectorEffect="non-scaling-stroke" />
            ))}
          </g>
        )}

        {/* ---- entrada do cemitério ---- */}
        <g transform={`translate(${ENTRANCE[0]}, ${ENTRANCE[1]})`} className={styles.bg}>
          <circle r={7 / scale} className={styles.entranceDot} vectorEffect="non-scaling-stroke" />
          <text y={-10 / scale} className={styles.entranceLabel} style={{ fontSize: 10 / scale }} textAnchor="middle">
            ENTRADA
          </text>
        </g>

        {/* ---- pin da sepultura selecionada ---- */}
        {selected && (
          <g transform={`translate(${selected.cx}, ${selected.cy})`} className={styles.bg}>
            <circle r={12 / scale} className={styles.pinPulse} />
            <circle r={4 / scale} className={styles.pinDot} vectorEffect="non-scaling-stroke" />
          </g>
        )}
      </svg>

      <div className={styles.controls}>
        <button type="button" className={styles.controlBtn} onClick={() => zoomAt(0.72)} aria-label="Aproximar">
          <svg viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <button type="button" className={styles.controlBtn} onClick={() => zoomAt(1.4)} aria-label="Afastar">
          <svg viewBox="0 0 14 14" fill="none"><path d="M3 7h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>
        </button>
        <button type="button" className={styles.controlBtn} onClick={() => setView({ x: 0, y: 0, w: WORLD.w, h: WORLD.h })} aria-label="Visão geral">
          <svg viewBox="0 0 14 14" fill="none">
            <path d="M5 2H2v3M9 2h3v3M5 12H2V9M9 12h3V9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {scale > 1.05 && <span className={styles.zoomBadge}>{Math.round(scale * 100)}%</span>}
      <span className={styles.credit}>Ortofoto ilustrativa · aguardando imagem oficial do cemitério</span>
    </div>
  );
});

export default MapExplorer;
