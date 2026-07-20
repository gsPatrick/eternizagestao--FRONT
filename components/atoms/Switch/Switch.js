"use client";

import styles from "./Switch.module.css";

export default function Switch({ label, checked, onChange, disabled = false, ...rest }) {
  return (
    <label className={`${styles.wrap} ${disabled ? styles.disabled : ""}`}>
      <input
        type="checkbox"
        role="switch"
        className={styles.native}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}
