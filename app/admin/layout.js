"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./layout.module.css";

import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import Avatar from "@/components/atoms/Avatar/Avatar";
import { getUser, isAuthed, clearSession } from "@/lib/api/session";

/**
 * AdminShell — casca do CONSOLE DA PLATAFORMA (super_admin).
 *
 * Identidade navy da plataforma — NÃO usa TenantTheme (a marca não é temada por
 * cidade). Guarda client-side: sem sessão OU role !== 'super_admin' → manda pro
 * /admin/login. A própria /admin/login fica FORA da casca (só renderiza o form).
 */
export default function AdminLayout({ children }) {
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
    // guard: exige sessão E papel de plataforma. O login é o único em `/login`.
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

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brandZone}>
          <BrandMark tone="light" size="md" brand={{ lead: "Eterniza", tail: "Gestão" }} />
          <span className={styles.platformTag}>Plataforma</span>
        </div>

        <nav className={styles.nav} aria-label="Navegação da plataforma">
          <button
            type="button"
            className={`${styles.navItem} ${styles.navActive}`}
            onClick={() => router.push("/admin")}
          >
            <span className={styles.navIcon}>
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M2 6.5 8 2l6 4.5V13a1 1 0 0 1-1 1h-3v-4H6v4H3a1 1 0 0 1-1-1V6.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              </svg>
            </span>
            Cidades
          </button>
        </nav>

        <div className={styles.account}>
          {user && (
            <div className={styles.identity}>
              <span className={styles.identityName}>{user.name}</span>
              <span className={styles.identityRole}>Plataforma</span>
            </div>
          )}
          <Avatar name={user?.name || "Plataforma"} size="sm" />
          <button type="button" className={styles.signOut} onClick={signOut}>
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M10 11.5 13.5 8 10 4.5M13 8H6M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sair
          </button>
        </div>
      </header>

      <main className={styles.content}>{children}</main>
    </div>
  );
}
