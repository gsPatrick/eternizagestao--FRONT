"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";
import { normalizeEmail, isValidEmail } from "@/lib/masks";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // O fluxo de reset é SEMPRE separado por CIDADE (`t`) e por ORIGEM (`origin`:
  // admin da cidade vs família). Lemos ambos da URL e propagamos adiante.
  // `?t=` só existe no modo path; no subdomínio o cookie carrega a cidade.
  const [reset] = useState(() => {
    if (typeof window === "undefined") return { t: "", origin: "admin" };
    const p = new URLSearchParams(window.location.search);
    return { t: p.get("t") || "", origin: p.get("origin") || "admin" };
  });
  // Volta pro login da ORIGEM certa (portal → família; senão → admin da cidade).
  const loginPath = reset.origin === "portal" ? "/portal/login" : "/login";
  const backToLogin = `${loginPath}${reset.t ? `?t=${reset.t}` : ""}`;

  function handleSubmit(event) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      const t = reset.t ? `&t=${reset.t}` : "";
      router.push(`/verificacao?email=${encodeURIComponent(email)}${t}&origin=${reset.origin}`);
    }, 900);
  }

  return (
    <TenantTheme>
    <main className={styles.screen}>
      <section className={styles.visual}>
        <AuthVisual intro={false} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.formView}>
            <button type="button" className={styles.back} onClick={() => router.push(backToLogin)}>
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Voltar ao login
            </button>

            <div className={styles.iconBadge} aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <rect x="4" y="9.5" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M8 9.5V7a4 4 0 018 0v2.5" stroke="currentColor" strokeWidth="1.6" />
                <circle cx="12" cy="15" r="1.6" fill="currentColor" />
              </svg>
            </div>

            <div className={styles.formHead}>
              <h1 className={styles.formTitle}>Esqueceu a senha?</h1>
              <p className={styles.formSub}>
                Sem problema. Informe o e-mail da sua conta e enviaremos um
                código de verificação de 6 dígitos.
              </p>
            </div>

            <form className={styles.form} onSubmit={handleSubmit} noValidate>
              <FormField label="E-mail" htmlFor="forgot-email" required error={error}>
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="voce@exemplo.com"
                  autoComplete="email"
                  value={email}
                  invalid={Boolean(error)}
                  onChange={(e) => {
                    setEmail(normalizeEmail(e.target.value));
                    if (error) setError("");
                  }}
                  required
                />
              </FormField>
              <Button type="submit" size="lg" full loading={loading}>
                Enviar código
              </Button>
            </form>

            <Alert tone="info">
              Por segurança, o código expira em 10 minutos e só pode ser usado uma vez.
            </Alert>
          </div>
        </div>
      </section>
    </main>
    </TenantTheme>
  );
}
