import styles from "./Alert.module.css";

const ICONS = {
  info: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M8 7.4v3.4M8 5.2v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  success: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5.4 8.2l1.8 1.8 3.4-3.9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  warning: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 2.2L14.6 13H1.4L8 2.2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 6.4v2.8M8 11v.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  danger: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.4" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 6l4 4M10 6l-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

export default function Alert({ tone = "info", title, children }) {
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role="alert">
      <span className={styles.icon}>{ICONS[tone]}</span>
      <div className={styles.content}>
        {title && <strong className={styles.title}>{title}</strong>}
        {children && <span className={styles.body}>{children}</span>}
      </div>
    </div>
  );
}
