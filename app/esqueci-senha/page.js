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
import { ApiError } from "@/lib/api/client";
import { requestPasswordReset } from "@/lib/api/resources/sessions";
import { getClientSubdomain } from "@/lib/tenant-subdomain";

// Traduz o erro da API numa mensagem HONESTA para o usuário. Nunca fingimos que
// o código foi enviado: se o provedor de e-mail não está configurado, dizemos.
function mapRequestError(err) {
  if (!(err instanceof ApiError)) {
    return { tone: "danger", text: "Não foi possível enviar o código. Verifique sua conexão e tente novamente." };
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
      text: err.message || "Você pediu códigos demais em pouco tempo. Aguarde alguns minutos antes de tentar de novo.",
    };
  }
  return { tone: "danger", text: err.message || "Não foi possível enviar o código. Tente novamente." };
}

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  // Erro vindo da API (503/429/etc.) — mostrado em Alert, separado do erro de
  // validação do campo (`error`), que é inline no FormField.
  const [apiError, setApiError] = useState(null);
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

  // Pede o código à API DE VERDADE. Só avança para /verificacao se o backend
  // aceitou o pedido (202) — se o e-mail não pôde ser enviado, o usuário fica
  // aqui com a explicação, em vez de esperar um código que nunca chega.
  async function handleSubmit(event) {
    event.preventDefault();
    if (!isValidEmail(email)) {
      setError("Informe um e-mail válido.");
      return;
    }
    setError("");
    setApiError(null);
    setLoading(true);
    try {
      // A cidade vem do `?t=` (modo path) ou do cookie de subdomínio.
      await requestPasswordReset({
        email,
        origin: reset.origin,
        tenant: reset.t || getClientSubdomain(),
      });
      const t = reset.t ? `&t=${reset.t}` : "";
      router.push(`/verificacao?email=${encodeURIComponent(email)}${t}&origin=${reset.origin}`);
    } catch (err) {
      setApiError(mapRequestError(err));
      setLoading(false);
    }
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
                    if (apiError) setApiError(null);
                  }}
                  required
                />
              </FormField>
              <Button type="submit" size="lg" full loading={loading}>
                Enviar código
              </Button>
            </form>

            {apiError && (
              <Alert tone={apiError.tone} title={apiError.title}>
                {apiError.text}
              </Alert>
            )}

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
