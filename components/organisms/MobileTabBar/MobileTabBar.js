"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileTabBar.module.css";
import NavIcon from "@/components/atoms/NavIcon/NavIcon";
import { NAV_GROUPS, MOBILE_TAB_KEYS, findByKey, isActive } from "@/lib/panel-nav";

export default function MobileTabBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs = MOBILE_TAB_KEYS.map(findByKey).filter(Boolean);
  const tabHrefs = tabs.map((tab) => tab.href);
  const menuActive = !tabs.some((tab) => isActive(tab, pathname));

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <>
      <nav className={styles.bar} aria-label="Navegação principal">
        {tabs.map((tab, index) => {
          const active = isActive(tab, pathname) && !menuOpen;
          const isCenter = index === Math.floor(tabs.length / 2);

          if (isCenter) {
            return (
              <Link key={tab.key} href={tab.href} className={`${styles.fabWrap} ${active ? styles.active : ""}`}>
                <span className={`${styles.fab} ${active ? styles.fabActive : ""}`}>
                  <NavIcon name={tab.key} />
                </span>
                <span className={styles.tabLabel}>{tab.shortLabel || tab.label}</span>
              </Link>
            );
          }

          return (
            <Link key={tab.key} href={tab.href} className={`${styles.tab} ${active ? styles.active : ""}`}>
              <span className={styles.tabIcon}>
                <NavIcon name={tab.key} />
              </span>
              <span className={styles.tabLabel}>{tab.shortLabel || tab.label}</span>
            </Link>
          );
        })}
        <button
          className={`${styles.tab} ${menuOpen || menuActive ? styles.active : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
        >
          <span className={styles.tabIcon}>
            <svg viewBox="0 0 20 20" fill="none">
              <circle cx="5" cy="5" r="1.7" fill="currentColor" />
              <circle cx="10" cy="5" r="1.7" fill="currentColor" />
              <circle cx="15" cy="5" r="1.7" fill="currentColor" />
              <circle cx="5" cy="10" r="1.7" fill="currentColor" />
              <circle cx="10" cy="10" r="1.7" fill="currentColor" />
              <circle cx="15" cy="10" r="1.7" fill="currentColor" />
              <circle cx="5" cy="15" r="1.7" fill="currentColor" />
              <circle cx="10" cy="15" r="1.7" fill="currentColor" />
              <circle cx="15" cy="15" r="1.7" fill="currentColor" />
            </svg>
          </span>
          <span className={styles.tabLabel}>Menu</span>
        </button>
      </nav>

      {menuOpen && (
        <div className={styles.scrim} onClick={() => setMenuOpen(false)}>
          <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <span className={styles.handle} aria-hidden="true" />
            <div className={styles.sheetScroll}>
              {NAV_GROUPS.map((group) => (
                <div key={group.label} className={styles.sheetGroup}>
                  <span className={styles.sheetGroupLabel}>{group.label}</span>
                  <div className={styles.sheetGrid}>
                    {group.items.map((item) => {
                      const active = isActive(item, pathname);
                      const isTab = tabHrefs.includes(item.href);
                      return (
                        <Link
                          key={item.key}
                          href={item.href}
                          className={`${styles.sheetItem} ${active ? styles.sheetItemActive : ""}`}
                          onClick={() => setMenuOpen(false)}
                        >
                          <span className={styles.sheetIcon}>
                            <NavIcon name={item.key} />
                          </span>
                          <span className={styles.sheetLabel}>{item.label}</span>
                          {isTab && <span className={styles.sheetPin}>fixo</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
