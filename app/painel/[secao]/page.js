"use client";

import { usePathname } from "next/navigation";
import styles from "./page.module.css";
import { findNavItem } from "@/lib/panel-nav";

export default function SectionPlaceholderPage() {
  const pathname = usePathname();
  const item = findNavItem(pathname);

  return (
    <div className={styles.blank}>
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon}>
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3l7 4v5c0 4.6-3 7.4-7 9-4-1.6-7-4.4-7-9V7l7-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M12 8v4M12 15.5v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <h1 className={styles.placeholderTitle}>{item?.label || "Em construção"}</h1>
        <p className={styles.placeholderText}>
          Esta página será construída em breve. A navegação e o layout do painel
          já estão prontos para recebê-la.
        </p>
      </div>
    </div>
  );
}
