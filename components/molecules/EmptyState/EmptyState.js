import styles from "./EmptyState.module.css";

/**
 * Estado vazio premium — emblema discreto, título (Fraunces), mensagem suave
 * (Inter) e ação opcional. Nunca deixe um branco solto: use sempre uma frase
 * da identidade Eterniza.
 *
 * @param {React.ReactNode} [icon]     ícone/emblema (default ◎)
 * @param {string} title
 * @param {string} [message]
 * @param {React.ReactNode} [action]   normalmente um <Button/>
 */
export default function EmptyState({ icon, title, message, action }) {
  return (
    <div className={styles.wrap} role="status">
      <div className={styles.emblem} aria-hidden="true">
        {icon || <span className={styles.mark}>◎</span>}
      </div>
      {title && <h3 className={styles.title}>{title}</h3>}
      {message && <p className={styles.message}>{message}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
