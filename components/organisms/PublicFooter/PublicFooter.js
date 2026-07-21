"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import styles from "./PublicFooter.module.css";

/**
 * Footer estilo remake General Intelligence: o bloco navy termina com um
 * margin-bottom alto e a foto do hero fica FIXA atrás (z -1) — o fim do
 * scroll revela a imagem como uma cortina, com a barra de copyright em cima.
 */

const SALES_NAV = [
  { label: "Início", href: "/#top" },
  { label: "A plataforma", href: "/#plataforma" },
  { label: "Painel demo", href: "/#painel-demo" },
  { label: "Acessar o painel", href: "/login" },
];

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M7 17 17 7M9 7h8v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// `imageUrl`: arte própria do rodapé da CIDADE; sem ela, a arte padrão.
export default function PublicFooter({ variant = "sales", nav, heading, cityName, imageUrl = null }) {
  const isPublic = variant === "public";
  const navItems = nav || SALES_NAV;
  // fade-in da foto revelada no rodapé (mesmo esquema do hero: LQIP + fade)
  const [bgLoaded, setBgLoaded] = useState(false);
  const bgImgRef = useRef(null);
  useEffect(() => {
    if (bgImgRef.current?.complete) setBgLoaded(true);
  }, []);
  const title = heading || (isPublic
    ? "Feito com respeito por quem você ama."
    : "Construído para cuidar da memória das cidades brasileiras.");

  return (
    <>
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.heroBlock}>
            <div className={styles.logo}>
              <BrandMark tone="light" size="md" />
            </div>
            <h2 className={styles.heading}>{title}</h2>
            {isPublic ? (
              <p className={styles.ctaText}>
                Dúvidas sobre um jazigo ou uma cobrança?{" "}
                <a className={styles.ctaLink} href="mailto:contato@eternizagestao.com.br">
                  <span>fale com a administração</span>
                  <span className={styles.ctaArrow} aria-hidden="true">
                    <ArrowIcon />
                  </span>
                </a>
              </p>
            ) : (
              <p className={styles.ctaText}>
                Quer ver funcionando na sua?{" "}
                <a
                  className={styles.ctaLink}
                  href="mailto:contato@eternizagestao.com.br?subject=Demonstração%20Eterniza%20Gestão"
                >
                  <span>agende uma demonstração</span>
                  <span className={styles.ctaArrow} aria-hidden="true">
                    <ArrowIcon />
                  </span>
                </a>
              </p>
            )}
          </div>

          <div className={styles.bottom}>
            <nav aria-label="Rodapé">
              <ul className={styles.navList}>
                {navItems.map((item) => (
                  <li key={item.label}>
                    <Link className={styles.navLink} href={item.href}>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className={styles.actions}>
              <div className={styles.social}>
                <a className={styles.socialBtn} href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                    <circle cx="17.2" cy="6.8" r="1.3" fill="currentColor" />
                  </svg>
                </a>
                <a className={styles.socialBtn} href="https://linkedin.com" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* fundo fixo revelado no fim do scroll (a foto do hero) */}
      <div className={styles.bgWrap} aria-hidden="true">
        <div className={styles.bgInner}>
          <div className={styles.bgGradient} />
          <picture>
            {!imageUrl && <source srcSet="/media/hero.webp" type="image/webp" />}
            <img
              ref={bgImgRef}
              src={imageUrl || "/media/hero.jpg"}
              alt=""
              className={`${styles.bgImage} ${bgLoaded ? styles.bgImageLoaded : ""}`}
              loading="lazy"
              decoding="async"
              onLoad={() => setBgLoaded(true)}
            />
          </picture>
          <div className={styles.bgBar}>
            <span>© 2026 Eterniza Gestão — plataforma de gestão de cemitérios</span>
            <span className={styles.credit}>
              Desenvolvido por{" "}
              <a href="https://www.codebypatrick.dev/" target="_blank" rel="noreferrer">
                Patrick.Developer
              </a>
            </span>
            <a href="mailto:contato@eternizagestao.com.br">contato@eternizagestao.com.br</a>
          </div>
        </div>
      </div>
    </>
  );
}
