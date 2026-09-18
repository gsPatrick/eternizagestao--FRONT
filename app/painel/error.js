"use client";

/**
 * Fronteira de erro do PAINEL.
 *
 * Sem ela, uma exceção de qualquer tela (o caso real: o overlay da ortofoto
 * estourando ao ser removido) derrubava a raiz da árvore React — e, como o menu
 * navega por <Link> sem recarregar a página, TODAS as telas seguintes passavam a
 * mostrar "Application error". Aqui o estrago fica contido nesta tela e o
 * operador volta ao trabalho sem deslogar.
 */

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/atoms/Button/Button";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import styles from "../error-boundary.module.css";

export default function PainelError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[painel] erro não tratado na tela:", error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <ErrorState
          title="Algo deu errado nesta tela"
          message="Ocorreu um erro inesperado. Você pode tentar novamente ou voltar ao painel — seus dados não foram perdidos."
          onRetry={reset}
        />
        <div className={styles.links}>
          <Link href="/painel">
            <Button variant="ghost">Voltar ao painel</Button>
          </Link>
        </div>
        {error?.digest && (
          <p className={styles.detail}>Código do erro: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
