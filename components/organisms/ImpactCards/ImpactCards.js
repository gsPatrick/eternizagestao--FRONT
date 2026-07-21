"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./ImpactCards.module.css";

/**
 * Quinta seção — scroll-driven (skill scroll-driven-handoff): a frase de
 * impacto fica presa no topo enquanto os cards atravessam a tela na
 * horizontal, dirigidos pelo scroll vertical. Runway alto + sticky de 100vh;
 * um único progresso anima trilho, frase e contador.
 */

const CARDS = [
  {
    num: "01",
    title: "Migração assistida",
    text: "Livros, fichas e planilhas entram validados — nada sobe para produção sem revisão humana.",
    artifact: "import",
  },
  {
    num: "02",
    title: "Equipe pronta no dia 1",
    text: "Perfis de administrador, operador e consulta, com trilha de auditoria imutável desde o primeiro login.",
    artifact: "roles",
  },
  {
    num: "03",
    title: "Portal público imediato",
    text: "A consulta aberta e a rota até a sepultura entram no ar junto com o sistema.",
    artifact: "route",
  },
  {
    num: "04",
    title: "A cara da sua cidade",
    text: "Subdomínio próprio, logotipo e cores do município. White label de verdade, dados isolados.",
    artifact: "brand",
  },
];

function Artifact({ kind }) {
  if (kind === "import") {
    return (
      <div className={styles.artImport}>
        <div className={styles.artImportHead}>
          <span>legado_sepultados.csv</span>
          <strong>1.232 / 1.240</strong>
        </div>
        <div className={styles.artImportTrack}>
          <div className={styles.artImportFill} />
        </div>
        <span className={styles.artImportNote}>8 linhas rejeitadas para revisão</span>
      </div>
    );
  }
  if (kind === "roles") {
    return (
      <div className={styles.artRoles}>
        <span className={styles.artRoleNavy}>Administrador</span>
        <span className={styles.artRole}>Operador</span>
        <span className={styles.artRole}>Consulta</span>
      </div>
    );
  }
  if (kind === "route") {
    return (
      <div className={styles.artRoute}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M8 14.5s4.8-4.4 4.8-8A4.8 4.8 0 0 0 3.2 6.5c0 3.6 4.8 8 4.8 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          <circle cx="8" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
        </svg>
        Jazigo A-12 · rota de 214 m
      </div>
    );
  }
  return (
    <div className={styles.artBrand}>
      <span className={styles.artSwatches}>
        <i style={{ background: "#032e59" }} />
        <i style={{ background: "#1a7f5c" }} />
        <i style={{ background: "#8c5a2b" }} />
      </span>
      <span className={styles.artUrl}>suacidade.eternizagestao.com.br</span>
    </div>
  );
}

export default function ImpactCards() {
  const sectionRef = useRef(null);
  const wrapRef = useRef(null);
  const trackRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [shift, setShift] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return; // sem transform: o trilho vira scroll horizontal nativo

    const onScroll = () => {
      const section = sectionRef.current;
      const wrap = wrapRef.current;
      const track = trackRef.current;
      if (!section || !wrap || !track) return;

      const rect = section.getBoundingClientRect();
      const runway = section.offsetHeight - window.innerHeight;
      const scrolled = Math.min(Math.max(-rect.top, 0), runway);
      const p = runway > 0 ? scrolled / runway : 0;
      setProgress(p);

      const maxShift = Math.max(track.scrollWidth - wrap.clientWidth, 0);
      setShift(p * maxShift);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const active = Math.min(CARDS.length, Math.max(1, Math.ceil(progress * CARDS.length) || 1));

  return (
    <section ref={sectionRef} className={styles.section}>
      <div className={styles.sticky}>
        {/* frase de impacto — recua sutilmente enquanto os cards passam */}
        <div
          className={styles.headline}
          style={{ opacity: 1 - progress * 0.45, transform: `translateY(${progress * -14}px)` }}
        >
          <h2 className={styles.phrase}>
            Do livro de papel ao mapa vivo,
            <br />
            <em>sem perder uma única história.</em>
          </h2>
        </div>

        {/* trilho de cards dirigido pelo scroll */}
        <div ref={wrapRef} className={styles.trackWrap}>
          <div ref={trackRef} className={styles.track} style={{ transform: `translateX(${-shift}px)` }}>
            {CARDS.map((card) => (
              <article key={card.num} className={styles.card}>
                <span className={styles.cardNum}>{card.num}</span>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardText}>{card.text}</p>
                <div className={styles.cardArtifact}>
                  <Artifact kind={card.artifact} />
                </div>
              </article>
            ))}
          </div>
        </div>

        {/* progresso + contador */}
        <div className={styles.meter}>
          <span className={styles.meterCount}>
            {String(active).padStart(2, "0")}
            <em>/ {String(CARDS.length).padStart(2, "0")}</em>
          </span>
          <div className={styles.meterTrack}>
            <div className={styles.meterFill} style={{ transform: `scaleX(${progress})` }} />
          </div>
        </div>
      </div>
    </section>
  );
}
