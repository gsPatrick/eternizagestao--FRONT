"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./SearchBand.module.css";
import { usePublicSuggestions } from "@/src/features/public-search";

/**
 * Terceira seção — consulta pública: frase em máquina de escrever (digita,
 * espera, apaga — igual ao hero) convidando à busca, e a barra centralizada.
 * Fundo idêntico ao visual do login/gate (gradiente navy + anéis + glow).
 */

// "Encontre" nunca apaga: mostra "Encontre..." → apaga os pontos →
// completa a frase → apaga só o final → volta aos pontos → próxima.
const PREFIX = "Encontre";
const DOTS = "...";
const TAILS = [
  " o jazigo de quem você ama.",
  " a rota exata até a visita.",
  " uma história a partir de um nome.",
];

const STEPS = [
  { num: "01", title: "Busque pelo nome" },
  { num: "02", title: "Veja onde está" },
  { num: "03", title: "Siga a rota até lá" },
];

export default function SearchBand({ tenantSlug = null }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  // autocomplete: mesmos dados públicos da busca do hero (API real)
  const suggestions = usePublicSuggestions(query, { tenant: tenantSlug });

  const showSuggestions = focused && suggestions.length > 0;

  function goTo(value) {
    const t = tenantSlug ? `&t=${tenantSlug}` : "";
    router.push(value.trim() ? `/consulta-publica?q=${encodeURIComponent(value.trim())}${t}` : `/consulta-publica${tenantSlug ? `?t=${tenantSlug}` : ""}`);
  }

  useEffect(() => {
    let tail = 0;
    let pos = 0;
    let mode = "dots-typing";
    let timer;

    const tick = () => {
      let delay = 60;
      if (mode === "dots-typing") {
        pos += 1;
        setTyped(DOTS.slice(0, pos));
        delay = 220;
        if (pos === DOTS.length) {
          mode = "dots-del";
          delay = 1200; // "Encontre..." fica no ar
        }
      } else if (mode === "dots-del") {
        pos -= 1;
        setTyped(DOTS.slice(0, pos));
        delay = 110;
        if (pos === 0) mode = "tail-typing";
      } else if (mode === "tail-typing") {
        pos += 1;
        setTyped(TAILS[tail].slice(0, pos));
        delay = 56;
        if (pos === TAILS[tail].length) {
          mode = "tail-del";
          delay = 2700; // frase completa fica no ar
        }
      } else {
        pos -= 1;
        setTyped(TAILS[tail].slice(0, pos));
        delay = 26;
        if (pos === 0) {
          tail = (tail + 1) % TAILS.length;
          mode = "dots-typing";
          delay = 320;
        }
      }
      timer = setTimeout(tick, delay);
    };

    timer = setTimeout(tick, 500);
    return () => clearTimeout(timer);
  }, []);

  function submit(event) {
    event.preventDefault();
    goTo(query);
  }

  return (
    <section className={styles.section} id="consulta">
      {/* mesmos adornos do visual de login/gate */}
      <span className={styles.rings} aria-hidden="true" />
      <span className={styles.glow} aria-hidden="true" />

      <div className={styles.inner}>
        {/* frase em máquina de escrever — prefixo fixo + final que troca */}
        <h2 className={styles.phrase} aria-label={`${PREFIX}${TAILS[0]}`}>
          {PREFIX}
          <span className={styles.phraseTail}>{typed}</span>
          <span className={styles.caret} aria-hidden="true" />
        </h2>

        <form className={styles.searchBar} onSubmit={submit} role="search">
          <svg viewBox="0 0 16 16" fill="none" className={styles.searchIcon}>
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            className={styles.input}
            placeholder="Nome, CPF ou número do jazigo…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            aria-label="Buscar sepultado"
            autoComplete="off"
          />
          <button className={styles.button} type="submit">
            Buscar
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* autocomplete em drop-up, como na busca do hero */}
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

        <p className={styles.hint}>Consulta aberta e gratuita · a localização exata aparece no mapa, com a rota desde o portão</p>

        {/* a jornada em 3 passos + o pin do destino (da versão anterior) */}
        <div className={styles.steps}>
          {STEPS.map((step) => (
            <div key={step.num} className={styles.stepGroup}>
              <div className={styles.stepItem}>
                <span className={styles.stepMarker}>
                  <span className={styles.stepNum}>{step.num}</span>
                </span>
                <span className={styles.stepTitle}>{step.title}</span>
              </div>
              <span className={styles.stepDash} aria-hidden="true" />
            </div>
          ))}
          <div className={styles.stepItem}>
            <span className={`${styles.stepMarker} ${styles.pinMarker}`}>
              <span className={styles.pinPulse} aria-hidden="true" />
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 14.5s4.8-4.4 4.8-8A4.8 4.8 0 0 0 3.2 6.5c0 3.6 4.8 8 4.8 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="8" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            </span>
            <span className={styles.stepTitle}>Jazigo A-12 · a 214 m do portão</span>
          </div>
        </div>
      </div>
    </section>
  );
}
