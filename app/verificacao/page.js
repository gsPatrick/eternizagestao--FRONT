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
import { ApiError } from "@/lib/api/client";
import {
  requestPasswordReset,
  verifyPasswordReset,
  confirmPasswordReset,
} from "@/lib/api/resources/sessions";
import { getClientSubdomain } from "@/lib/tenant-subdomain";

const RESEND_SECONDS = 30;

// Traduz o erro da API numa mensagem clara. Mensagens honestas: nada de dizer
// que deu certo quando a API recusou.
function mapResetError(err, fallback) {
  if (!(err instanceof ApiError)) {
    return { tone: "danger", text: "Falha de conexão com o servidor. Tente novamente." };
  }
  if (err.code === "EMAIL_NOT_CONFIGURED" || err.status === 503) {
    return {
      tone: "danger",
      title: "Envio de e-mail indisponível",
      text: "Não foi possível enviar o código porque o provedor de e-mail da plataforma não está configurado. Procure o administrador do sistema para redefinir sua senha.",
    };
  }
  if (err.status === 429) {
    return {
      tone: "warning",
      title: "Muitas tentativas",
      text: err.message || "Aguarde alguns minutos antes de tentar novamente.",
    };
  }
  return { tone: "danger", text: err.message || fallback };
}

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
  // Fluxo SEMPRE separado por CIDADE (`t`) e por ORIGEM (`origin`: admin vs
  // família). `?t=` só existe no modo path; no subdomínio o cookie carrega a
  // cidade. Default de origem ausente = admin (caminho neutro).
  const t = params.get("t") || "";
  const origin = params.get("origin") || "admin";
  const tParam = t ? `?t=${t}` : "";
  // "Voltar" preserva cidade + origem; "Ir para o login" volta pra origem certa.
  const backToForgot = `/esqueci-senha${t ? `?t=${t}&origin=${origin}` : `?origin=${origin}`}`;
  const backToLogin = `${origin === "portal" ? "/portal/login" : "/login"}${tParam}`;

  const [step, setStep] = useState("code");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordError, setPasswordError] = useState("");
  // Erro da API mostrado em Alert (código inválido/expirado, rate limit, e-mail
  // não configurado). Separado do erro inline do campo de senha.
  const [apiError, setApiError] = useState(null);
  // Cidade: `?t=` (modo path) ou cookie de subdomínio — mesma resolução do login.
  const tenant = t || getClientSubdomain();

  useEffect(() => {
    if (step !== "code" || countdown <= 0) return;
    const timer = setInterval(() => setCountdown((v) => v - 1), 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Confere o código na API antes de pedir a nova senha. 400 = inválido/expirado
  // e o usuário PERMANECE nesta etapa.
  async function verifyCode(event) {
    event.preventDefault();
    // Acesso direto à URL sem `?email=` — não há o que verificar.
    if (!email) {
      setApiError({
        tone: "danger",
        text: "Não sabemos para qual e-mail o código foi enviado. Recomece pela tela “Esqueceu a senha?”.",
      });
      return;
    }
    setApiError(null);
    setLoading(true);
    try {
      await verifyPasswordReset({ email, code, tenant });
      setStep("reset");
    } catch (err) {
      setApiError(mapResetError(err, "Código inválido ou expirado. Peça um novo código."));
    } finally {
      setLoading(false);
    }
  }

  // Efetiva a troca de senha na API. Só mostramos "senha redefinida" depois do
  // 204 — antes disso nada foi salvo.
  async function resetPassword(event) {
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
    setApiError(null);
    setLoading(true);
    try {
      await confirmPasswordReset({ email, code, password, tenant });
      setStep("done");
    } catch (err) {
      const mapped = mapResetError(err, "Não foi possível redefinir a senha. Tente novamente.");
      if (err instanceof ApiError && err.code === "WEAK_PASSWORD") {
        // Problema é a senha: erro inline, sem perder a etapa.
        setPasswordError(err.message || "Escolha uma senha mais forte.");
      } else if (err instanceof ApiError && err.status === 400) {
        // Código expirou/foi usado entre a verificação e a confirmação —
        // devolve o usuário à etapa do código com a explicação.
        setCode("");
        setStep("code");
        setApiError(mapped);
      } else {
        setApiError(mapped);
      }
    } finally {
      setLoading(false);
    }
  }

  // Reenvia o código de verdade (mesmo endpoint do "esqueci a senha"). O
  // contador só reinicia se a API aceitou o pedido.
  async function resendCode() {
    if (!email) return;
    setApiError(null);
    setLoading(true);
    try {
      await requestPasswordReset({ email, origin, tenant });
      setCode("");
      setCountdown(RESEND_SECONDS);
    } catch (err) {
      setApiError(mapResetError(err, "Não foi possível reenviar o código. Tente novamente."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.formView}>
      {step === "code" && (
        <>
          <button type="button" className={styles.back} onClick={() => router.push(backToForgot)}>
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
            <OtpInput
              value={code}
              invalid={Boolean(apiError)}
              onChange={(v) => {
                setCode(v);
                if (apiError) setApiError(null);
              }}
            />
            <Button type="submit" size="lg" full loading={loading} disabled={code.length < 6}>
              Verificar código
            </Button>
          </form>

          {apiError && (
            <Alert tone={apiError.tone} title={apiError.title}>
              {apiError.text}
            </Alert>
          )}

          <p className={styles.resend}>
            Não recebeu o código?{" "}
            {countdown > 0 ? (
              <span className={styles.resendWait}>Reenviar em {countdown}s</span>
            ) : (
              <button type="button" className={styles.link} onClick={resendCode} disabled={loading}>
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

          {apiError && (
            <Alert tone={apiError.tone} title={apiError.title}>
              {apiError.text}
            </Alert>
          )}
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

          {/* Só afirmamos o que o backend garante no contrato: o código é de uso
              único e já foi invalidado. */}
          <Alert tone="success" title="Conta protegida">
            O código utilizado foi invalidado e não pode ser usado novamente.
          </Alert>

          <Button size="lg" full onClick={() => router.push(backToLogin)}>
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
