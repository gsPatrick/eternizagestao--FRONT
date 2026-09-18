"use client";

/**
 * Última linha de defesa: erro no PRÓPRIO layout raiz.
 *
 * O Next substitui o documento inteiro por este componente, então ele precisa
 * renderizar <html>/<body> e não pode depender de nada do layout (nem dos
 * tokens do tema) — por isso o visual aqui é autossuficiente.
 */

import { useEffect } from "react";
import styles from "./error-boundary.module.css";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[app] erro não tratado no layout raiz:", error);
  }, [error]);

  return (
    <html lang="pt-BR">
      <body className={styles.rootFallback}>
        <div className={styles.card} role="alert">
          <h1 className={styles.cardTitle}>Algo deu errado</h1>
          <p className={styles.cardText}>
            Não foi possível continuar por causa de um erro inesperado. Tente
            novamente; se o problema persistir, recarregue a página.
          </p>
          <div className={styles.links}>
            <button type="button" className={styles.btn} onClick={() => reset()}>
              Tentar novamente
            </button>
            <a className={`${styles.btn} ${styles.btnGhost}`} href="/painel">
              Ir para o painel
            </a>
          </div>
          {error?.digest && (
            <p className={styles.detail}>Código do erro: {error.digest}</p>
          )}
        </div>
      </body>
    </html>
  );
}
