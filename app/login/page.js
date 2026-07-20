"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";

import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Checkbox from "@/components/atoms/Checkbox/Checkbox";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";
import { maskCpf, normalizeEmail } from "@/lib/masks";
import { api, ApiError } from "@/lib/api/client";
import { setSession, clearSession } from "@/lib/api/session";
import { getPublicTenants } from "@/lib/api/resources/public";
import { getOnboarding } from "@/lib/api/resources/tenant";
import { normalizeApiTenant, resolveTenant } from "@/lib/tenants";

const ArrowRight = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState("gate");
  const [audience, setAudience] = useState("admin"); // admin → painel · family → portal
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState(null);
  const [regEmail, setRegEmail] = useState("");
  const [regCpf, setRegCpf] = useState("");
  const [forcedTenant, setForcedTenant] = useState(null);
  const [tenants, setTenants] = useState([]); // lista da API para resolver o subdomínio

  // Resolve o tenant desta tela com PRECEDÊNCIA:
  //   1) ?t=<slug>          → dev/override manual (stand-in do subdomínio no dev)
  //   2) cookie eterniza_tenant → subdomínio em produção (setado pelo middleware)
  //   3) default            → sem forçar (seletor de demo / navy padrão)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("t");
    const cookieTenant = readTenantCookie();
    const resolved = t || cookieTenant;
    if (resolved) setForcedTenant(resolved);
  }, []);

  // Fonte da verdade das cidades: usada para resolver o SUBDOMÍNIO do tenant
  // selecionado (o header X-Tenant-Subdomain que o login precisa enviar).
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

  // Subdomínio a enviar no header: resolvido do tenant selecionado (?t=) via
  // lista da API. Sem tenant selecionado → undefined (comportamento atual).
  // Nunca envia o id (UUID) — sempre o subdomínio.
  function resolveTenantSubdomain() {
    if (!forcedTenant) return undefined;
    const match = resolveTenant(tenants, forcedTenant);
    return match?.apiSubdomain || forcedTenant;
  }

  const expanded = view !== "gate";

  // login e portal compartilham a mesma tela; o destino vem do público escolhido
  async function submitLogin(event) {
    event.preventDefault();
    setLoginError(null);
    setLoading(true);
    try {
      const isFamily = audience === "family";
      // admin → /sessions (tenant opcional) · família → /portal/sessions (tenant obrigatório)
      const path = isFamily ? "/portal/sessions" : "/sessions";
      // header X-Tenant-Subdomain = SUBDOMÍNIO do tenant (não o id)
      const result = await api.post(
        path,
        { email: loginEmail, password: loginPassword },
        { tenant: resolveTenantSubdomain(), auth: false }
      );
      // super_admin não entra pela cidade — a plataforma tem login próprio.
      if (!isFamily && result?.user?.role === "super_admin") {
        clearSession();
        setLoginError("Esta conta é da plataforma. Acesse pelo login da plataforma (/admin/login).");
        setLoading(false);
        return;
      }
      setSession(result);
      if (isFamily) {
        router.push("/portal/inicio");
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
      setLoginError(message);
      setLoading(false);
    }
  }

  function submitRegister(event) {
    event.preventDefault();
    setLoading(true);
    setTimeout(() => router.push("/portal/inicio"), 1000);
  }

  return (
    <TenantTheme forcedTenantId={forcedTenant} showSwitcher={!forcedTenant}>
    <main className={styles.screen}>
      <section className={`${styles.visual} ${expanded ? styles.visualShrunk : ""}`}>
        <AuthVisual />
      </section>

      <section className={`${styles.panel} ${expanded ? styles.panelExpanded : ""}`}>
        <div className={styles.panelInner}>
          {view === "gate" && (
            <div className={styles.gate} key="gate">
              <BrandMark size="lg" />
              <div className={styles.gateText}>
                <h2 className={styles.gateTitle}>Bem-vindo</h2>
                <p className={styles.gateSub}>Como você deseja continuar?</p>
              </div>
              <div className={styles.gateActions}>
                <Button size="lg" full iconRight={ArrowRight} onClick={() => setView("login")}>
                  Entrar na minha conta
                </Button>
                <Button size="lg" full variant="secondary" onClick={() => setView("register")}>
                  Criar conta
                </Button>
              </div>
              <p className={styles.gateHint}>
                O acesso administrativo é fornecido pela gestão do cemitério.
                A criação de conta é destinada a familiares e responsáveis.
              </p>
            </div>
          )}

          {view === "login" && (
            <div className={styles.formView} key="login">
              <BackButton onClick={() => setView("gate")} />
              <div className={styles.formHead}>
                <h2 className={styles.formTitle}>Entrar</h2>
                <p className={styles.formSub}>Acesse sua conta para continuar.</p>
              </div>
              <div className={styles.segment} role="tablist" aria-label="Tipo de acesso">
                <button
                  type="button"
                  role="tab"
                  aria-selected={audience === "admin"}
                  className={`${styles.segmentBtn} ${audience === "admin" ? styles.segmentActive : ""}`}
                  onClick={() => setAudience("admin")}
                >
                  Administração
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={audience === "family"}
                  className={`${styles.segmentBtn} ${audience === "family" ? styles.segmentActive : ""}`}
                  onClick={() => setAudience("family")}
                >
                  Portal da Família
                </button>
              </div>
              <form className={styles.form} onSubmit={submitLogin}>
                <FormField label="E-mail" htmlFor="login-email" required>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(normalizeEmail(e.target.value))}
                    required
                  />
                </FormField>
                <FormField label="Senha" htmlFor="login-password" required>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </FormField>
                {loginError && <Alert tone="danger">{loginError}</Alert>}
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
              <p className={styles.switchText}>
                Ainda não tem conta?{" "}
                <button type="button" className={styles.link} onClick={() => setView("register")}>
                  Criar conta
                </button>
              </p>
            </div>
          )}

          {view === "register" && (
            <div className={styles.formView} key="register">
              <BackButton onClick={() => setView("gate")} />
              <div className={styles.formHead}>
                <h2 className={styles.formTitle}>Criar conta</h2>
                <p className={styles.formSub}>
                  Portal da Família — consulte débitos, emita 2ª via e acompanhe
                  o histórico dos seus entes queridos.
                </p>
              </div>
              <form className={styles.form} onSubmit={submitRegister}>
                <FormField label="CPF" htmlFor="reg-cpf" required hint="O CPF deve estar no cadastro do cemitério">
                  <Input
                    id="reg-cpf"
                    placeholder="000.000.000-00"
                    inputMode="numeric"
                    value={regCpf}
                    onChange={(e) => setRegCpf(maskCpf(e.target.value))}
                    required
                  />
                </FormField>
                <FormField label="E-mail" htmlFor="reg-email" required>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(normalizeEmail(e.target.value))}
                    required
                  />
                </FormField>
                <Alert tone="info">
                  Enviaremos um link de ativação para o seu e-mail após a verificação dos dados.
                </Alert>
                <Button type="submit" size="lg" full loading={loading}>
                  Solicitar acesso
                </Button>
              </form>
              <p className={styles.switchText}>
                Já tem conta?{" "}
                <button type="button" className={styles.link} onClick={() => setView("login")}>
                  Entrar
                </button>
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
    </TenantTheme>
  );
}

// Lê o subdomínio da cidade do cookie setado pelo middleware (produção).
// Em dev o cookie não existe (middleware é no-op) → retorna null e o fluxo
// segue pelo ?t=. SSR-safe.
function readTenantCookie() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)eterniza_tenant=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function BackButton({ onClick }) {
  return (
    <button type="button" className={styles.back} onClick={onClick}>
      <svg viewBox="0 0 16 16" fill="none">
        <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      Voltar
    </button>
  );
}
