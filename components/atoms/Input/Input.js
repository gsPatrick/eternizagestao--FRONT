"use client";

import { useState } from "react";
import styles from "./Input.module.css";

const EyeIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
  </svg>
);

const EyeOffIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M2 2l12 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M6.7 4a6.6 6.6 0 011.3-.4C12 3.6 14.4 8 14.4 8a12 12 0 01-1.8 2.3M9.8 9.8A2 2 0 016.2 6.2M4.5 4.9C2.6 6.2 1.6 8 1.6 8S4 12.4 8 12.4c.9 0 1.7-.2 2.4-.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Input({ invalid = false, iconLeft = null, type = "text", className = "", ...rest }) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const resolvedType = isPassword && revealed ? "text" : type;

  const classes = [
    styles.input,
    invalid ? styles.invalid : "",
    iconLeft ? styles.withIcon : "",
    isPassword ? styles.withTrailing : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={`${styles.wrap} ${className}`}>
      {iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      <input type={resolvedType} className={classes} {...rest} />
      {isPassword && (
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setRevealed((v) => !v)}
          aria-label={revealed ? "Ocultar senha" : "Mostrar senha"}
          tabIndex={-1}
        >
          {revealed ? EyeOffIcon : EyeIcon}
        </button>
      )}
    </span>
  );
}
