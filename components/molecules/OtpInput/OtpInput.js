"use client";

import { useRef } from "react";
import styles from "./OtpInput.module.css";

export default function OtpInput({ length = 6, value = "", onChange, invalid = false }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] || "");

  function commit(next) {
    onChange(next.join("").slice(0, length));
  }

  function handleChange(index, raw) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) return;
    const next = [...digits];
    clean.split("").slice(0, length - index).forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    commit(next);
    const target = Math.min(index + clean.length, length - 1);
    refs.current[target]?.focus();
  }

  function handleKeyDown(index, event) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = [...digits];
      if (next[index]) {
        next[index] = "";
        commit(next);
      } else if (index > 0) {
        next[index - 1] = "";
        commit(next);
        refs.current[index - 1]?.focus();
      }
    }
    if (event.key === "ArrowLeft" && index > 0) refs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < length - 1) refs.current[index + 1]?.focus();
  }

  function handlePaste(event) {
    event.preventDefault();
    const clean = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (clean) {
      onChange(clean);
      refs.current[Math.min(clean.length, length - 1)]?.focus();
    }
  }

  return (
    <div className={styles.group} onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => (refs.current[index] = el)}
          className={`${styles.box} ${digit ? styles.filled : ""} ${invalid ? styles.invalid : ""}`}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onFocus={(e) => e.target.select()}
          aria-label={`Dígito ${index + 1}`}
        />
      ))}
    </div>
  );
}
