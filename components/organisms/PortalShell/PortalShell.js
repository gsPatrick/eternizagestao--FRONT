"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import { clearSession } from "@/lib/api/session";
import styles from "./PortalShell.module.css";

/**
 * Shell do Portal da Família — app nativo no mobile (top bar enxuta + bottom
 * tab bar) e web no desktop (top bar com nav horizontal). Envolve todas as
 * telas internas do portal.
 */

const TABS = [
  {
    key: "inicio",
    label: "Início",
    href: "/portal/inicio",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 11 12 4l8 7M6 9.5V20h12V9.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "jazigos",
    label: "Jazigos",
    href: "/portal/jazigos",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M7 20V9a5 5 0 0 1 10 0v11" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M4.5 20h15M10 11h4M12 8.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "cobrancas",
    label: "Cobranças",
    href: "/portal/cobrancas",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <rect x="3" y="6" width="18" height="12.5" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10h18M7 14.5h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "perfil",
    label: "Perfil",
    href: "/portal/perfil",
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.5" r="3.6" stroke="currentColor" strokeWidth="1.7" />
        <path d="M5 20c1.2-3.6 3.8-5.4 7-5.4s5.8 1.8 7 5.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function PortalShell({ children, active }) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(tab) {
    if (active) return tab.key === active;
    return pathname.startsWith(tab.href);
  }

  return (
    <div className={styles.shell}>
      {/* top bar */}
      <header className={styles.topbar}>
        <div className={styles.topInner}>
          <Link href="/portal/inicio" className={styles.brand} aria-label="Portal da Família">
            <BrandMark tone="dark" size="sm" />
            <span className={styles.brandTag}>Portal da Família</span>
          </Link>

          <nav className={styles.desktopNav}>
            {TABS.map((tab) => (
              <Link
                key={tab.key}
                href={tab.href}
                className={`${styles.navLink} ${isActive(tab) ? styles.navLinkActive : ""}`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <button
            className={styles.exit}
            onClick={() => {
              clearSession();
              router.push("/portal/login");
            }}
          >
            <span>Sair</span>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M14 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M18 15l3-3-3-3M9 12h12" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* conteúdo */}
      <main className={styles.content}>{children}</main>

      {/* bottom tab bar — nativo no mobile */}
      <nav className={styles.tabbar}>
        {TABS.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`${styles.tab} ${isActive(tab) ? styles.tabActive : ""}`}
          >
            <span className={styles.tabIcon}>{tab.icon}</span>
            <span className={styles.tabLabel}>{tab.label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
