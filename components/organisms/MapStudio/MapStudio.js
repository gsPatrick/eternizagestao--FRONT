"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./MapStudio.module.css";
import Button from "@/components/atoms/Button/Button";
import MapCanvas from "@/components/organisms/MapCanvas/MapCanvas";
import { buildShape, isShapeComplete, normalizeShape } from "@/components/organisms/MapCanvas/shape-model";

const SHAPE_LABEL = { polygon: "Desenho livre", rect: "Retângulo", triangle: "Triângulo", circle: "Círculo" };

function shapeCounter(shape) {
  if (!shape) return "0/3 pontos mínimos";
  if (shape.kind === "circle") return "Círculo · raio ajustável";
  const n = shape.points.length;
  if (shape.kind === "polygon") return n < 3 ? `${n}/3 pontos mínimos` : `${n} pontos`;
  return `${SHAPE_LABEL[shape.kind]} · ${n} pontos`;
}

/**
 * Estúdio de demarcação em TELA CHEIA — a unidade é pequena na ortofoto,
 * então o operador aproxima (zoom), arrasta até o lote e liga os pontos
 * do quadradinho da sepultura.
 */
export default function MapStudio({
  open,
  onClose,
  title = "Demarcação no mapa",
  subtitle,
  initial = [],
  onSave,
  saveLabel = "Salvar demarcação",
  onSkip,
  skipLabel = "Criar sem demarcar",
  saving = false,
}) {
  const [mounted, setMounted] = useState(false);
  const [draft, setDraft] = useState(normalizeShape(initial));
  const [tool, setTool] = useState("hand");
  const canvasRef = useRef(null);

  const complete = isShapeComplete(draft);
  const isPolygon = draft?.kind === "polygon";
  const hasShape = Boolean(draft);

  useEffect(() => setMounted(true), []);

  function insertShape(kind) {
    const view = canvasRef.current?.getView();
    if (!view) return;
    setDraft(buildShape(kind, view));
    setTool("edit"); // já cai na edição para posicionar/redimensionar
  }

  function undoPoint() {
    if (!isPolygon) return;
    const points = draft.points.slice(0, -1);
    setDraft(points.length ? { ...draft, points } : null);
  }

  useEffect(() => {
    if (open) {
      setDraft(normalizeShape(initial));
      setTool("hand"); // primeiro navega até o lote, depois desenha
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={styles.studio}>
      <header className={styles.head}>
        <button className={styles.back} onClick={onClose} aria-label="Voltar">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className={styles.headText}>
          <h2 className={styles.title}>{title}</h2>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
        <span className={styles.counter}>{shapeCounter(draft)}</span>
      </header>

      <div className={styles.mapArea}>
        <MapCanvas ref={canvasRef} shape={draft} onChange={setDraft} mode="draw" tool={tool} height="100%" />
        <div className={styles.hint}>
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 7.4v3.4M8 5.2v.2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>
          {tool === "hand" && (
            <span>
              <strong>Mover:</strong> arraste ou role com dois dedos · pinça (ou Ctrl+scroll) dá zoom.
              Chegando na unidade, use o <strong>lápis</strong> ou insira uma <strong>forma pronta</strong>.
            </span>
          )}
          {tool === "pen" && (
            <span>
              <strong>Desenhar:</strong> clique nos cantos da unidade para ligar os pontos.
              Dois dedos continuam navegando.
            </span>
          )}
          {tool === "edit" && draft?.kind === "circle" && (
            <span>
              <strong>Editar círculo:</strong> arraste o corpo para mover ·
              a <strong>alça lateral</strong> ajusta o raio.
            </span>
          )}
          {tool === "edit" && draft?.kind !== "circle" && (
            <span>
              <strong>Editar:</strong> arraste os pontos · arraste o corpo para mover ·
              alça do canto redimensiona{isPolygon ? " · losango na aresta cria ponto · " : " · "}
              <strong>duplo clique apaga o ponto</strong>.
            </span>
          )}
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.footLeft}>
          <div className={styles.toolGroup} role="group" aria-label="Ferramentas do mapa">
            <button
              type="button"
              className={`${styles.toolBtn} ${tool === "hand" ? styles.toolActive : ""}`}
              onClick={() => setTool("hand")}
              title="Mover o mapa (arrastar)"
            >
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M6.2 8.4V4.6a1.1 1.1 0 012.2 0v3.2M8.4 7.8V3.6a1.1 1.1 0 012.2 0v4.2M10.6 8V4.8a1.1 1.1 0 012.2 0V9c.9-.9 1.9-1.2 2.5-.5.5.6.2 1.3-.5 2.2l-2.4 3.1c-.8 1-1.9 1.7-3.4 1.7-2.8 0-4.4-1.8-4.4-4.4V8.6a1.1 1.1 0 012.2 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Mover
            </button>
            <button
              type="button"
              className={`${styles.toolBtn} ${tool === "pen" ? styles.toolActive : ""}`}
              onClick={() => setTool("pen")}
              title="Desenhar o polígono (clicar pontos)"
            >
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M3 15l.9-3.4L12.4 3a1.6 1.6 0 012.3 0l.3.3a1.6 1.6 0 010 2.3L6.4 14.1 3 15z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
                <path d="M11.2 4.2l2.6 2.6" stroke="currentColor" strokeWidth="1.3" />
              </svg>
              Desenhar
            </button>
            <button
              type="button"
              className={`${styles.toolBtn} ${tool === "edit" ? styles.toolActive : ""}`}
              onClick={() => setTool("edit")}
              disabled={!hasShape}
              title="Editar: mover pontos e forma, redimensionar, apagar (duplo clique)"
            >
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M4 10.5V4h6.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 4l9.5 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M11 13.5h3.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Editar
            </button>
          </div>

          <span className={styles.footDivider} />

          <div className={styles.toolGroup} role="group" aria-label="Formas prontas">
            <button type="button" className={styles.toolBtn} onClick={() => insertShape("rect")} title="Inserir retângulo (4 pontos)">
              <svg viewBox="0 0 18 18" fill="none"><rect x="2.5" y="5" width="13" height="8" rx="1" stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
            <button type="button" className={styles.toolBtn} onClick={() => insertShape("square")} title="Inserir quadrado (4 pontos)">
              <svg viewBox="0 0 18 18" fill="none"><rect x="4" y="4" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
            <button type="button" className={styles.toolBtn} onClick={() => insertShape("triangle")} title="Inserir triângulo (3 pontos)">
              <svg viewBox="0 0 18 18" fill="none"><path d="M9 3.5L15.5 14h-13L9 3.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            </button>
            <button type="button" className={styles.toolBtn} onClick={() => insertShape("circle")} title="Inserir círculo (centro + raio)">
              <svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.3" /></svg>
            </button>
          </div>

          <span className={styles.footDivider} />

          <Button variant="ghost" size="sm" disabled={!isPolygon || !draft.points.length} onClick={undoPoint}>
            Desfazer ponto
          </Button>
          <Button variant="ghost" size="sm" disabled={!hasShape} onClick={() => setDraft(null)}>
            Limpar
          </Button>
        </div>
        <div className={styles.footRight}>
          {onSkip && (
            <Button variant="secondary" loading={saving} onClick={onSkip}>
              {skipLabel}
            </Button>
          )}
          <Button loading={saving} disabled={!complete} onClick={() => onSave(draft)}>
            {saveLabel}
          </Button>
        </div>
      </footer>
    </div>,
    document.body
  );
}
