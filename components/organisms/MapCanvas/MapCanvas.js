"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import styles from "./MapCanvas.module.css";
import { normalizeShape, shapeCenter } from "./shape-model";

/**
 * Mapa do cemitério sobre ortofoto (placeholder estilizado até o upload real).
 * Gestos: dois dedos navegam · pinça/Ctrl+scroll dá zoom · botões +/−/⛶.
 *
 * Formas tipadas (shape-model.js):
 *  - polygon (lápis): vértices móveis, losango na aresta cria ponto, duplo clique apaga
 *  - rect/triangle: exatamente 4/3 vértices móveis + alça de redimensionar (sem losangos)
 *  - circle: círculo de verdade — corpo move o centro, alça lateral ajusta o raio
 */

const WORLD = { w: 800, h: 500 };
const MIN_VIEW = 70;

const BLOCKS = [
  { x: 60, y: 60, w: 200, h: 150, label: "A" },
  { x: 300, y: 60, w: 200, h: 150, label: "B" },
  { x: 540, y: 60, w: 200, h: 150, label: "C" },
  { x: 60, y: 260, w: 200, h: 180, label: "D" },
  { x: 300, y: 260, w: 200, h: 180, label: "E" },
  { x: 540, y: 260, w: 200, h: 180, label: "F" },
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
      lots.push({ x: block.x + gap + c * (w + gap), y: block.y + 26 + gap + r * (h + gap), w, h });
    }
  }
  return lots;
}

function clampView(vb) {
  const w = Math.min(Math.max(vb.w, MIN_VIEW), WORLD.w);
  const h = (w * WORLD.h) / WORLD.w;
  const x = Math.min(Math.max(vb.x, 0), WORLD.w - w);
  const y = Math.min(Math.max(vb.y, 0), WORLD.h - h);
  return { x, y, w, h };
}

const MapCanvas = forwardRef(function MapCanvas(
  { shape: shapeProp = null, onChange, mode = "view", tool = "hand", height = 340, marker = null, onPick },
  apiRef
) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const actionRef = useRef(null);
  const shapeRef = useRef(null);
  const pointersRef = useRef(new Map());
  const viewRef = useRef({ x: 0, y: 0, w: WORLD.w, h: WORLD.h });
  const [view, setViewState] = useState(viewRef.current);
  const [hoverPoint, setHoverPoint] = useState(null);
  const [panning, setPanning] = useState(false);

  const shape = normalizeShape(shapeProp);
  shapeRef.current = shape;

  const editing = mode === "draw" && tool === "edit";
  const drawing = mode === "draw" && tool === "pen";
  const scale = WORLD.w / view.w;

  function setView(next) {
    viewRef.current = typeof next === "function" ? next(viewRef.current) : next;
    setViewState(viewRef.current);
  }

  useImperativeHandle(apiRef, () => ({
    getView: () => ({ ...viewRef.current }),
  }));

  function toSvgCoords(clientX, clientY) {
    const rect = svgRef.current.getBoundingClientRect();
    const vb = viewRef.current;
    return [
      Math.round(vb.x + ((clientX - rect.left) / rect.width) * vb.w),
      Math.round(vb.y + ((clientY - rect.top) / rect.height) * vb.h),
    ];
  }

  function zoomAt(factor, clientX, clientY) {
    setView((vb) => {
      const rect = svgRef.current.getBoundingClientRect();
      const px = vb.x + (((clientX ?? rect.left + rect.width / 2) - rect.left) / rect.width) * vb.w;
      const py = vb.y + (((clientY ?? rect.top + rect.height / 2) - rect.top) / rect.height) * vb.h;
      const w = Math.min(Math.max(vb.w * factor, MIN_VIEW), WORLD.w);
      const ratio = w / vb.w;
      return clampView({ x: px - (px - vb.x) * ratio, y: py - (py - vb.y) * ratio, w, h: (w * WORLD.h) / WORLD.w });
    });
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    function onWheel(event) {
      event.preventDefault();
      // pinça do touchpad (Chrome envia ctrlKey) → zoom
      if (event.ctrlKey || event.metaKey) {
        zoomAt(event.deltaY > 0 ? 1.12 : 0.89, event.clientX, event.clientY);
        return;
      }
      // roda de mouse (saltos grandes, sem eixo X) → zoom
      const isMouseWheel = event.deltaX === 0 && Math.abs(event.deltaY) >= 50;
      if (isMouseWheel) {
        zoomAt(event.deltaY > 0 ? 1.18 : 0.85, event.clientX, event.clientY);
        return;
      }
      // dois dedos do touchpad (movimento contínuo) → navegar
      const rect = el.getBoundingClientRect();
      setView((vb) =>
        clampView({
          ...vb,
          x: vb.x + (event.deltaX / rect.width) * vb.w,
          y: vb.y + (event.deltaY / rect.height) * vb.h,
        })
      );
    }
    el.addEventListener("wheel", onWheel, { passive: false });

    // Safari (macOS): pinça de touchpad dispara gesture events, não wheel
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

    // rede de segurança: ponteiro solto fora do mapa nunca fica "fantasma"
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

  function capturePointer(event) {
    try {
      svgRef.current.setPointerCapture(event.pointerId);
    } catch {
      /* alguns browsers recusam capture em gestos — segue sem */
    }
  }

  function trackPointer(event) {
    // só TOQUES entram na pinça — mouse/caneta nunca (evita ponteiro fantasma no desktop)
    if (event.pointerType !== "touch") return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // dois dedos na tela = pinça (zoom nativo de app) — cancela qualquer ação
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

  function startAction(event, action) {
    event.stopPropagation();
    capturePointer(event);
    trackPointer(event);
    if (pointersRef.current.size < 2) actionRef.current = action;
  }

  function startVertex(event, index) {
    if (!editing) return;
    const current = shapeRef.current;
    // retângulo: arrastar QUALQUER canto redimensiona (âncora no canto oposto)
    if (current?.kind === "rect") {
      startAction(event, { kind: "rectCorner", index, anchor: [...current.points[(index + 2) % 4]] });
      return;
    }
    startAction(event, { kind: "vertex", index });
  }

  function startMidpoint(event, index) {
    if (!editing || !onChange) return;
    const current = shapeRef.current;
    if (current?.kind !== "polygon") return;
    event.stopPropagation();
    capturePointer(event);
    trackPointer(event);
    if (pointersRef.current.size >= 2) return;
    const at = toSvgCoords(event.clientX, event.clientY);
    const points = [...current.points];
    points.splice(index + 1, 0, at);
    onChange({ ...current, points });
    actionRef.current = { kind: "vertex", index: index + 1 };
  }

  function startBody(event) {
    if (!editing) return;
    const current = shapeRef.current;
    startAction(event, {
      kind: "move",
      start: toSvgCoords(event.clientX, event.clientY),
      origin: current.kind === "circle" ? { cx: current.cx, cy: current.cy } : current.points.map((p) => [...p]),
    });
  }

  function startRadius(event) {
    if (!editing) return;
    startAction(event, { kind: "radius" });
  }

  function onSvgPointerDown(event) {
    capturePointer(event);
    trackPointer(event);
    if (pointersRef.current.size >= 2) return;
    if (drawing && onChange) {
      const at = toSvgCoords(event.clientX, event.clientY);
      const current = shapeRef.current;
      // lápis sempre trabalha em polígono livre; sobre outra forma, recomeça
      if (current?.kind === "polygon") {
        onChange({ ...current, points: [...current.points, at] });
      } else {
        onChange({ kind: "polygon", points: [at] });
      }
      return;
    }
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
    const at = toSvgCoords(event.clientX, event.clientY);
    const current = shapeRef.current;

    if (action) {
      if (action.kind === "pinch") {
        const points = [...pointersRef.current.values()];
        if (points.length === 2) {
          const [a, b] = points;
          const dist = Math.max(Math.hypot(a.x - b.x, a.y - b.y), 10);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const rect = svgRef.current.getBoundingClientRect();
          const start = action;
          // ponto do mundo sob o centro inicial da pinça
          const worldX = start.view.x + ((start.startMid.x - rect.left) / rect.width) * start.view.w;
          const worldY = start.view.y + ((start.startMid.y - rect.top) / rect.height) * start.view.h;
          const w = Math.min(Math.max(start.view.w * (start.startDist / dist), MIN_VIEW), WORLD.w);
          setView(
            clampView({
              x: worldX - ((mid.x - rect.left) / rect.width) * w,
              y: worldY - ((mid.y - rect.top) / rect.height) * ((w * WORLD.h) / WORLD.w),
              w,
              h: (w * WORLD.h) / WORLD.w,
            })
          );
        }
        return;
      }
      if (action.kind === "pan") {
        const dx = event.clientX - action.startX;
        const dy = event.clientY - action.startY;
        if (panning || Math.hypot(dx, dy) > 3) {
          if (!panning) setPanning(true);
          const rect = svgRef.current.getBoundingClientRect();
          setView(
            clampView({
              ...action.view,
              x: action.view.x - (dx / rect.width) * action.view.w,
              y: action.view.y - (dy / rect.height) * action.view.h,
            })
          );
        }
      } else if (action.kind === "vertex" && onChange && current?.points) {
        const points = [...current.points];
        points[action.index] = at;
        onChange({ ...current, points });
      } else if (action.kind === "rectCorner" && onChange && current?.kind === "rect") {
        // reconstrói o retângulo entre o canto âncora e o cursor (ordem cíclica)
        const [ax, ay] = action.anchor;
        const [dx, dy] = at;
        const points = new Array(4);
        points[action.index % 4] = [dx, dy];
        points[(action.index + 1) % 4] = [ax, dy];
        points[(action.index + 2) % 4] = [ax, ay];
        points[(action.index + 3) % 4] = [dx, ay];
        onChange({ ...current, points });
      } else if (action.kind === "move" && onChange && current) {
        const dx = at[0] - action.start[0];
        const dy = at[1] - action.start[1];
        if (current.kind === "circle") {
          onChange({ ...current, cx: Math.round(action.origin.cx + dx), cy: Math.round(action.origin.cy + dy) });
        } else {
          onChange({ ...current, points: action.origin.map(([x, y]) => [Math.round(x + dx), Math.round(y + dy)]) });
        }
      } else if (action.kind === "radius" && onChange && current?.kind === "circle") {
        const r = Math.max(Math.round(Math.hypot(at[0] - current.cx, at[1] - current.cy)), 3);
        onChange({ ...current, r });
      }
    }

    if (drawing) setHoverPoint(at);
  }

  function onPointerUp(event) {
    const action = actionRef.current;
    pointersRef.current.delete(event.pointerId);
    actionRef.current = null;
    // modo seleção: clique seco (sem arrastar) escolhe o ponto no mapa
    if (onPick && !drawing && !editing && !panning && action?.kind === "pan") {
      const moved = Math.hypot(event.clientX - action.startX, event.clientY - action.startY);
      if (moved <= 4) onPick(toSvgCoords(event.clientX, event.clientY));
    }
    setPanning(false);
  }

  function removeVertex(index) {
    const current = shapeRef.current;
    if (!editing || !onChange || current?.kind !== "polygon") return;
    const points = current.points.filter((_, i) => i !== index);
    onChange(points.length ? { ...current, points } : null);
  }

  const isCircle = shape?.kind === "circle";
  const points = !isCircle && shape ? shape.points : [];
  const pathData = points.map((p) => p.join(",")).join(" ");
  const closed = isCircle || points.length >= 3;
  const center = shape && closed ? shapeCenter(shape) : null;
  const r = 5 / scale;

  // losangos de "criar ponto" só existem no desenho livre
  const midpoints =
    editing && shape?.kind === "polygon" && points.length >= 2
      ? points.map((p, i) => {
          const q = points[(i + 1) % points.length];
          return [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
        })
      : [];

  const bodyClass = `${styles.polygon} ${editing ? styles.polygonEditable : styles.polygonStatic}`;
  const svgCursor = drawing ? styles.drawing : editing ? styles.editMode : onPick ? styles.picking : styles.grabbable;

  return (
    <div className={styles.wrap} style={{ height }} ref={wrapRef}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className={`${styles.svg} ${svgCursor} ${panning ? styles.panning : ""}`}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onLostPointerCapture={onPointerUp}
        onDoubleClick={(e) => {
          if (!drawing && !editing && !onPick) zoomAt(0.6, e.clientX, e.clientY); // duplo toque aproxima (padrão de app)
        }}
        onMouseLeave={() => setHoverPoint(null)}
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern id="grass" width="14" height="14" patternUnits="userSpaceOnUse">
            <rect width="14" height="14" fill="#e7ebe4" />
            <circle cx="4" cy="5" r="0.9" fill="#dde3d8" />
            <circle cx="11" cy="11" r="0.9" fill="#dde3d8" />
          </pattern>
        </defs>

        {/* fundo/ortofoto: nunca captura eventos — arrastar sempre navega */}
        <g className={styles.bg}>
          <rect width="800" height="500" fill="url(#grass)" />
          <rect x="0" y="215" width="800" height="34" rx="4" fill="#f2f3ef" />
          <rect x="272" y="0" width="20" height="500" fill="#f2f3ef" />
          <rect x="512" y="0" width="20" height="500" fill="#f2f3ef" />
          <line x1="0" y1="232" x2="800" y2="232" stroke="#d8dcd2" strokeWidth="1.5" strokeDasharray="10 8" vectorEffect="non-scaling-stroke" />
          {BLOCKS.map((block) => (
            <g key={block.label}>
              <rect x={block.x} y={block.y} width={block.w} height={block.h} rx="8" fill="#dfe5da" stroke="#cbd3c4" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <text x={block.x + 12} y={block.y + 19} className={styles.blockLabel}>QUADRA {block.label}</text>
              {lotsFor(block).map((lot, index) => (
                <rect key={index} x={lot.x} y={lot.y} width={lot.w} height={lot.h} rx="2.5" fill="#eef1ea" stroke="#d4dacb" strokeWidth="0.8" vectorEffect="non-scaling-stroke" />
              ))}
            </g>
          ))}
          {[[30, 30], [770, 40], [40, 470], [760, 470], [285, 470], [530, 30]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="11" fill="#c9d4bf" opacity="0.85" />
          ))}
        </g>

        {/* ---- forma da sepultura ---- */}
        {isCircle && (
          <circle cx={shape.cx} cy={shape.cy} r={shape.r} className={bodyClass} vectorEffect="non-scaling-stroke" onPointerDown={startBody} />
        )}
        {!isCircle && points.length >= 3 && (
          <polygon points={pathData} className={bodyClass} vectorEffect="non-scaling-stroke" onPointerDown={startBody} />
        )}
        {!isCircle && points.length === 2 && (
          <polyline points={pathData} className={styles.polyline} vectorEffect="non-scaling-stroke" />
        )}
        {drawing && hoverPoint && shape?.kind === "polygon" && points.length > 0 && !panning && (
          <line
            x1={points[points.length - 1][0]}
            y1={points[points.length - 1][1]}
            x2={hoverPoint[0]}
            y2={hoverPoint[1]}
            className={styles.ghostLine}
            vectorEffect="non-scaling-stroke"
          />
        )}

        {/* círculo: centro + alça de raio */}
        {editing && isCircle && (
          <>
            <line x1={shape.cx} y1={shape.cy} x2={shape.cx + shape.r} y2={shape.cy} className={styles.radiusLine} vectorEffect="non-scaling-stroke" />
            <circle cx={shape.cx} cy={shape.cy} r={2.6 / scale} className={styles.centerDot} vectorEffect="non-scaling-stroke" />
            <circle
              cx={shape.cx + shape.r}
              cy={shape.cy}
              r={6 / scale}
              className={styles.radiusHandle}
              vectorEffect="non-scaling-stroke"
              onPointerDown={startRadius}
            />
          </>
        )}

        {/* losangos (só polígono livre): arraste para criar ponto */}
        {midpoints.map((mid, index) => (
          <rect
            key={`mid-${index}`}
            x={mid[0] - 3.6 / scale}
            y={mid[1] - 3.6 / scale}
            width={7.2 / scale}
            height={7.2 / scale}
            transform={`rotate(45 ${mid[0]} ${mid[1]})`}
            className={styles.midpoint}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => startMidpoint(e, index)}
          />
        ))}

        {/* vértices */}
        {points.map((point, index) => (
          <circle
            key={index}
            cx={point[0]}
            cy={point[1]}
            r={editing ? r * 1.2 : r}
            className={`${styles.vertex} ${editing ? styles.vertexEditable : styles.vertexStatic}`}
            vectorEffect="non-scaling-stroke"
            onPointerDown={(e) => startVertex(e, index)}
            onDoubleClick={(e) => {
              e.stopPropagation();
              removeVertex(index);
            }}
          />
        ))}

        {mode === "view" && center && (
          <g transform={`translate(${center[0]}, ${center[1]})`} className={styles.bg}>
            <circle r={14 / scale} className={styles.pinPulse} />
            <circle r={5.5 / scale} className={styles.pinDot} vectorEffect="non-scaling-stroke" />
          </g>
        )}

        {/* marcador de ponto escolhido (ex.: entrada do cemitério) */}
        {marker && (
          <g transform={`translate(${marker[0]}, ${marker[1]})`} className={styles.bg}>
            <circle r={16 / scale} className={styles.pinPulse} />
            <circle r={6 / scale} className={styles.pinDot} vectorEffect="non-scaling-stroke" />
            <text y={-14 / scale} className={styles.markerLabel} style={{ fontSize: 11 / scale }} textAnchor="middle">
              ENTRADA
            </text>
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

export default MapCanvas;
