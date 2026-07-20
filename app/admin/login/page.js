"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import BrandMark from "@/components/atoms/BrandMark/BrandMark";
import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import { normalizeEmail } from "@/lib/masks";
import { api, ApiError } from "@/lib/api/client";
import { setSession, clearSession, getUser, isAuthed } from "@/lib/api/session";

const ArrowRight = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const LockIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <rect x="3.2" y="7" width="9.6" height="6.4" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
    <path d="M5.4 7V5.2a2.6 2.6 0 015.2 0V7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Já autenticado como super_admin → pula direto pra console.
  useEffect(() => {
    if (isAuthed() && getUser()?.role === "super_admin") router.replace("/admin");
  }, [router]);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // login da PLATAFORMA: sem header de tenant, sem token prévio.
      const result = await api.post(
        "/sessions",
        { email, password },
        { auth: false }
      );
      // guarda de identidade: só super_admin entra na plataforma.
      if (result?.user?.role !== "super_admin") {
        clearSession();
        setError("Acesso restrito à plataforma. Use o login da sua cidade.");
        setLoading(false);
        return;
      }
      setSession(result);
      router.push("/admin");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Não foi possível entrar. Tente novamente.";
      setError(message);
      setLoading(false);
    }
  }

  return (
    <main className={styles.screen}>
      {/* ---------- visual da plataforma (navy, não temado por cidade) ---------- */}
      <section className={styles.visual} aria-hidden="true">
        <div className={styles.visualGlow} />
        <div className={styles.visualGrid} />
        <div className={styles.visualInner}>
          <BrandMark tone="light" size="lg" brand={{ lead: "Eterniza", tail: "Gestão" }} />
          <span className={styles.platformTag}>Plataforma</span>
          <h1 className={styles.visualTitle}>
            Console da plataforma
          </h1>
          <p className={styles.visualLede}>
            Provisione cidades, acompanhe o onboarding e administre a operação
            multi-cidade do Eterniza Gestão em um só lugar.
          </p>
          <ul className={styles.visualList}>
            <li>Cadastro e ativação de cidades</li>
            <li>Convite ao primeiro administrador</li>
            <li>Domínios e marca por cidade</li>
          </ul>
        </div>
        <span className={styles.visualFoot}>Ambiente restrito · acesso monitorado</span>
      </section>

      {/* ---------- formulário ---------- */}
      <section className={styles.panel}>
        <div className={styles.panelInner}>
          <div className={styles.mobileBrand}>
            <BrandMark size="md" brand={{ lead: "Eterniza", tail: "Gestão" }} />
            <span className={styles.platformTagInk}>Plataforma</span>
          </div>

          <div className={styles.head}>
            <span className={styles.eyebrow}>
              <span className={styles.eyebrowIcon}>{LockIcon}</span>
              Acesso da plataforma
            </span>
            <h2 className={styles.title}>Entrar no console</h2>
            <p className={styles.sub}>
              Esta área é exclusiva da equipe da plataforma Eterniza.
            </p>
          </div>

          <form className={styles.form} onSubmit={submit}>
            <FormField label="E-mail" htmlFor="admin-email" required>
              <Input
                id="admin-email"
                type="email"
                placeholder="voce@eterniza.dev"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                required
              />
            </FormField>
            <FormField label="Senha" htmlFor="admin-password" required>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••••"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </FormField>
            {error && <Alert tone="danger">{error}</Alert>}
            <Button type="submit" size="lg" full loading={loading} iconRight={ArrowRight}>
              Entrar
            </Button>
          </form>

          <p className={styles.hint}>
            É administrador de uma cidade? Use o login da sua cidade
            (<code>cidade.eterniza…/login</code>).
          </p>
        </div>
      </section>
    </main>
  );
}
