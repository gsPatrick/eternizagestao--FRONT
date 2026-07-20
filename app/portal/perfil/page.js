"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import PortalShell from "@/components/organisms/PortalShell/PortalShell";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Badge from "@/components/atoms/Badge/Badge";
import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import { useTenant } from "@/components/providers/TenantTheme/TenantTheme";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getMe, updateMe, changePassword } from "@/lib/api/resources/portal";
import { clearSession } from "@/lib/api/session";
import { maskPhone, maskCep } from "@/lib/masks";

const MailIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <rect x="3" y="5" width="18" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
    <path d="m4 7 8 5.5L20 7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PhoneIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M6.5 4h3l1.4 3.6-2 1.4a11 11 0 0 0 4.1 4.1l1.4-2 3.6 1.4v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 6.2 2 2 0 0 1 6.5 4Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

const WhatsIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M4 20l1.3-3.9A7.5 7.5 0 1 1 8 19.1L4 20Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <path d="M9.2 8.4c-.2 1.2.5 2.6 1.6 3.7s2.5 1.8 3.7 1.6c.5-.1.8-.7.6-1.2l-.9-1.3-1.4.5a4.4 4.4 0 0 1-1.9-1.9l.5-1.4-1.3-.9c-.5-.2-1.1.1-1.2.6Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
  </svg>
);

const PinIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <path d="M12 21s7-6.4 7-11a7 7 0 1 0-14 0c0 4.6 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.4" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const LockIcon = (
  <svg viewBox="0 0 24 24" fill="none">
    <rect x="4.5" y="10.5" width="15" height="9.5" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

export default function PortalPerfilPage() {
  const tenant = useTenant();
  const sub = (tenant?.subdomain || "").split(".")[0];

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => getMe({ signal, tenant: sub }),
    [sub]
  );

  return (
    <PortalShell active="perfil">
      {loading ? (
        <div className={styles.page}>
          <Skeleton variant="block" height={110} />
          <Skeleton variant="card" count={2} height={160} />
        </div>
      ) : error ? (
        <div className={styles.page}>
          <ErrorState onRetry={refetch} />
        </div>
      ) : (
        <PerfilContent user={data} sub={sub} />
      )}
    </PortalShell>
  );
}

function PerfilContent({ user, sub }) {
  const router = useRouter();
  const save = useMutation((body) => updateMe(body, { tenant: sub }));

  // ---- contato ----
  const [editContact, setEditContact] = useState(false);
  const [contactSaved, setContactSaved] = useState(false);
  const [contact, setContact] = useState({
    whatsapp: user.whatsapp,
    phone: user.phone,
    email: user.email,
  });
  const [contactDraft, setContactDraft] = useState(contact);

  function openContact() {
    setContactDraft(contact);
    setEditContact(true);
  }

  async function saveContact() {
    try {
      await save.mutate({
        whatsapp: contactDraft.whatsapp,
        phonePrimary: contactDraft.phone,
        email: contactDraft.email,
      });
      setContact(contactDraft);
      setEditContact(false);
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 4500);
    } catch (e) {
      // save.error exibe a mensagem no formulário
    }
  }

  // ---- endereço ----
  const [editAddress, setEditAddress] = useState(false);
  const [addressSaved, setAddressSaved] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [address, setAddress] = useState({
    zipcode: user.zipcode,
    city: user.city,
    street: user.address,
  });
  const [addressDraft, setAddressDraft] = useState(address);

  function openAddress() {
    setAddressDraft(address);
    setEditAddress(true);
  }

  async function handleCep(value) {
    const masked = maskCep(value);
    setAddressDraft((d) => ({ ...d, zipcode: masked }));
    const digits = masked.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (data && !data.erro) {
        const city = data.localidade && data.uf ? `${data.localidade} — ${data.uf}` : "";
        const street = [data.logradouro, data.bairro].filter(Boolean).join(" · ");
        setAddressDraft((d) => ({
          ...d,
          city: city || d.city,
          street: street || d.street,
        }));
      }
    } catch {
      /* offline / ViaCEP indisponível — mantém preenchimento manual */
    } finally {
      setCepLoading(false);
    }
  }

  async function saveAddress() {
    // "São Paulo — SP" → cidade + UF
    const [addressCity, addressState] = String(addressDraft.city)
      .split("—")
      .map((s) => s.trim());
    try {
      await save.mutate({
        addressZipcode: addressDraft.zipcode,
        addressCity: addressCity || null,
        addressState: addressState || null,
        addressStreet: addressDraft.street,
      });
      setAddress(addressDraft);
      setEditAddress(false);
      setAddressSaved(true);
      setTimeout(() => setAddressSaved(false), 4500);
    } catch (e) {
      // save.error exibe a mensagem no formulário
    }
  }

  // ---- senha ---- (PATCH /portal/password: valida a senha atual no backend)
  const changePwd = useMutation((body) => changePassword(body, { tenant: sub }));
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });

  function openPwd() {
    setPwd({ current: "", next: "", confirm: "" });
    setPwdError("");
    setPwdOpen(true);
  }

  async function savePwd() {
    setPwdError("");
    if (pwd.next.length < 8) {
      setPwdError("A nova senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (pwd.next !== pwd.confirm) {
      setPwdError("A confirmação não confere com a nova senha.");
      return;
    }
    try {
      await changePwd.mutate({ currentPassword: pwd.current, newPassword: pwd.next });
      setPwdOpen(false);
      setPwdSaved(true);
      setTimeout(() => setPwdSaved(false), 4500);
    } catch (e) {
      setPwdError(e?.message || "Não foi possível alterar a senha. Tente novamente.");
    }
  }

  function logout() {
    clearSession();
    router.push("/portal/login");
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1 className={styles.title}>Meus dados</h1>
        <p className={styles.subtitle}>Confira e mantenha seus dados de contato sempre atualizados.</p>
      </header>

      {/* ---- cartão de perfil ---- */}
      <section className={styles.profileCard}>
        <Avatar name={user.name} size="lg" />
        <div className={styles.profileInfo}>
          <span className={styles.profileName}>{user.name}</span>
          <span className={styles.profileCpf}>CPF {user.cpf}</span>
          <div className={styles.profileBadges}>
            <Badge tone="navy">{user.cemetery}</Badge>
            <Badge tone="success" dot>Conta do Portal da Família · ativa</Badge>
          </div>
        </div>
      </section>

      {/* ---- contato ---- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Contato</h2>
          {!editContact && (
            <Button variant="ghost" size="sm" onClick={openContact}>Editar</Button>
          )}
        </div>

        {contactSaved && (
          <Alert tone="success" title="Dados atualizados.">
            Seus dados de contato foram salvos com sucesso.
          </Alert>
        )}

        <div className={styles.card}>
          {!editContact ? (
            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.rowIcon}>{WhatsIcon}</span>
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>WhatsApp</span>
                  <span className={styles.rowValue}>{contact.whatsapp}</span>
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.rowIcon}>{PhoneIcon}</span>
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>Telefone</span>
                  <span className={styles.rowValue}>{contact.phone}</span>
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.rowIcon}>{MailIcon}</span>
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>E-mail</span>
                  <span className={styles.rowValue}>{contact.email}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.form}>
              {save.error && <Alert tone="danger">{save.error.message}</Alert>}
              <FormField label="WhatsApp" hint="Você recebe os avisos de vencimento aqui." className={styles.formField}>
                <Input
                  value={contactDraft.whatsapp}
                  onChange={(e) => setContactDraft((d) => ({ ...d, whatsapp: maskPhone(e.target.value) }))}
                  inputMode="tel"
                  placeholder="(11) 90000-0000"
                />
              </FormField>
              <FormField label="Telefone" className={styles.formField}>
                <Input
                  value={contactDraft.phone}
                  onChange={(e) => setContactDraft((d) => ({ ...d, phone: maskPhone(e.target.value) }))}
                  inputMode="tel"
                  placeholder="(11) 3000-0000"
                />
              </FormField>
              <FormField label="E-mail" className={styles.formField}>
                <Input
                  value={contactDraft.email}
                  onChange={(e) => setContactDraft((d) => ({ ...d, email: e.target.value }))}
                  type="email"
                  inputMode="email"
                  placeholder="voce@email.com"
                />
              </FormField>
              <div className={styles.formActions}>
                <Button variant="primary" loading={save.loading} onClick={saveContact}>Salvar</Button>
                <Button variant="secondary" onClick={() => setEditContact(false)} disabled={save.loading}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---- endereço ---- */}
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Endereço</h2>
          {!editAddress && (
            <Button variant="ghost" size="sm" onClick={openAddress}>Editar</Button>
          )}
        </div>

        {addressSaved && (
          <Alert tone="success" title="Dados atualizados.">
            Seu endereço foi salvo com sucesso.
          </Alert>
        )}

        <div className={styles.card}>
          {!editAddress ? (
            <div className={styles.rows}>
              <div className={styles.row}>
                <span className={styles.rowIcon}>{PinIcon}</span>
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>Endereço</span>
                  <span className={styles.rowValue}>{address.street}</span>
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.rowIcon} aria-hidden="true" />
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>Cidade / UF</span>
                  <span className={styles.rowValue}>{address.city}</span>
                </div>
              </div>
              <div className={styles.row}>
                <span className={styles.rowIcon} aria-hidden="true" />
                <div className={styles.rowText}>
                  <span className={styles.rowLabel}>CEP</span>
                  <span className={styles.rowValue}>{address.zipcode}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.form}>
              {save.error && <Alert tone="danger">{save.error.message}</Alert>}
              <FormField
                label="CEP"
                hint={cepLoading ? "Buscando endereço…" : "Preenche cidade e rua automaticamente."}
                className={styles.formField}
              >
                <Input
                  value={addressDraft.zipcode}
                  onChange={(e) => handleCep(e.target.value)}
                  inputMode="numeric"
                  placeholder="00000-000"
                />
              </FormField>
              <FormField label="Cidade / UF" className={styles.formField}>
                <Input
                  value={addressDraft.city}
                  onChange={(e) => setAddressDraft((d) => ({ ...d, city: e.target.value }))}
                  placeholder="São Paulo — SP"
                />
              </FormField>
              <FormField label="Logradouro" className={styles.formField}>
                <Input
                  value={addressDraft.street}
                  onChange={(e) => setAddressDraft((d) => ({ ...d, street: e.target.value }))}
                  placeholder="Rua, número · bairro"
                />
              </FormField>
              <div className={styles.formActions}>
                <Button variant="primary" loading={save.loading} onClick={saveAddress}>Salvar</Button>
                <Button variant="secondary" onClick={() => setEditAddress(false)} disabled={save.loading}>Cancelar</Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ---- segurança ---- */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Segurança</h2>

        {pwdSaved && (
          <Alert tone="success" title="Senha alterada.">
            Sua senha foi atualizada com sucesso.
          </Alert>
        )}

        <div className={styles.card}>
          <div className={styles.securityRow}>
            <span className={styles.rowIcon}>{LockIcon}</span>
            <div className={styles.rowText}>
              <span className={styles.rowValue}>Senha de acesso</span>
              <span className={styles.rowLabel}>Recomendamos trocar a senha periodicamente.</span>
            </div>
            <Button variant="secondary" size="sm" onClick={openPwd}>Alterar senha</Button>
          </div>

          <div className={styles.divider} />

          <div className={styles.securityRow}>
            <span className={styles.rowIcon}>{WhatsIcon}</span>
            <div className={styles.rowText}>
              <span className={styles.rowValue}>Notificações por WhatsApp</span>
              <span className={styles.rowLabel}>
                Os avisos de vencimento e 2ª via chegam no número cadastrado ({contact.whatsapp}).
                Para mudar, atualize o WhatsApp na seção Contato.
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ---- sair ---- */}
      <footer className={styles.logout}>
        <Button variant="danger" full onClick={logout}>Sair da conta</Button>
      </footer>

      {/* ---- modal alterar senha ---- */}
      <Modal
        open={pwdOpen}
        onClose={() => setPwdOpen(false)}
        title="Alterar senha"
        subtitle="Escolha uma nova senha para acessar o portal."
        width={460}
        footer={
          <>
            <span className={styles.footSpacer} />
            <Button variant="ghost" onClick={() => setPwdOpen(false)} disabled={changePwd.loading}>Cancelar</Button>
            <Button variant="primary" loading={changePwd.loading} onClick={savePwd}>Salvar</Button>
          </>
        }
      >
        <div className={styles.form}>
          {pwdError && <Alert tone="danger">{pwdError}</Alert>}
          <FormField label="Senha atual" className={styles.formField}>
            <Input
              type="password"
              value={pwd.current}
              onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))}
              placeholder="••••••••"
            />
          </FormField>
          <FormField label="Nova senha" hint="Use pelo menos 8 caracteres." className={styles.formField}>
            <Input
              type="password"
              value={pwd.next}
              onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))}
              placeholder="••••••••"
            />
          </FormField>
          <FormField label="Confirmar nova senha" className={styles.formField}>
            <Input
              type="password"
              value={pwd.confirm}
              onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
            />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
