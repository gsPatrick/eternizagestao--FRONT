"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./Sidebar.module.css";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import NavIcon from "@/components/atoms/NavIcon/NavIcon";
import { NAV_GROUPS, isActive } from "@/lib/panel-nav";

export default function Sidebar({ collapsed, onToggle, onNavigate }) {
  const pathname = usePathname();
  const [tip, setTip] = useState(null);

  function showTip(label, event) {
    if (!collapsed) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ label, top: rect.top + rect.height / 2 });
  }

  function hideTip() {
    setTip(null);
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <button
        className={styles.toggle}
        onClick={onToggle}
        aria-label={collapsed ? "Expandir menu" : "Retrair menu"}
      >
        <svg viewBox="0 0 12 12" fill="none">
          <path d="M7.5 3L4.5 6l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div className={styles.brand}>
        {collapsed ? (
          <span className={styles.brandSymbol}>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.5" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" />
            </svg>
          </span>
        ) : (
          <BrandMark tone="dark" size="sm" />
        )}
      </div>

      <nav className={styles.nav} onScroll={hideTip}>
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            {!collapsed && <span className={styles.groupLabel}>{group.label}</span>}
            {group.items.map((item) => {
              const active = isActive(item, pathname);
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${styles.item} ${active ? styles.active : ""}`}
                  onClick={onNavigate}
                  onMouseEnter={(e) => showTip(item.label, e)}
                  onMouseLeave={hideTip}
                >
                  <span className={styles.icon}><NavIcon name={item.key} /></span>
                  <span className={styles.label}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className={styles.footer}>
        <div
          className={`${styles.item} ${styles.tenant}`}
          onMouseEnter={(e) => showTip("Prefeitura Demo", e)}
          onMouseLeave={hideTip}
        >
          <span className={styles.tenantDot} />
          <span className={styles.label}>
            <span className={styles.tenantName}>Prefeitura Demo</span>
            <span className={styles.tenantSub}>demo.eterniza.com</span>
          </span>
        </div>
      </div>

      {collapsed && tip && (
        <span className={styles.floatingTip} style={{ top: tip.top }}>
          {tip.label}
        </span>
      )}
    </aside>
  );
}
