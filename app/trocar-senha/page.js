"use client";

/**
 * Definição de senha no PRIMEIRO ACESSO (senha temporária do convite).
 * O usuário chega aqui logo após logar com a senha temporária (o login detecta
 * user.mustChangePassword). Define a nova senha e segue para o destino por papel.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../login/page.module.css";
import TenantTheme from "@/components/providers/TenantTheme/TenantTheme";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import AuthVisual from "@/components/organisms/AuthVisual/AuthVisual";
import { api, ApiError } from "@/lib/api/client";
import { getUser } from "@/lib/api/session";
import { changeMyPassword } from "@/lib/api/resources/me";
import { getOnboarding } from "@/lib/api/resources/tenant";

export default function TrocarSenhaPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setError(null);
    if (senha.length < 6) {
      setError("A nova senha deve ter ao menos 6 caracteres.");
      return;
    }
    if (senha !== confirma) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await changeMyPassword({ newPassword: senha });
      // segue para o destino por papel/onboarding
      const user = getUser();
      if (user?.role === "super_admin") {
        router.push("/admin");
        return;
      }
      try {
        const onboarding = await getOnboarding();
        if (onboarding?.onboardingStatus === "pendente") {
          router.push("/onboarding");
          return;
        }
      } catch {
        /* segue pro painel */
      }
      router.push("/painel");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar a senha.");
      setLoading(false);
    }
  }

  return (
    <TenantTheme showSwitcher={false}>
      <main className={styles.screen}>
        <section className={`${styles.visual} ${styles.visualShrunk}`}>
          <AuthVisual
            title="Bem-vindo! Defina sua senha."
            subtitle="Para sua segurança, no primeiro acesso você cria uma senha só sua."
          />
        </section>

        <section className={`${styles.panel} ${styles.panelExpanded}`}>
          <div className={styles.panelInner}>
            <div className={styles.formView} key="trocar-senha">
              <div className={styles.formHead}>
                <h2 className={styles.formTitle}>Criar nova senha</h2>
                <p className={styles.formSub}>
                  Você entrou com a senha temporária. Defina agora a sua senha
                  definitiva para continuar.
                </p>
              </div>
              <form className={styles.form} onSubmit={submit}>
                <FormField label="Nova senha" htmlFor="nova-senha" required>
                  <Input
                    id="nova-senha"
                    type="password"
                    placeholder="Ao menos 6 caracteres"
                    autoComplete="new-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    required
                  />
                </FormField>
                <FormField label="Confirmar nova senha" htmlFor="confirma-senha" required>
                  <Input
                    id="confirma-senha"
                    type="password"
                    placeholder="Repita a nova senha"
                    autoComplete="new-password"
                    value={confirma}
                    onChange={(e) => setConfirma(e.target.value)}
                    required
                  />
                </FormField>
                {error && <Alert tone="danger">{error}</Alert>}
                <Button type="submit" size="lg" full loading={loading}>
                  Salvar e continuar
                </Button>
              </form>
            </div>
          </div>
        </section>
      </main>
    </TenantTheme>
  );
}
