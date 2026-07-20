"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import styles from "./PublicNav.module.css";

const SALES_LINKS = [
  { label: "A plataforma", href: "#plataforma" },
  { label: "Painel demo", href: "#painel-demo" },
];

/**
 * Header público: transparente sobre o hero (texto branco) e, no primeiro
 * scroll, vira uma barra sólida clara. Serve tanto a LP de vendas (raiz) quanto
 * a página pública do tenant — os links e o "home" da marca vêm por prop.
 */
export default function PublicNav({ solid = false, links = SALES_LINKS, home = "/", cta = { label: "Acessar o painel", href: "/login" } }) {
  const LINKS = links;
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (solid) return;
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [solid]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const isSolid = solid || scrolled;

  return (
    <header className={`${styles.header} ${isSolid ? styles.scrolled : ""} ${open ? styles.menuOpen : ""}`}>
      <div className={styles.inner}>
        <Link className={styles.logo} href={home} aria-label="Início">
          <BrandMark tone={isSolid || open ? "dark" : "light"} size="md" />
        </Link>

        <nav className={styles.nav}>
          <ul className={styles.menu}>
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link className={styles.menuItem} href={l.href}>
                  {l.label}
                </Link>
              </li>
            ))}
            <li>
              <Link className={styles.cta} href={cta.href}>
                {cta.label}
              </Link>
            </li>
          </ul>

          <button
            type="button"
            className={`${styles.burger} ${open ? styles.burgerOpen : ""}`}
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span />
            <span />
          </button>
        </nav>
      </div>

      <div className={`${styles.popup} ${open ? styles.popupOpen : ""}`} role="dialog" aria-modal="true" aria-label="Menu">
        <div className={styles.popupInner}>
          <ul className={styles.popupMenu}>
            {[...LINKS, cta].map((l) => (
              <li key={l.label}>
                <Link className={styles.popupItem} href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <a className={styles.popupMail} href="mailto:contato@eternizagestao.com.br">
            contato@eternizagestao.com.br
          </a>
        </div>
      </div>
    </header>
  );
}
