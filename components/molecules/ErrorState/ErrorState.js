import styles from "./ErrorState.module.css";
import Button from "@/components/atoms/Button/Button";

/**
 * Estado de erro amigável com ação de recuperação. Ligue `onRetry` ao
 * `refetch` do useResource.
 *
 * @param {string} [title='Não foi possível carregar']
 * @param {string} [message]  se omitido, mostra uma frase padrão
 * @param {() => void} [onRetry]
 */
export default function ErrorState({
  title = "Não foi possível carregar",
  message = "Ocorreu um erro ao buscar as informações. Verifique sua conexão e tente novamente.",
  onRetry,
}) {
  return (
    <div className={styles.wrap} role="alert">
      <div className={styles.emblem} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path d="M12 7.5v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M12 16h.01" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </div>
      {title && <h3 className={styles.title}>{title}</h3>}
      {message && <p className={styles.message}>{message}</p>}
      {onRetry && (
        <div className={styles.action}>
          <Button variant="secondary" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      )}
    </div>
  );
}
