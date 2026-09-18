"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "./PanelHeader.module.css";
import Avatar from "@/components/atoms/Avatar/Avatar";
import { findNavItem } from "@/lib/panel-nav";
import { logout, getUser, updateStoredUser } from "@/lib/api/session";
import { canViewModule, NAV_MODULE } from "@/lib/permissions";
import { getMe } from "@/lib/api/resources/me";

// Rótulo do papel fixo. Quando o usuário tem um perfil customizado (feature
// `roles`), o nome do perfil (`roleName`) tem precedência sobre este mapa.
const ROLE_LABEL = {
  super_admin: "Super admin",
  admin: "Administrador",
  operador: "Operador",
  consulta: "Consulta",
};

export function roleLabelOf(user) {
  if (!user) return "";
  return user.roleName || ROLE_LABEL[user.role] || "Usuário";
}

export default function PanelHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Usuário da sessão. Começa null nos DOIS lados (servidor e primeiro render
  // do cliente) porque localStorage só existe no navegador — ler direto aqui
  // divergiria do HTML do servidor e quebraria a hidratação. Preenchemos após
  // montar e, em seguida, revalidamos com GET /sessions/me (que traz também o
  // nome do perfil de acesso do RBAC) sem travar o render.
  const [user, setUser] = useState(null);

  useEffect(() => {
    const local = getUser();
    setUser(local);
    if (!local) return;
    let vivo = true;
    getMe()
      .then((fresco) => {
        if (!vivo || !fresco) return;
        setUser(fresco);
        updateStoredUser(fresco); // header e sidebar passam a ver o dado novo
      })
      .catch(() => {
        /* silencioso: já mostramos o que estava na sessão */
      });
    return () => {
      vivo = false;
    };
  }, []);

  const nome = user?.name || "";
  const email = user?.email || "";
  const papel = roleLabelOf(user);
  const podeConfigurar = canViewModule(NAV_MODULE.settings, user);

  function irPara(href) {
    setMenuOpen(false);
    router.push(href);
  }

  const current = findNavItem(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    }
    function onKey(event) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className={styles.header}>
      <div className={styles.left}>
        <div className={styles.crumb}>
          <span className={styles.crumbRoot}>Painel</span>
          {current && current.href !== "/painel" && (
            <>
              <span className={styles.crumbSep}>/</span>
              <span className={styles.crumbCurrent}>{current.label}</span>
            </>
          )}
        </div>
      </div>

      <div className={styles.right} ref={menuRef}>
        <button
          className={`${styles.user} ${menuOpen ? styles.userOpen : ""}`}
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          <Avatar name={nome} size="sm" />
          <span className={styles.userInfo}>
            <span className={styles.userName}>{nome || "—"}</span>
            <span className={styles.userRole}>{papel}</span>
          </span>
          <svg className={styles.chevron} viewBox="0 0 16 16" fill="none">
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {menuOpen && (
          <div className={styles.menu} role="menu">
            <div className={styles.menuHead}>
              <Avatar name={nome} size="md" />
              <div>
                <span className={styles.menuName}>{nome || "—"}</span>
                <span className={styles.menuEmail}>{email}</span>
              </div>
            </div>
            <div className={styles.menuList}>
              <button className={styles.menuItem} role="menuitem" onClick={() => irPara("/painel/perfil")}>
                <svg viewBox="0 0 18 18" fill="none">
                  <circle cx="9" cy="6" r="2.7" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M3.6 15c.7-2.6 2.9-4 5.4-4s4.7 1.4 5.4 4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
                Meu perfil
              </button>
              {/* Mesmo critério da sidebar: o item só aparece para quem pode
                  ver o módulo de usuários/configurações. */}
              {podeConfigurar && (
                <button className={styles.menuItem} role="menuitem" onClick={() => irPara("/painel/configuracoes")}>
                  <svg viewBox="0 0 18 18" fill="none">
                    <circle cx="9" cy="9" r="2.4" stroke="currentColor" strokeWidth="1.4" />
                    <path d="M9 2.2l.9 1.9 2.1.4 1.5-1 1.3 1.3-1 1.5.4 2.1 1.9.9-.7 1.7-2.1.2-1.1 1.8.5 2-1.7.7-1.5-1.4h-2.2L6 15.8l-1.7-.7.5-2-1.1-1.8-2.1-.2-.7-1.7 1.9-.9.4-2.1-1-1.5L3.5 3.6l1.5 1 2.1-.4.9-2z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
                  </svg>
                  Configurações
                </button>
              )}
            </div>
            <div className={styles.menuDivider} />
            <button
              className={`${styles.menuItem} ${styles.menuDanger}`}
              role="menuitem"
              onClick={() => logout("/login")}
            >
              <svg viewBox="0 0 18 18" fill="none">
                <path d="M7 15.5H4a1 1 0 01-1-1v-11a1 1 0 011-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M12 12.5L15.5 9 12 5.5M15 9H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sair da conta
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
