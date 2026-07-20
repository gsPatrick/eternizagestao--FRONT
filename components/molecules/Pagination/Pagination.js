"use client";

import styles from "./Pagination.module.css";

export default function Pagination({ page = 1, totalPages = 1, onChange }) {
  const pages = [];
  for (let i = 1; i <= totalPages; i += 1) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <nav className={styles.nav} aria-label="Paginação">
      <button
        className={styles.arrow}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Página anterior"
      >
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {pages.map((item, index) =>
        item === "…" ? (
          <span key={`gap-${index}`} className={styles.gap}>…</span>
        ) : (
          <button
            key={item}
            className={`${styles.page} ${item === page ? styles.active : ""}`}
            onClick={() => onChange(item)}
          >
            {item}
          </button>
        )
      )}
      <button
        className={styles.arrow}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Próxima página"
      >
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </nav>
  );
}
