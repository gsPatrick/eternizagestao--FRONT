"use client";

import { useEffect, useState } from "react";
import styles from "./LiveClock.module.css";

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function LiveClock({ suffix }) {
  const [now, setNow] = useState(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) return <span className={styles.clock}>&nbsp;</span>;

  const date = capitalize(
    now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
  );
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  return (
    <span className={styles.clock}>
      {date}
      <span className={styles.sep}>·</span>
      <span className={styles.time}>
        <svg viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 4.2V7l1.9 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {time}
      </span>
      {suffix && (
        <>
          <span className={styles.sep}>·</span>
          {suffix}
        </>
      )}
    </span>
  );
}
