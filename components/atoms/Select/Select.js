import styles from "./Select.module.css";

export default function Select({ children, invalid = false, ...rest }) {
  return (
    <span className={styles.wrap}>
      <select className={`${styles.select} ${invalid ? styles.invalid : ""}`} {...rest}>
        {children}
      </select>
      <svg className={styles.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
