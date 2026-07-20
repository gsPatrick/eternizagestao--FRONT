"use client";

import styles from "./Checkbox.module.css";

export default function Checkbox({ label, checked, onChange, disabled = false, ...rest }) {
  return (
    <label className={`${styles.wrap} ${disabled ? styles.disabled : ""}`}>
      <input
        type="checkbox"
        className={styles.native}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
      <span className={styles.box} aria-hidden="true">
        <svg viewBox="0 0 12 12" fill="none">
          <path d="M2.5 6.2L5 8.7l4.5-5.4" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
