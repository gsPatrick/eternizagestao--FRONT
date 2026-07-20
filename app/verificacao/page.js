"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./page.module.css";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import OtpInput from "@/components/molecules/OtpInput/OtpInput";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";

const RESEND_SECONDS = 30;

function maskEmail(email = "") {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"•".repeat(Math.max(user.length - 2, 2))}@${domain}`;
}

function VerificationFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const email = params.get("email") || "";

  const [step, setStep] = useState("code");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    if (step !== "code" || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  function verifyCode(event) {
    event.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("reset");
    }, 900);
  }

  function resetPassword(event) {
    event.preventDefault();
    if (password.length < 8) {
      setPasswordError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setPasswordError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setStep("done");
    }, 900);
  }

  return (
    <div className={styles.formView}>
      {step === "code" && (
        <>
          <button type="button" className={styles.back} onClick={() => router.push("/esqueci-senha")}>
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Voltar
          </button>

          <div className={styles.iconBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4.5 7l7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className={styles.formHead}>
            <h1 className={styles.formTitle}>Verifique seu e-mail</h1>
            <p className={styles.formSub}>
              Enviamos um código de 6 dígitos para{" "}
              <strong className={styles.emailHighlight}>{email ? maskEmail(email) : "seu e-mail"}</strong>.
            </p>
          </div>

          <form className={styles.form} onSubmit={verifyCode}>
            <OtpInput value={code} onChange={setCode} />
            <Button type="submit" size="lg" full loading={loading} disabled={code.length < 6}>
              Verificar código
            </Button>
          </form>

          <p className={styles.resend}>
            Não recebeu o código?{" "}
            {countdown > 0 ? (
              <span className={styles.resendWait}>Reenviar em {countdown}s</span>
            ) : (
              <button type="button" className={styles.link} onClick={() => setCountdown(RESEND_SECONDS)}>
                Reenviar código
              </button>
            )}
          </p>
        </>
      )}

      {step === "reset" && (
        <>
          <div className={styles.iconBadge} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M14.5 4.5a5 5 0 11-4.9 6.1L4 16.2V19h3l.9-.9v-2h2l1.2-1.2a5 5 0 013.4-10.4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              <circle cx="15.8" cy="8.2" r="1.1" fill="currentColor" />
            </svg>
          </div>

          <div className={styles.formHead}>
            <h1 className={styles.formTitle}>Nova senha</h1>
            <p className={styles.formSub}>Código verificado. Agora defina a sua nova senha de acesso.</p>
          </div>

          <form className={styles.form} onSubmit={resetPassword} noValidate>
            <FormField label="Nova senha" htmlFor="new-password" required hint="Mínimo de 8 caracteres">
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FormField>
            <FormField label="Confirmar nova senha" htmlFor="confirm-password" required error={passwordError}>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••••"
                autoComplete="new-password"
                value={confirm}
                invalid={Boolean(passwordError)}
                onChange={(e) => {
                  setConfirm(e.target.value);
                  if (passwordError) setPasswordError("");
                }}
                required
              />
            </FormField>
            <Button type="submit" size="lg" full loading={loading}>
              Redefinir senha
            </Button>
          </form>
        </>
      )}

      {step === "done" && (
        <>
          <div className={`${styles.iconBadge} ${styles.iconSuccess}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 12.4l2.6 2.6 5.4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div className={styles.formHead}>
            <h1 className={styles.formTitle}>Senha redefinida</h1>
            <p className={styles.formSub}>
              Tudo certo. Sua senha foi alterada com sucesso — use a nova senha
              para entrar na plataforma.
            </p>
          </div>

          <Alert tone="success" title="Conta protegida">
            Todas as sessões anteriores foram encerradas por segurança.
          </Alert>

          <Button size="lg" full onClick={() => router.push("/login")}>
            Ir para o login
          </Button>
        </>
      )}
    </div>
  );
}

export default function VerificationPage() {
  return (
    <TenantTheme>
    <main className={styles.screen}>
      <section className={styles.visual}>
        <AuthVisual />
      </section>
      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <Suspense fallback={null}>
            <VerificationFlow />
          </Suspense>
        </div>
      </section>
    </main>
    </TenantTheme>
  );
}
