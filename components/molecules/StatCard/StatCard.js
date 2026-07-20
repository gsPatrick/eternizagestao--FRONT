import styles from "./StatCard.module.css";

export default function StatCard({ label, value, delta, deltaTone = "success", caption }) {
  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>{value}</span>
      <span className={styles.footer}>
        {delta && (
          <span className={`${styles.delta} ${styles[deltaTone]}`}>
            <svg viewBox="0 0 12 12" fill="none" className={deltaTone === "danger" ? styles.flip : ""}>
              <path d="M6 9.5V2.5M6 2.5L2.8 5.7M6 2.5l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {delta}
          </span>
        )}
        {caption && <span className={styles.caption}>{caption}</span>}
      </span>
    </div>
  );
}
