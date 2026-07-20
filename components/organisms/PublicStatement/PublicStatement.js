"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./PublicStatement.module.css";

/**
 * Seção editorial de fundo claro (branco/bone) com uma frase que se revela
 * palavra a palavra conforme o scroll — o "respiro" da página pública do tenant.
 * `tone`: "white" | "bone". `kicker` opcional.
 */
export default function PublicStatement({ phrase, kicker, tone = "white", highlight }) {
  const words = phrase.split(" ");
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const raw = (vh * 0.85 - rect.top) / (vh * 0.5);
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

  const revealed = Math.floor(progress * 1.12 * words.length);

  return (
    <section className={`${styles.section} ${tone === "bone" ? styles.bone : styles.white}`}>
      <div className={styles.inner}>
        {kicker && <span className={styles.kicker}>{kicker}</span>}
        <p ref={ref} className={styles.statement}>
          {words.map((word, i) => {
            const isHighlight = highlight && highlight.includes(word.replace(/[.,]/g, ""));
            return (
              <span
                key={i}
                className={`${styles.word} ${i < revealed ? styles.wordOn : ""} ${isHighlight ? styles.wordHi : ""}`}
              >
                {word}
                {i < words.length - 1 ? " " : ""}
              </span>
            );
          })}
        </p>
      </div>
    </section>
  );
}
