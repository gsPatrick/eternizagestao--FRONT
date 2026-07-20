"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Checkbox from "@/components/atoms/Checkbox/Checkbox";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";
import { normalizeEmail } from "@/lib/masks";
import { api, ApiError } from "@/lib/api/client";
import { setSession } from "@/lib/api/session";
import { getOnboarding } from "@/lib/api/resources/tenant";
import { getClientSubdomain } from "@/lib/tenant-subdomain";

// Sufixo p/ o fluxo de reset: carrega a ORIGEM (admin/família) e a cidade.
// `?t=<slug>` só no modo path (getClientSubdomain lê cookie do subdomínio OU
// `?t=`); no subdomínio o cookie já resolve, então sai só `?origin=`.
function resetSuffix(origin) {
  const slug = getClientSubdomain();
  return slug ? `?t=${slug}&origin=${origin}` : `?origin=${origin}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  // Login ÚNICO POR CIDADE: o mesmo formulário atende ADMIN da cidade
  // (super_admin/admin) E o PORTAL DA FAMÍLIA — sem telas separadas. Tenta primeiro
  // a conta administrativa (POST /sessions); se as credenciais não forem de admin
  // e houver cidade resolvida, cai para o login da família (POST /portal/sessions).
  // Roteia por tipo de conta. No apex (sem cidade) só existe login administrativo.
  async function submitLogin(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const sub = getClientSubdomain();
    // Persiste a cidade num cookie legível no cliente (mesmo formato do
    // middleware de subdomínio). Assim, ao navegar para o PORTAL DA FAMÍLIA (que
    // resolve o tenant por esse cookie / X-Tenant-Subdomain), a cidade não se
    // perde — inclusive no dev, onde não há subdomínio.
    if (sub && typeof document !== "undefined") {
      document.cookie = `eterniza_tenant=${encodeURIComponent(sub)}; path=/; SameSite=Lax`;
    }
    try {
      const result = await api.post(
        "/sessions",
        { email, password },
        sub ? { tenant: sub, auth: false } : { auth: false }
      );
      setSession(result);
      // 1º acesso com senha temporária → força a definição de uma nova senha.
      if (result?.user?.mustChangePassword) {
        router.push("/trocar-senha");
        return;
      }
      if (result?.user?.role === "super_admin") {
        router.push("/admin");
        return;
      }
      // Admin da cidade: no PRIMEIRO acesso (tenant `pendente`) leva ao
      // onboarding; senão vai direto pro painel.
      try {
        const onboarding = await getOnboarding();
        if (onboarding?.onboardingStatus === "pendente") {
          router.push("/onboarding");
          return;
        }
      } catch {
        // sem acesso ao onboarding (papel não-admin) ou erro → segue pro painel
      }
      router.push("/painel");
      return;
    } catch (adminErr) {
      // Não é admin desta cidade → tenta a conta do PORTAL DA FAMÍLIA (mesma
      // cidade). Só faz sentido com cidade resolvida (o portal exige tenant).
      if (sub) {
        try {
          const fam = await api.post(
            "/portal/sessions",
            { email, password },
            { tenant: sub, auth: false }
          );
          setSession(fam);
          router.push("/portal/inicio");
          return;
        } catch {
          /* cai no erro genérico abaixo */
        }
      }
      const message =
        adminErr instanceof ApiError
          ? adminErr.message
          : "Não foi possível entrar. Verifique o e-mail e a senha.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <TenantTheme showSwitcher={false}>
      <main className={styles.screen}>
        <section className={`${styles.visual} ${styles.visualShrunk}`}>
          <AuthVisual />
        </section>

        <section className={`${styles.panel} ${styles.panelExpanded}`}>
          <div className={styles.panelInner}>
            <div className={styles.formView} key="login">
              <div className={styles.formHead}>
                <h2 className={styles.formTitle}>Entrar</h2>
                <p className={styles.formSub}>
                  Acesse a plataforma da sua cidade — administração ou Portal da Família,
                  com o mesmo login.
                </p>
              </div>
              <form className={styles.form} onSubmit={submitLogin}>
                <FormField label="E-mail" htmlFor="login-email" required>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                    required
                  />
                </FormField>
                <FormField label="Senha" htmlFor="login-password" required>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </FormField>
                {error && <Alert tone="danger">{error}</Alert>}
                <div className={styles.formRow}>
                  <Checkbox label="Manter conectado" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                  <button type="button" className={styles.link} onClick={() => router.push(`/esqueci-senha${resetSuffix("admin")}`)}>
                    Esqueci minha senha
                  </button>
                </div>
                <Button type="submit" size="lg" full loading={loading}>
                  Entrar
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </TenantTheme>
  );
}
