"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import Avatar from "@/components/atoms/Avatar/Avatar";
import Button from "@/components/atoms/Button/Button";
import { getUser, clearSession } from "@/lib/api/session";

const SignOutIcon = (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M7 15.5H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 12.5 15.5 9 12 5.5M15 9H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);

  useEffect(() => {
    setUser(getUser());
  }, []);

  function signOut() {
    clearSession();
    router.replace("/login");
  }

  const name = user?.name || "Plataforma";
  const email = user?.email || null;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <span className={styles.eyebrow}>Console da plataforma</span>
          <h1 className={styles.title}>Conta</h1>
          <p className={styles.subtitle}>Sua identidade de acesso à plataforma.</p>
        </div>
      </header>

      <section className={styles.card}>
        <div className={styles.identity}>
          <Avatar name={name} size="lg" />
          <div className={styles.identityText}>
            <span className={styles.identityName}>{name}</span>
            {email && <span className={styles.identityEmail}>{email}</span>}
            <span className={styles.identityTag}>Plataforma</span>
          </div>
        </div>

        <div className={styles.divider} />

        <div className={styles.footer}>
          <p className={styles.footerHint}>
            Encerra a sessão neste dispositivo e volta para a tela de acesso.
          </p>
          <Button variant="danger" onClick={signOut} iconLeft={SignOutIcon}>
            Sair
          </Button>
        </div>
      </section>
    </div>
  );
}
