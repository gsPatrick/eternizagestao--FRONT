"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./PublicHero.module.css";
import { usePublicSuggestions } from "@/src/features/public-search";

/**
 * Hero institucional — mesma experiência do remake Integrated Biosciences:
 * a imagem (emoldurada, com cantos arredondados) abre para tela cheia no
 * primeiro scroll, em sincronia com o header; o conteúdo desliza por cima do
 * fundo fixado.
 * No lugar do CTA de seta, a busca pública: pill escura + blob com seta.
 */

// frases do heading — digita, espera, apaga e escreve a próxima
const PHRASES = [
  "A memória merece\numa gestão à altura.",
  "Encontre quem você ama\nem poucos toques.",
  "Cada história guardada\nno seu devido lugar.",
];

// `imageUrl`: arte própria da CIDADE (config → Identidade). Sem ela, usa a arte
// padrão da plataforma (/media/hero.*) — é o que mantém o portal Eterniza com a
// imagem institucional e permite cada cidade ter a sua.
export default function PublicHero({ variant = "public", tenantSlug = null, imageUrl = null }) {
  // variant "sales" = LP institucional (sem busca, com CTA de venda)
  // variant "public" = página pública do tenant (com busca do cidadão)
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [typed, setTyped] = useState("");
  const [focused, setFocused] = useState(false);
  // fade-in da foto do hero: o placeholder borrado (LQIP no CSS) aparece na hora;
  // a foto real entra com transição quando termina de carregar.
  const [imgLoaded, setImgLoaded] = useState(false);
  const heroImgRef = useRef(null);

  // Se a imagem já veio do cache (onLoad não dispara), marca como carregada.
  useEffect(() => {
    if (heroImgRef.current?.complete) setImgLoaded(true);
  }, []);

  // autocomplete: nomes e códigos de jazigo da base pública (API real)
  const suggestions = usePublicSuggestions(query, { tenant: tenantSlug });

  const showSuggestions = focused && suggestions.length > 0;

  function goTo(value) {
    const t = tenantSlug ? `&t=${tenantSlug}` : "";
    router.push(value.trim() ? `/consulta-publica?q=${encodeURIComponent(value.trim())}${t}` : `/consulta-publica${tenantSlug ? `?t=${tenantSlug}` : ""}`);
  }

  // máquina de escrever: digita → pausa → apaga → próxima frase
  useEffect(() => {
    let phrase = 0;
    let char = 0;
    let deleting = false;
    let timer;

    const tick = () => {
      const full = PHRASES[phrase];
      char += deleting ? -1 : 1;
      setTyped(full.slice(0, char));

      let delay = deleting ? 32 : 64;
      if (!deleting && char === full.length) {
        deleting = true;
        delay = 2800; // frase completa fica no ar
      } else if (deleting && char === 0) {
        deleting = false;
        phrase = (phrase + 1) % PHRASES.length;
        delay = 420;
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 1900); // espera a imagem abrir e o heading entrar
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setExpanded(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  function submitSearch(event) {
    event.preventDefault();
    goTo(query);
  }


  return (
    <section className={styles.experience} id="top">
      {/* fundo fixado: hero + statements rolam por cima dele */}
      <div className={styles.imageBg}>
        <div className={`${styles.frame} ${expanded ? styles.expanded : ""}`}>
          <div className={styles.canvas}>
            <picture>
              {/* WebP otimizado só existe para a arte PADRÃO; imagem da cidade
                  é servida direto do storage (já validada no upload). */}
              {!imageUrl && <source srcSet="/media/hero.webp" type="image/webp" />}
              <img
                ref={heroImgRef}
                src={imageUrl || "/media/hero.jpg"}
                alt=""
                className={`${styles.image} ${imgLoaded ? styles.imageLoaded : ""}`}
                aria-hidden="true"
                fetchPriority="high"
                decoding="async"
                onLoad={() => setImgLoaded(true)}
              />
            </picture>
            <div className={styles.scrim} />
          </div>
        </div>
      </div>

      <div className={styles.overlay}>
        <div className={styles.heroInner}>
          <h1 className={styles.heading} aria-label={PHRASES[0].replace("\n", " ")}>
            {typed.split("\n").map((line, i, arr) => (
              <span key={i}>
                {line}
                {i < arr.length - 1 && <br />}
              </span>
            ))}
            <span className={styles.caret} aria-hidden="true" />
          </h1>

          {variant === "sales" ? (
            <div className={styles.salesCtas}>
              <a
                href="mailto:contato@eternizagestao.com.br?subject=Demonstração%20Eterniza%20Gestão"
                className={styles.ctaSolid}
              >
                Agendar demonstração
              </a>
              <Link href="#plataforma" className={styles.ctaOutline}>
                Ver a plataforma
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </div>
          ) : (
          <div className={styles.bottom}>
            {/* anotação: frase + seta apontando para a busca */}
            <div className={styles.searchHint} aria-hidden="true">
              <span className={styles.hintText}>Pesquise pelos seus entes queridos</span>
              <svg className={styles.hintArrow} viewBox="0 0 96 44" fill="none">
                <path
                  d="M4 6c14 22 42 32 76 22"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="m72 21 10 6-12 5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* busca pública — input nome/CPF + Buscar, com autocomplete */}
            <form className={styles.search} onSubmit={submitSearch} role="search">
              <span className={styles.searchLabel}>
                <input
                  className={styles.searchInput}
                  placeholder="Nome ou CPF do sepultado…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 120)}
                  aria-label="Buscar por nome ou CPF"
                  autoComplete="off"
                />
                <span className={styles.corner} aria-hidden="true">
                  <svg width="22.5" height="60" viewBox="0 0 18 48" fill="none" preserveAspectRatio="none">
                    <path
                      fill="currentColor"
                      d="M0 0h5.63c7.808 0 13.536 7.337 11.642 14.91l-6.09 24.359A11.527 11.527 0 0 1 0 48V0Z"
                    />
                  </svg>
                </span>
              </span>
              <button className={styles.searchIcon} type="submit" aria-label="Buscar">
                <svg className={styles.blob} viewBox="0 0 120 48" fill="none" preserveAspectRatio="none">
                  <path
                    fill="currentColor"
                    d="M6.728 9.09A12 12 0 0 1 18.369 0H108c6.627 0 12 5.373 12 12v24c0 6.627-5.373 12-12 12H12.37C4.561 48-1.167 40.663.727 33.09l6-24Z"
                  />
                </svg>
                <span className={styles.searchBtnLabel}>
                  Buscar
                  <svg className={styles.arrow} width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12h13M13 6l6 6-6 6"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </button>

              {/* autocomplete */}
              {showSuggestions && (
                <ul className={styles.suggestions} role="listbox">
                  {suggestions.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={styles.suggestionRow}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          goTo(s.label);
                        }}
                      >
                        <svg viewBox="0 0 16 16" fill="none" className={styles.suggestionIcon}>
                          <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                          <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span className={styles.suggestionLabel}>{s.label}</span>
                        <span className={styles.suggestionMeta}>{s.meta}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </form>
          </div>
          )}
        </div>

      </div>
    </section>
  );
}
