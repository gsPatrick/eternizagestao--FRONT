"use client";

/** Fronteira de erro do PORTAL do titular (mesma proteção do painel). */

import { useEffect } from "react";
import Link from "next/link";
import Button from "@/components/atoms/Button/Button";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import styles from "../error-boundary.module.css";

export default function PortalError({ error, reset }) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("[portal] erro não tratado na tela:", error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <ErrorState
          title="Algo deu errado nesta página"
          message="Ocorreu um erro inesperado. Tente novamente ou volte ao início do portal."
          onRetry={reset}
        />
        <div className={styles.links}>
          <Link href="/portal/inicio">
            <Button variant="ghost">Voltar ao início</Button>
          </Link>
        </div>
        {error?.digest && (
          <p className={styles.detail}>Código do erro: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
