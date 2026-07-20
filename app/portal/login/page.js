"use client";

import { useEffect, useState } from "react";
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
import { getPublicTenants } from "@/lib/api/resources/public";
import { normalizeApiTenant, resolveTenant } from "@/lib/tenants";
import { getClientSubdomain } from "@/lib/tenant-subdomain";

export default function PortalLoginPage() {
  const router = useRouter();
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [forcedTenant, setForcedTenant] = useState(null);
  const [tenants, setTenants] = useState([]);

  // Resolve o tenant desta tela com PRECEDÊNCIA:
  //   1) ?t=<slug>          → dev/override manual (stand-in do subdomínio no dev)
  //   2) cookie eterniza_tenant → subdomínio em produção (setado pelo middleware)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    const cookieTenant = readTenantCookie();
    const resolved = t || cookieTenant;
    if (resolved) setForcedTenant(resolved);
  }, []);

  // Fonte da verdade das cidades: resolve o SUBDOMÍNIO do tenant selecionado
  // (o header X-Tenant-Subdomain que o login da família precisa enviar).
  useEffect(() => {
    let alive = true;
    getPublicTenants()
      .then((apiTenants) => {
        if (alive && Array.isArray(apiTenants)) setTenants(apiTenants.map(normalizeApiTenant));
      })
      .catch(() => {}); // offline → resolve pelo próprio slug do ?t=
    return () => {
      alive = false;
    };
  }, []);

  // Subdomínio a enviar no header: resolvido do tenant selecionado via lista da
  // API. Nunca envia o id (UUID) — sempre o subdomínio.
  function resolveTenantSubdomain() {
    if (!forcedTenant) return undefined;
    const match = resolveTenant(tenants, forcedTenant);
    return match?.apiSubdomain || forcedTenant;
  }

  // Login da FAMÍLIA: exige tenant (subdomínio/cookie/?t=). O portal tem
  // model/fluxo próprios (`/portal/sessions`).
  async function submitLogin(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.post(
        "/portal/sessions",
        { email, password },
        { tenant: resolveTenantSubdomain(), auth: false }
      );
      setSession(result);
      router.push("/portal/inicio");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <TenantTheme forcedTenantId={forcedTenant} showSwitcher={!forcedTenant}>
      <main className={styles.screen}>
        <section className={`${styles.visual} ${styles.visualShrunk}`}>
          <AuthVisual />
        </section>

        <section className={`${styles.panel} ${styles.panelExpanded}`}>
          <div className={styles.panelInner}>
            <div className={styles.formView} key="portal-login">
              <div className={styles.formHead}>
                <h2 className={styles.formTitle}>Portal da Família</h2>
                <p className={styles.formSub}>
                  Acesse para consultar débitos, emitir 2ª via e acompanhar o
                  histórico dos seus entes queridos.
                </p>
              </div>
              <form className={styles.form} onSubmit={submitLogin}>
                <FormField label="E-mail" htmlFor="portal-email" required>
                  <Input
                    id="portal-email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                    required
                  />
                </FormField>
                <FormField label="Senha" htmlFor="portal-password" required>
                  <Input
                    id="portal-password"
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
                  <button type="button" className={styles.link} onClick={() => router.push(`/esqueci-senha${resetSuffix()}`)}>
                    Esqueci minha senha
                  </button>
                </div>
                <Button type="submit" size="lg" full loading={loading}>
                  Entrar
                </Button>
              </form>
              <p className={styles.switchText}>
                O acesso da família é criado pelo link de convite enviado por
                e-mail pela gestão do cemitério.
              </p>
            </div>
          </div>
        </section>
      </main>
    </TenantTheme>
  );
}

// Sufixo p/ o fluxo de reset da FAMÍLIA: carrega a ORIGEM (portal) e a cidade.
// `?t=<slug>` só no modo path (getClientSubdomain lê cookie do subdomínio OU
// `?t=`); no subdomínio o cookie já resolve, então sai só `?origin=portal`.
function resetSuffix() {
  const slug = getClientSubdomain();
  return slug ? `?t=${slug}&origin=portal` : `?origin=portal`;
}

// Lê o subdomínio da cidade do cookie setado pelo middleware (produção).
// Em dev o cookie não existe (middleware é no-op) → retorna null e o fluxo
// segue pelo ?t=. SSR-safe.
function readTenantCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)eterniza_tenant=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}
