"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import styles from "./AdminShell.module.css";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import Avatar from "@/components/atoms/Avatar/Avatar";
import { getUser, isAuthed, clearSession } from "@/lib/api/session";
import { ADMIN_NAV, isActive, findAdminNavItem } from "@/lib/admin-nav";

/**
 * AdminShell — casca do CONSOLE DA PLATAFORMA (super_admin).
 *
 * Espelha a estrutura/breakpoints do PanelShell (sidebar+header no desktop /
 * bottom tab bar no mobile) mas com identidade NAVY fixa da plataforma — NÃO
 * usa TenantTheme (a marca não é temada por cidade).
 *
 * Guarda client-side: sem sessão OU role !== 'super_admin' → /login. A rota
 * `/admin/login` renderiza os filhos SEM casca (bypass).
 */

// SVGs inline dos 3 destinos (não depende do NavIcon do painel).
const ICONS = {
  // casa/prédio
  overview: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M3 8.5 10 3l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  ),
  // prédios da cidade
  cities: (
    <svg viewBox="0 0 20 20" fill="none">
      <path d="M3 17h14M4.5 17V6.5L10 3.5v13.5M15.5 17V9l-5.5-3" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M7 8.5v0M7 11v0M7 13.5v0M12.5 11v0M12.5 13.5v0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  // pessoa
  account: (
    <svg viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6.5" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 16.5c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const CENTER_INDEX = Math.floor(ADMIN_NAV.length / 2); // 3 destinos → o do meio (Cidades) vira o FAB

export default function AdminShell({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginRoute = pathname === "/admin/login";
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isLoginRoute) {
      setReady(true);
      return;
    }
    // guard: exige sessão E papel de plataforma. O login vive em `/login`.
    if (!isAuthed() || getUser()?.role !== "super_admin") {
      router.replace("/login");
      return;
    }
    setUser(getUser());
    setReady(true);
  }, [isLoginRoute, pathname, router]);

  function signOut() {
    clearSession();
    router.replace("/login");
  }

  // A tela de login não recebe a casca.
  if (isLoginRoute) return children;

  // Enquanto o guard resolve, não pisca conteúdo protegido.
  if (!ready) {
    return (
      <div className={styles.gate} aria-busy="true">
        <BrandMark tone="dark" size="md" brand={{ lead: "Eterniza", tail: "Gestão" }} />
      </div>
    );
  }

  const current = findAdminNavItem(pathname);
  const name = user?.name || "Plataforma";

  return (
    <div className={styles.shell}>
      {/* ---------- sidebar navy (desktop) ---------- */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <BrandMark tone="light" size="sm" brand={{ lead: "Eterniza", tail: "Gestão" }} />
          <span className={styles.tag}>Plataforma</span>
        </div>

        <nav className={styles.nav} aria-label="Navegação da plataforma">
          {ADMIN_NAV.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.item} ${active ? styles.active : ""}`}
              >
                <span className={styles.icon}>{ICONS[item.key]}</span>
                <span className={styles.label}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.footer}>
          <div className={styles.identity}>
            <Avatar name={name} size="sm" />
            <span className={styles.identityText}>
              <span className={styles.identityName}>{name}</span>
              <span className={styles.identitySub}>Plataforma</span>
            </span>
          </div>
          <button type="button" className={styles.signOut} onClick={signOut}>
            <svg viewBox="0 0 18 18" fill="none">
              <path d="M7 15.5H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <path d="M12 12.5 15.5 9 12 5.5M15 9H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair
          </button>
        </div>
      </aside>

      {/* ---------- conteúdo ---------- */}
      <div className={styles.main}>
        <header className={styles.header}>
          <div className={styles.crumb}>
            <span className={styles.crumbRoot}>Plataforma</span>
            {current && (
              <>
                <span className={styles.crumbSep}>/</span>
                <span className={styles.crumbCurrent}>{current.label}</span>
              </>
            )}
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>

      {/* ---------- bottom tab bar (mobile) ---------- */}
      <nav className={styles.bar} aria-label="Navegação da plataforma">
        {ADMIN_NAV.map((item, index) => {
          const active = isActive(item, pathname);
          if (index === CENTER_INDEX) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`${styles.fabWrap} ${active ? styles.tabActive : ""}`}
              >
                <span className={`${styles.fab} ${active ? styles.fabActive : ""}`}>
                  {ICONS[item.key]}
                </span>
                <span className={styles.tabLabel}>{item.shortLabel}</span>
              </Link>
            );
          }
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.tab} ${active ? styles.tabActive : ""}`}
            >
              <span className={styles.tabIcon}>{ICONS[item.key]}</span>
              <span className={styles.tabLabel}>{item.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
