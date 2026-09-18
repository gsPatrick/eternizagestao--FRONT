"use client";

/** Fronteira de erro do console da PLATAFORMA (super_admin). */

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/atoms/Button/Button";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import styles from "../error-boundary.module.css";

export default function AdminError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[admin] erro não tratado na tela:", error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <ErrorState
          title="Algo deu errado nesta tela"
          message="Ocorreu um erro inesperado. Tente novamente ou volte ao console da plataforma."
          onRetry={reset}
        />
        <div className={styles.links}>
          <Link href="/admin">
            <Button variant="ghost">Voltar ao console</Button>
          </Link>
        </div>
        {error?.digest && (
          <p className={styles.detail}>Código do erro: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
