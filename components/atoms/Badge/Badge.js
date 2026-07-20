import styles from "./Badge.module.css";

export default function Badge({ children, tone = "navy", dot = false }) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  );
}
