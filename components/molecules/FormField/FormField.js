import styles from "./FormField.module.css";

export default function FormField({ label, hint, error, required = false, children, htmlFor, className = "" }) {
  return (
    <div className={`${styles.field} ${className}`.trim()}>
      {label && (
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
          {required && <span className={styles.required}>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className={styles.error}>{error}</span>
      ) : hint ? (
        <span className={styles.hint}>{hint}</span>
      ) : null}
    </div>
  );
}
