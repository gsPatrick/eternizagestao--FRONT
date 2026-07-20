"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./FileViewer.module.css";
import Button from "@/components/atoms/Button/Button";
import Spinner from "@/components/atoms/Spinner/Spinner";

export function fileKind(name = "") {
  const ext = name.split(".").pop().toLowerCase();
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(ext)) return "office";
  return "other";
}

// docx/xlsx não renderizam nativamente no browser — usa o conversor da Microsoft
// quando o arquivo tem URL pública (produção); senão, fallback com download.
function officeViewerUrl(url) {
  if (!/^https?:\/\//.test(url)) return null;
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`;
}

export default function FileViewer({ open, onClose, file }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [zoomed, setZoomed] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setZoomed(false);
    }
  }, [open, file?.url]);

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

  if (!open || !mounted || !file) return null;

  const kind = fileKind(file.name);
  const officeUrl = kind === "office" ? officeViewerUrl(file.url) : null;

  return createPortal(
    <div className={styles.viewer}>
      <header className={styles.head}>
        <div className={styles.headInfo}>
          <span className={styles.fileIcon}>
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M5.5 2.5h6l3.5 3.5v11.5h-9.5V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M11.5 2.5V6H15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </span>
          <div className={styles.headText}>
            <h2 className={styles.fileName}>{file.name}</h2>
            <p className={styles.fileMeta}>
              {[file.category, file.size].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        <div className={styles.headActions}>
          <a href={file.url} download={file.name} className={styles.downloadLink}>
            <Button variant="secondary" size="sm" iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 2.5v8M8 10.5l-3-3M8 10.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M3 12v1.5h10V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }>
              Baixar
            </Button>
          </a>
          <button className={styles.close} onClick={onClose} aria-label="Fechar visualizador">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      <div className={styles.body} onClick={(e) => e.target === e.currentTarget && onClose()}>
        {loading && kind !== "other" && !(kind === "office" && !officeUrl) && (
          <span className={styles.loading}><Spinner size={22} tone="light" /></span>
        )}

        {kind === "image" && (
          <img
            src={file.url}
            alt={file.name}
            className={`${styles.image} ${zoomed ? styles.imageZoomed : ""}`}
            onLoad={() => setLoading(false)}
            onClick={() => setZoomed((v) => !v)}
          />
        )}

        {kind === "pdf" && (
          <iframe
            src={file.url}
            title={file.name}
            className={styles.frame}
            onLoad={() => setLoading(false)}
          />
        )}

        {kind === "office" && officeUrl && (
          <iframe
            src={officeUrl}
            title={file.name}
            className={styles.frame}
            onLoad={() => setLoading(false)}
          />
        )}

        {(kind === "other" || (kind === "office" && !officeUrl)) && (
          <div className={styles.fallback}>
            <span className={styles.fallbackIcon}>
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M6.5 2.5h8l4 4v15h-12v-19z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M14.5 2.5V7H19" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                <path d="M9 12.5h6M9 15.5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            <h3 className={styles.fallbackTitle}>Pré-visualização indisponível</h3>
            <p className={styles.fallbackText}>
              {kind === "office"
                ? "Documentos do Office são visualizados após a publicação no storage. Baixe o arquivo para abrir agora."
                : "Este formato não tem visualização no navegador. Baixe o arquivo para abrir."}
            </p>
            <a href={file.url} download={file.name}>
              <Button size="sm">Baixar arquivo</Button>
            </a>
          </div>
        )}
      </div>

      {kind === "image" && !loading && (
        <footer className={styles.footHint}>Clique na imagem para {zoomed ? "reduzir" : "ampliar"} · ESC fecha</footer>
      )}
    </div>,
    document.body
  );
}
