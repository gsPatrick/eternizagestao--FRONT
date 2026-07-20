/**
 * Modelo de forma da demarcação:
 *  { kind: "polygon",  points: [[x,y], ...] }  → desenho livre (lápis)
 *  { kind: "rect",     points: [4 pontos] }    → retângulo/quadrado
 *  { kind: "triangle", points: [3 pontos] }    → triângulo
 *  { kind: "circle",   cx, cy, r }             → círculo (sem pontos)
 */

export function normalizeShape(value) {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.length ? { kind: "polygon", points: value } : null;
  }
  return value;
}

export function isShapeComplete(value) {
  const shape = normalizeShape(value);
  if (!shape) return false;
  if (shape.kind === "circle") return shape.r > 0;
  const min = shape.kind === "triangle" ? 3 : shape.kind === "rect" ? 4 : 3;
  return (shape.points?.length || 0) >= min;
}

export function shapeBBox(shape) {
  if (shape.kind === "circle") {
    return { minX: shape.cx - shape.r, minY: shape.cy - shape.r, maxX: shape.cx + shape.r, maxY: shape.cy + shape.r };
  }
  const xs = shape.points.map((p) => p[0]);
  const ys = shape.points.map((p) => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

export function shapeCenter(shape) {
  if (shape.kind === "circle") return [shape.cx, shape.cy];
  const sum = shape.points.reduce((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / shape.points.length, sum[1] / shape.points.length];
}

export function buildShape(kind, view) {
  const cx = Math.round(view.x + view.w / 2);
  const cy = Math.round(view.y + view.h / 2);
  const s = view.w * 0.1;
  const round = (points) => points.map(([x, y]) => [Math.round(x), Math.round(y)]);

  if (kind === "rect") {
    const w = s;
    const h = s * 0.6;
    return { kind: "rect", points: round([[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2], [cx + w / 2, cy + h / 2], [cx - w / 2, cy + h / 2]]) };
  }
  if (kind === "square") {
    const half = s * 0.4;
    return { kind: "rect", points: round([[cx - half, cy - half], [cx + half, cy - half], [cx + half, cy + half], [cx - half, cy + half]]) };
  }
  if (kind === "triangle") {
    const half = s * 0.45;
    return { kind: "triangle", points: round([[cx, cy - half], [cx + half, cy + half * 0.8], [cx - half, cy + half * 0.8]]) };
  }
  return { kind: "circle", cx, cy, r: Math.round(s * 0.4) };
}
