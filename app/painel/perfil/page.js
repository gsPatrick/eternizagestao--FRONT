"use client";

/* ============================================================================
 * Meu perfil — dados da PRÓPRIA conta do usuário logado.
 *
 * Só usa os endpoints de self-service que a API já expõe (sessions):
 *   GET   /sessions/me           carrega os dados
 *   PATCH /sessions/me           salva { name, email }
 *   PATCH /sessions/me/password  troca a senha { currentPassword, newPassword }
 *
 * Telefone é apenas EXIBIDO quando vem no payload: o self-service da API não
 * aceita `phone` (só admin altera telefone em /users/:id).
 * ==========================================================================*/

import { useEffect, useState } from "react";
import { getMe, updateMyProfile, changeMyPassword } from "@/lib/api/resources/me";
import { useResource, useMutation } from "@/lib/api/useResource";
import { roleLabelOf } from "@/components/organisms/PanelHeader/PanelHeader";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import styles from "./page.module.css";

const VAZIO_SENHA = { currentPassword: "", newPassword: "", confirmPassword: "" };

function scrollTopo() {
  if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
}

export default function PerfilPage() {
  const { data: me, loading, error, refetch } = useResource(getMe, []);

  const [form, setForm] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const { mutate: salvarPerfil, loading: salvando } = useMutation(updateMyProfile);

  const [senha, setSenha] = useState(VAZIO_SENHA);
  const [feedbackSenha, setFeedbackSenha] = useState(null);
  const { mutate: trocarSenha, loading: trocandoSenha } = useMutation(changeMyPassword);

  // Hidrata o formulário assim que os dados chegam.
  useEffect(() => {
    if (me) setForm({ name: me.name || "", email: me.email || "" });
  }, [me]);

  function set(campo, valor) {
    setForm((atual) => ({ ...atual, [campo]: valor }));
  }
  function setSenhaCampo(campo, valor) {
    setSenha((atual) => ({ ...atual, [campo]: valor }));
  }

  async function handleSalvar() {
    const name = (form.name || "").trim();
    const email = (form.email || "").trim();
    if (name.length < 3) {
      setFeedback({ tone: "danger", title: "Revise os campos", msg: "Informe seu nome completo." });
      return scrollTopo();
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setFeedback({ tone: "danger", title: "Revise os campos", msg: "Informe um e-mail válido." });
      return scrollTopo();
    }
    try {
      await salvarPerfil({ name, email });
      setFeedback({ tone: "success", title: "Perfil atualizado", msg: "Seus dados foram salvos." });
      refetch();
    } catch (err) {
      setFeedback({
        tone: "danger",
        title: err?.code === "EMAIL_IN_USE" ? "E-mail já utilizado" : "Não foi possível salvar",
        msg:
          err?.code === "EMAIL_IN_USE"
            ? "Esse e-mail já pertence a outro usuário da cidade."
            : err?.message || "Tente novamente em instantes.",
      });
    }
    scrollTopo();
  }

  async function handleTrocarSenha() {
    const { currentPassword, newPassword, confirmPassword } = senha;
    if (newPassword.length < 6) {
      return setFeedbackSenha({
        tone: "danger",
        title: "Senha muito curta",
        msg: "A nova senha precisa ter pelo menos 6 caracteres.",
      });
    }
    if (newPassword !== confirmPassword) {
      return setFeedbackSenha({
        tone: "danger",
        title: "As senhas não conferem",
        msg: "A confirmação precisa ser igual à nova senha.",
      });
    }
    try {
      await trocarSenha({ currentPassword, newPassword });
      setSenha(VAZIO_SENHA);
      setFeedbackSenha({
        tone: "success",
        title: "Senha alterada",
        msg: "Use a nova senha no próximo acesso.",
      });
    } catch (err) {
      const titulos = {
        INVALID_PASSWORD: "Senha atual incorreta",
        WEAK_PASSWORD: "Senha muito fraca",
      };
      setFeedbackSenha({
        tone: "danger",
        title: titulos[err?.code] || "Não foi possível alterar",
        msg:
          err?.code === "INVALID_PASSWORD"
            ? "Confira a senha atual e tente de novo."
            : err?.message || "Tente novamente em instantes.",
      });
    }
  }

  if (loading) return <PerfilSkeleton />;
  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar seu perfil"
        message={error.message}
        onRetry={refetch}
      />
    );
  }
  if (!form) return null;

  return (
    <div className={styles.topic}>
      <div className={styles.topicHead}>
        <div>
          <h1 className={styles.topicTitle}>Meu perfil</h1>
          <p className={styles.topicDesc}>
            Os dados da sua conta de acesso ao painel e a senha que você usa para entrar.
          </p>
        </div>
      </div>

      {/* Cartão de identidade — quem está logado, de fato. */}
      <div className={styles.identity}>
        <Avatar name={me?.name || ""} size="lg" />
        <div className={styles.identityInfo}>
          <strong className={styles.identityName}>{me?.name}</strong>
          <span className={styles.identityEmail}>{me?.email}</span>
          <span className={styles.identityMeta}>
            <span className={styles.pill}>{roleLabelOf(me)}</span>
            {me?.tenant?.name && <span className={styles.identityTenant}>{me.tenant.name}</span>}
          </span>
        </div>
      </div>

      {feedback && (
        <Alert tone={feedback.tone} title={feedback.title}>
          {feedback.msg}
        </Alert>
      )}

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Dados da conta</h2>
          <p className={styles.cardDesc}>
            Nome e e-mail que aparecem no painel e nos registros que você cria.
          </p>
        </div>
        <div className={styles.cardBody}>
          <div className={styles.grid2}>
            <FormField label="Nome completo" htmlFor="perfil-nome" required>
              <Input
                id="perfil-nome"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </FormField>
            <FormField
              label="E-mail de acesso"
              htmlFor="perfil-email"
              hint="É com este e-mail que você entra no painel."
              required
            >
              <Input
                id="perfil-email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </FormField>
          </div>

          <div className={styles.grid2}>
            <FormField
              label="Telefone"
              hint="Somente um administrador pode alterar o telefone."
            >
              <Input value={me?.phone || "Não informado"} disabled readOnly />
            </FormField>
            <FormField
              label="Perfil de acesso"
              hint="Definido por um administrador em Configurações."
            >
              <Input value={roleLabelOf(me)} disabled readOnly />
            </FormField>
          </div>
        </div>
        <div className={styles.cardFooter}>
          <Button loading={salvando} onClick={handleSalvar}>
            Salvar alterações
          </Button>
        </div>
      </section>

      <section className={styles.card}>
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle}>Alterar senha</h2>
          <p className={styles.cardDesc}>
            Escolha uma senha com pelo menos 6 caracteres que você não use em outros sistemas.
          </p>
        </div>
        <div className={styles.cardBody}>
          {feedbackSenha && (
            <Alert tone={feedbackSenha.tone} title={feedbackSenha.title}>
              {feedbackSenha.msg}
            </Alert>
          )}
          <div className={styles.grid3}>
            <FormField label="Senha atual" htmlFor="senha-atual" required>
              <Input
                id="senha-atual"
                type="password"
                autoComplete="current-password"
                value={senha.currentPassword}
                onChange={(e) => setSenhaCampo("currentPassword", e.target.value)}
              />
            </FormField>
            <FormField label="Nova senha" htmlFor="senha-nova" required>
              <Input
                id="senha-nova"
                type="password"
                autoComplete="new-password"
                value={senha.newPassword}
                onChange={(e) => setSenhaCampo("newPassword", e.target.value)}
              />
            </FormField>
            <FormField label="Confirmar nova senha" htmlFor="senha-confirma" required>
              <Input
                id="senha-confirma"
                type="password"
                autoComplete="new-password"
                value={senha.confirmPassword}
                onChange={(e) => setSenhaCampo("confirmPassword", e.target.value)}
              />
            </FormField>
          </div>
        </div>
        <div className={styles.cardFooter}>
          <Button variant="secondary" loading={trocandoSenha} onClick={handleTrocarSenha}>
            Alterar senha
          </Button>
        </div>
      </section>
    </div>
  );
}

function PerfilSkeleton() {
  return (
    <div className={styles.topic}>
      <Skeleton variant="line" width="30%" height={22} />
      <div className={styles.card}>
        <Skeleton variant="line" width="40%" height={16} />
        <div style={{ height: 16 }} />
        <Skeleton variant="block" height={160} />
      </div>
    </div>
  );
}
