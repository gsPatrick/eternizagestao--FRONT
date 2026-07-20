"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import Avatar from "@/components/atoms/Avatar/Avatar";
import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Alert from "@/components/molecules/Alert/Alert";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";

import { getMe, updateMyProfile, changeMyPassword } from "@/lib/api/resources/me";
import { clearSession } from "@/lib/api/session";
import { normalizeEmail, isValidEmail } from "@/lib/masks";

const SignOutIcon = (
  <svg viewBox="0 0 18 18" fill="none">
    <path d="M7 15.5H4a1 1 0 0 1-1-1v-11a1 1 0 0 1 1-1h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M12 12.5 15.5 9 12 5.5M15 9H7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function SettingsPage() {
  const router = useRouter();

  // carregamento do usuário logado
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // seção Perfil
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNotice, setProfileNotice] = useState(null); // { tone, message }

  // seção Segurança
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordNotice, setPasswordNotice] = useState(null); // { tone, message }

  async function load() {
    setLoading(true);
    setLoadError(false);
    try {
      const me = await getMe();
      setUser(me);
      setName(me?.name || "");
      setEmail(me?.email || "");
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function signOut() {
    clearSession();
    router.replace("/login");
  }

  // ---------- Perfil ----------
  const trimmedName = name.trim();
  const normalizedEmail = normalizeEmail(email);
  const profileDirty =
    trimmedName !== (user?.name || "") || normalizedEmail !== (user?.email || "");
  const profileValid = trimmedName.length > 0 && isValidEmail(normalizedEmail);

  async function saveProfile(e) {
    e?.preventDefault();
    setProfileNotice(null);
    if (!profileDirty || !profileValid) return;
    setProfileSaving(true);
    try {
      const updated = await updateMyProfile({ name: trimmedName, email: normalizedEmail });
      setUser(updated);
      setName(updated?.name || trimmedName);
      setEmail(updated?.email || normalizedEmail);
      setProfileNotice({ tone: "success", message: "Perfil atualizado com sucesso." });
    } catch (err) {
      if (err?.code === "EMAIL_IN_USE" || err?.status === 409) {
        setProfileNotice({ tone: "danger", message: "Já existe um usuário com este e-mail." });
      } else {
        setProfileNotice({
          tone: "danger",
          message: err?.message || "Não foi possível salvar as alterações.",
        });
      }
    } finally {
      setProfileSaving(false);
    }
  }

  // ---------- Segurança ----------
  const passwordFilled =
    currentPassword.length > 0 && newPassword.length > 0 && confirmPassword.length > 0;

  async function savePassword(e) {
    e?.preventDefault();
    setPasswordNotice(null);

    if (newPassword.length < 6) {
      setPasswordNotice({
        tone: "danger",
        message: "A nova senha deve ter ao menos 6 caracteres.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordNotice({ tone: "danger", message: "A confirmação não confere com a nova senha." });
      return;
    }

    setPasswordSaving(true);
    try {
      await changeMyPassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordNotice({ tone: "success", message: "Senha alterada com sucesso." });
    } catch (err) {
      if (err?.code === "INVALID_PASSWORD" || err?.status === 401) {
        setPasswordNotice({ tone: "danger", message: "Senha atual incorreta." });
      } else if (err?.code === "WEAK_PASSWORD") {
        setPasswordNotice({
          tone: "danger",
          message: "A nova senha deve ter ao menos 6 caracteres.",
        });
      } else {
        setPasswordNotice({
          tone: "danger",
          message: err?.message || "Não foi possível alterar a senha.",
        });
      }
    } finally {
      setPasswordSaving(false);
    }
  }

  const displayName = user?.name || "Plataforma";
  const displayEmail = user?.email || null;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <span className={styles.eyebrow}>Console da plataforma</span>
          <h1 className={styles.title}>Configurações</h1>
          <p className={styles.subtitle}>Gerencie seu perfil, sua senha e a sessão de acesso.</p>
        </div>
      </header>

      {loading ? (
        <div className={styles.grid}>
          <section className={styles.skeletonCard}>
            <Skeleton variant="line" width="40%" />
            <Skeleton variant="block" height={44} />
            <Skeleton variant="block" height={44} />
          </section>
          <section className={styles.skeletonCard}>
            <Skeleton variant="line" width="40%" />
            <Skeleton variant="block" height={44} />
            <Skeleton variant="block" height={44} />
            <Skeleton variant="block" height={44} />
          </section>
        </div>
      ) : loadError ? (
        <ErrorState onRetry={load} />
      ) : (
        <div className={styles.grid}>
          {/* ---------- Perfil ---------- */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Perfil</h2>
              <p className={styles.cardHint}>Seu nome e e-mail de acesso à plataforma.</p>
            </div>

            <form className={styles.form} onSubmit={saveProfile}>
              <FormField label="Nome" htmlFor="settings-name">
                <Input
                  id="settings-name"
                  value={name}
                  placeholder="Seu nome"
                  onChange={(e) => setName(e.target.value)}
                />
              </FormField>
              <FormField label="E-mail" htmlFor="settings-email">
                <Input
                  id="settings-email"
                  type="email"
                  value={email}
                  placeholder="voce@eterniza.com.br"
                  onChange={(e) => setEmail(normalizeEmail(e.target.value))}
                />
              </FormField>

              {profileNotice && (
                <Alert tone={profileNotice.tone}>{profileNotice.message}</Alert>
              )}

              <div className={styles.formFooter}>
                <Button
                  type="submit"
                  loading={profileSaving}
                  disabled={!profileDirty || !profileValid}
                >
                  Salvar alterações
                </Button>
              </div>
            </form>
          </section>

          {/* ---------- Segurança ---------- */}
          <section className={styles.card}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Segurança</h2>
              <p className={styles.cardHint}>Altere sua senha de acesso.</p>
            </div>

            <form className={styles.form} onSubmit={savePassword}>
              <FormField label="Senha atual" htmlFor="settings-current">
                <Input
                  id="settings-current"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </FormField>
              <FormField label="Nova senha" htmlFor="settings-new" hint="Ao menos 6 caracteres.">
                <Input
                  id="settings-new"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </FormField>
              <FormField label="Confirmar nova senha" htmlFor="settings-confirm">
                <Input
                  id="settings-confirm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </FormField>

              {passwordNotice && (
                <Alert tone={passwordNotice.tone}>{passwordNotice.message}</Alert>
              )}

              <div className={styles.formFooter}>
                <Button type="submit" loading={passwordSaving} disabled={!passwordFilled}>
                  Alterar senha
                </Button>
              </div>
            </form>
          </section>

          {/* ---------- Conta ---------- */}
          <section className={`${styles.card} ${styles.cardWide}`}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Conta</h2>
              <p className={styles.cardHint}>Sua identidade e a sessão neste dispositivo.</p>
            </div>

            <div className={styles.identity}>
              <Avatar name={displayName} size="lg" />
              <div className={styles.identityText}>
                <span className={styles.identityName}>{displayName}</span>
                {displayEmail && <span className={styles.identityEmail}>{displayEmail}</span>}
                <span className={styles.identityTag}>Plataforma</span>
              </div>
            </div>

            <div className={styles.divider} />

            <div className={styles.accountFooter}>
              <p className={styles.footerHint}>
                Encerra a sessão neste dispositivo e volta para a tela de acesso.
              </p>
              <Button variant="danger" onClick={signOut} iconLeft={SignOutIcon}>
                Sair
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
