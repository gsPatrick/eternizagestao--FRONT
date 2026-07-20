"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

export default function Modal({ open, onClose, title, subtitle, children, footer, width = 520 }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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

  // portal no <body>: o modal sempre sobrepõe sidebar/header/tab bar,
  // imune a stacking contexts criados por animações das páginas
  return createPortal(
    <div className={styles.overlay} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <span className={styles.handle} aria-hidden="true" />
        <header className={styles.header}>
          <div>
            <h3 className={styles.title}>{title}</h3>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          <button className={styles.close} onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className={styles.body}>{children}</div>
        {footer && <footer className={styles.footer}>{footer}</footer>}
      </div>
    </div>,
    document.body
  );
}
