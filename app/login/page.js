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

export default function LoginPage() {
  const router = useRouter();
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);

  // Login ADMINISTRATIVO: super_admin (dono do sistema) e admin de cada cidade
  // entram por aqui. Em `cidade.dominio/login` (subdomínio de cidade, via cookie
  // do middleware ou `?t=` no dev) o login é ESCOPADO àquela cidade — passamos o
  // subdomínio como tenant. No apex (sem subdomínio) segue o login GLOBAL, sem
  // tenant. Redireciona por papel.
  async function submitLogin(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const sub = getClientSubdomain();
      const result = await api.post(
        "/sessions",
        { email, password },
        sub ? { tenant: sub, auth: false } : { auth: false }
      );
      setSession(result);
      if (result?.user?.role === "super_admin") {
        router.push("/admin");
        return;
      }
      // Admin da cidade: no PRIMEIRO acesso (tenant `pendente`) leva ao
      // onboarding; senão vai direto pro painel. O status não vem no login,
      // então consultamos com o token recém-salvo. Falha/403 → painel.
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
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.";
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
                <p className={styles.formSub}>Acesse o painel administrativo para continuar.</p>
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
                  <button type="button" className={styles.link} onClick={() => router.push("/esqueci-senha")}>
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
