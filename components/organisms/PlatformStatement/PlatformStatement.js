"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import styles from "./PlatformStatement.module.css";

/**
 * Segunda seção (arquétipo Editorial do skill senior-landing-design):
 * um statement gigante em serifa que se revela palavra a palavra conforme o
 * scroll — seguido de uma composição assimétrica: o "mini painel" do produto
 * à esquerda (mapa + cartões flutuantes) e três linhas numeradas à direita.
 * Um acento só (navy), sem grid de ícones.
 */

const STATEMENT =
  "Livros de registro envelhecem, arquivos se perdem. A memória da sua cidade merece morar em um lugar seguro.";

const ROWS = [
  {
    num: "01",
    title: "O mapa que sabe onde cada história está",
    text: "A ortofoto real do cemitério, cova a cova. Quem gere enxerga tudo; quem visita recebe a rota.",
  },
  {
    num: "02",
    title: "Cobranças que se resolvem sozinhas",
    text: "PIX e boleto na hora, baixa automática no minuto do pagamento — e a inadimplência visível antes de virar problema.",
  },
  {
    num: "03",
    title: "Famílias atendidas sem balcão",
    text: "Consulta pública, 2ª via pelo WhatsApp e Portal da Família abertos 24 horas por dia.",
  },
];

export default function PlatformStatement() {
  const words = STATEMENT.split(" ");
  const statementRef = useRef(null);
  const proofRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [proofVisible, setProofVisible] = useState(false);

  // revelação palavra a palavra dirigida pelo scroll
  useEffect(() => {
    const onScroll = () => {
      const el = statementRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 quando o topo do texto está a 88% da tela; 1 quando chega a 38%
      const raw = (vh * 0.88 - rect.top) / (vh * 0.5);
      setProgress(Math.min(Math.max(raw, 0), 1));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // composição entra quando aparece na tela
  useEffect(() => {
    const el = proofRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setProofVisible(true),
      { threshold: 0.25 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const revealed = Math.floor(progress * 1.12 * words.length);

  return (
    <section className={styles.section} id="plataforma">
      <div className={styles.inner}>
        <span className={styles.kicker}>A plataforma</span>

        <p ref={statementRef} className={styles.statement}>
          {words.map((word, i) => (
            <span key={i} className={`${styles.word} ${i < revealed ? styles.wordOn : ""}`}>
              {word}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </p>

        <div ref={proofRef} className={`${styles.proof} ${proofVisible ? styles.proofVisible : ""}`}>
          {/* ---------- composição: o produto em miniatura ---------- */}
          <div className={styles.stage}>
            <div className={styles.mapCard}>
              <svg viewBox="0 0 340 230" className={styles.mapSvg} aria-hidden="true">
                <rect width="340" height="230" rx="16" fill="#e7ebe4" />
                <rect x="0" y="104" width="340" height="20" fill="#f2f3ef" />
                <rect x="160" y="0" width="16" height="230" fill="#f2f3ef" />
                {/* quadra A */}
                <rect x="22" y="18" width="118" height="72" rx="7" fill="#dfe5da" stroke="#cbd3c4" />
                <text x="32" y="34" className={styles.mapLabel}>QUADRA A</text>
                {[0, 1, 2].map((r) =>
                  [0, 1, 2, 3].map((c) => (
                    <rect
                      key={`a${r}${c}`}
                      x={34 + c * 25}
                      y={42 + r * 15}
                      width="18"
                      height="10"
                      rx="2"
                      fill={["#032e59", "#2e9e6b", "#032e59", "#c98a1b"][(r + c) % 4]}
                      opacity="0.92"
                    />
                  ))
                )}
                {/* quadra B */}
                <rect x="196" y="18" width="118" height="72" rx="7" fill="#dfe5da" stroke="#cbd3c4" />
                <text x="206" y="34" className={styles.mapLabel}>QUADRA B</text>
                {[0, 1, 2].map((r) =>
                  [0, 1, 2, 3].map((c) => (
                    <rect
                      key={`b${r}${c}`}
                      x={208 + c * 25}
                      y={42 + r * 15}
                      width="18"
                      height="10"
                      rx="2"
                      fill={["#2e9e6b", "#032e59", "#032e59", "#5b8ac2"][(r + c * 2) % 4]}
                      opacity="0.92"
                    />
                  ))
                )}
                {/* quadras de baixo */}
                <rect x="22" y="140" width="118" height="72" rx="7" fill="#dfe5da" stroke="#cbd3c4" />
                <rect x="196" y="140" width="118" height="72" rx="7" fill="#dfe5da" stroke="#cbd3c4" />
                {/* rota da entrada até o jazigo */}
                <path
                  d="M168 226V114H72v-42"
                  className={styles.mapRoute}
                  fill="none"
                />
                <circle cx="168" cy="222" r="5" fill="#fff" stroke="#032e59" strokeWidth="2" />
                <circle cx="72" cy="68" r="7" fill="#032e59" stroke="#fff" strokeWidth="2.5" />
              </svg>
            </div>

            {/* cartão flutuante: receita */}
            <div className={`${styles.floatCard} ${styles.revenueCard}`}>
              <span className={styles.floatLabel}>Recebido em julho</span>
              <span className={styles.revenueValue}>R$ 48.240</span>
              <div className={styles.revenueBars} aria-hidden="true">
                {[34, 52, 41, 66, 58, 82].map((h, i) => (
                  <span key={i} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>

            {/* bolha WhatsApp */}
            <div className={`${styles.floatCard} ${styles.waCard}`}>
              <p className={styles.waText}>
                Olá, João! A taxa do jazigo <strong>A-12</strong> vence em 21/07.
                2ª via: <span className={styles.waLink}>eterni.za/2via</span>
              </p>
              <span className={styles.waMeta}>
                09:41
                <svg viewBox="0 0 18 12" className={styles.waChecks}>
                  <path d="m1 6 3.5 3.5L11 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="m7 6 3.5 3.5L17 3" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>

            {/* pill: rota traçada */}
            <div className={`${styles.floatCard} ${styles.routePill}`}>
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 14.5s4.8-4.4 4.8-8A4.8 4.8 0 0 0 3.2 6.5c0 3.6 4.8 8 4.8 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <circle cx="8" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
              </svg>
              Jazigo A-12 · rota de 214 m
            </div>
          </div>

          {/* ---------- três linhas numeradas ---------- */}
          <div className={styles.rows}>
            {ROWS.map((row) => (
              <div key={row.num} className={styles.row}>
                <span className={styles.rowNum}>{row.num}</span>
                <div className={styles.rowBody}>
                  <h3 className={styles.rowTitle}>{row.title}</h3>
                  <p className={styles.rowText}>{row.text}</p>
                </div>
              </div>
            ))}
            <Link href="/login" className={styles.rowsCta}>
              Ver a plataforma por dentro
              <svg viewBox="0 0 24 24" fill="none">
                <path d="M5 12h13M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
