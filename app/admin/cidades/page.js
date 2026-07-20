"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";

import { useResource, useMutation } from "@/lib/api/useResource";
import { normalizeEmail, maskPhone } from "@/lib/masks";
import {
  listTenants,
  createTenant,
  activateTenant,
  deactivateTenant,
  resendTenantInvite,
  adaptTenants,
  normalizeSubdomain,
  previewDomain,
} from "@/lib/api/resources/platform";

const PlusIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

// máscara leve de CNPJ (00.000.000/0000-00) — a validação real é do backend.
function maskCnpj(value = "") {
  const d = String(value).replace(/\D/g, "").slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const EMPTY_DRAFT = {
  mode: "delegado", // 'delegado' | 'completo'
  name: "",
  subdomain: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  // modo completo — marca
  primaryColor: "#032e59",
  secondaryColor: "#0a4a8c",
  logoUrl: "",
  // modo completo — órgão gestor
  cnpj: "",
  orgPhone: "",
  orgEmail: "",
  documentHeader: "",
};

export default function CitiesConsolePage() {
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listTenants(undefined, { signal }),
    []
  );
  const cities = useMemo(() => adaptTenants(data?.data ?? []), [data]);

  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [formError, setFormError] = useState(null);
  const [notice, setNotice] = useState(null); // { tone, message }
  const [actingId, setActingId] = useState(null);

  const createM = useMutation((body) => createTenant(body));
  const activateM = useMutation((id) => activateTenant(id));
  const deactivateM = useMutation((id) => deactivateTenant(id));
  const resendM = useMutation((id) => resendTenantInvite(id));

  const stats = useMemo(() => {
    const total = cities.length;
    const active = cities.filter((c) => c.active).length;
    const pending = cities.filter((c) => c.onboardingStatus === "pendente").length;
    return { total, active, pending };
  }, [cities]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.domain.toLowerCase().includes(q) ||
        (c.subdomain || "").toLowerCase().includes(q)
    );
  }, [cities, query]);

  function flash(message, tone = "success") {
    setNotice({ tone, message });
    setTimeout(() => setNotice(null), 5000);
  }

  function openCreate() {
    setDraft(EMPTY_DRAFT);
    setFormError(null);
    setCreating(true);
  }

  function set(field, value) {
    setDraft((d) => ({ ...d, [field]: value }));
  }

  // monta o payload conforme o modo escolhido.
  function buildPayload() {
    const tenant = { name: draft.name.trim(), subdomain: normalizeSubdomain(draft.subdomain) };
    const admin = {
      name: draft.adminName.trim(),
      email: normalizeEmail(draft.adminEmail),
    };
    if (draft.adminPhone.trim()) admin.phone = draft.adminPhone.trim();

    if (draft.mode === "completo") {
      if (draft.primaryColor) tenant.primaryColor = draft.primaryColor;
      if (draft.secondaryColor) tenant.secondaryColor = draft.secondaryColor;
      if (draft.logoUrl.trim()) tenant.logoUrl = draft.logoUrl.trim();
      if (draft.cnpj.trim()) tenant.cnpj = draft.cnpj.trim();
      if (draft.orgPhone.trim()) tenant.phone = draft.orgPhone.trim();
      if (draft.orgEmail.trim()) tenant.email = normalizeEmail(draft.orgEmail);
      if (draft.documentHeader.trim()) tenant.documentHeader = draft.documentHeader.trim();
    }
    return { mode: draft.mode, tenant, admin };
  }

  const canSubmit =
    draft.name.trim() && normalizeSubdomain(draft.subdomain).length >= 2 &&
    draft.adminName.trim() && draft.adminEmail.trim();

  async function submitCreate() {
    setFormError(null);
    try {
      const res = await createM.mutate(buildPayload());
      const domain = res?.domain || previewDomain(draft.subdomain);
      setCreating(false);
      await refetch();
      flash(`Cidade "${draft.name.trim()}" criada — convite enviado ao admin (${domain}).`);
    } catch (err) {
      if (err?.code === "SUBDOMAIN_IN_USE") {
        setFormError("Este subdomínio já está em uso por outra cidade. Escolha outro.");
      } else if (err?.code === "INVALID_SUBDOMAIN") {
        setFormError("Subdomínio inválido: use minúsculas, números e hífens (2 a 63 caracteres, sem hífen nas pontas).");
      } else {
        setFormError(err?.message || "Não foi possível criar a cidade. Verifique os dados e tente novamente.");
      }
    }
  }

  async function toggleActive(city) {
    setActingId(city.id);
    try {
      if (city.active) {
        await deactivateM.mutate(city.id);
        await refetch();
        flash(`${city.name} foi desativada — o acesso da cidade foi bloqueado.`);
      } else {
        await activateM.mutate(city.id);
        await refetch();
        flash(`${city.name} foi reativada — o acesso está liberado.`);
      }
    } catch (err) {
      flash(err?.message || "Não foi possível concluir a ação.", "danger");
    } finally {
      setActingId(null);
    }
  }

  async function resendInvite(city) {
    setActingId(city.id);
    try {
      const res = await resendM.mutate(city.id);
      const to = res?.admin?.email || "o administrador";
      flash(`Convite reenviado para ${to}.`);
    } catch (err) {
      if (err?.code === "ADMIN_NOT_FOUND") {
        flash("Esta cidade ainda não tem um administrador para reconvite.", "warning");
      } else {
        flash(err?.message || "Não foi possível reenviar o convite.", "danger");
      }
    } finally {
      setActingId(null);
    }
  }

  const columns = [
    {
      key: "city",
      label: "Cidade",
      render: (c) => (
        <div className={styles.cityCell}>
          <span className={styles.cityDot} style={{ background: c.primaryColor || "var(--color-navy)" }} />
          <div className={styles.cityInfo}>
            <span className={styles.cityName}>{c.name}</span>
            <span className={styles.citySub}>{c.subdomain}</span>
          </div>
        </div>
      ),
    },
    {
      key: "domain",
      label: "Domínio",
      render: (c) => <span className={styles.domain}>{c.domain}</span>,
    },
    {
      key: "onboarding",
      label: "Onboarding",
      render: (c) =>
        c.onboardingStatus === "concluido" ? (
          <Badge tone="success" dot>Concluído</Badge>
        ) : (
          <Badge tone="warning" dot>Pendente</Badge>
        ),
    },
    {
      key: "status",
      label: "Situação",
      render: (c) =>
        c.active ? (
          <Badge tone="success">Ativa</Badge>
        ) : (
          <Badge tone="neutral">Inativa</Badge>
        ),
    },
    {
      key: "actions",
      label: "",
      align: "right",
      render: (c) => {
        const busy = actingId === c.id;
        return (
          <div className={styles.rowActions}>
            <button
              type="button"
              className={styles.rowLink}
              disabled={busy}
              onClick={() => resendInvite(c)}
            >
              Reenviar convite
            </button>
            <button
              type="button"
              className={`${styles.rowLink} ${c.active ? styles.rowDanger : ""}`}
              disabled={busy}
              onClick={() => toggleActive(c)}
            >
              {c.active ? "Desativar" : "Ativar"}
            </button>
          </div>
        );
      },
    },
  ];

  const domainPreview = previewDomain(draft.subdomain);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <span className={styles.eyebrow}>Console da plataforma</span>
          <h1 className={styles.title}>Cidades</h1>
          <p className={styles.subtitle}>
            Provisionamento e operação das cidades atendidas pelo Eterniza Gestão.
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={openCreate} iconLeft={PlusIcon}>
            Nova cidade
          </Button>
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Cidades" value={String(stats.total)} caption="no total da plataforma" />
        <StatCard label="Ativas" value={String(stats.active)} caption="com acesso liberado" />
        <StatCard label="Onboarding pendente" value={String(stats.pending)} caption="aguardando configuração da cidade" />
      </div>

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <section className={styles.panel}>
        {loading ? (
          <div className={styles.loading}>
            <Skeleton variant="row" count={6} />
          </div>
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : cities.length === 0 ? (
          <EmptyState
            title="Nenhuma cidade cadastrada"
            message="Cadastre a primeira cidade para provisionar o acesso e convidar o administrador responsável."
            action={<Button onClick={openCreate} iconLeft={PlusIcon}>Cadastrar cidade</Button>}
          />
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.searchBox}>
                <svg viewBox="0 0 16 16" fill="none">
                  <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                  <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <input
                  placeholder="Buscar por cidade ou domínio…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <span className={styles.count}>{filtered.length} de {cities.length}</span>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="Nenhuma cidade encontrada" message="Ajuste a busca para ver outras cidades." />
            ) : (
              <>
                {/* desktop/tablet: tabela */}
                <div className={styles.tableWrap}>
                  <DataTable columns={columns} rows={filtered} />
                </div>

                {/* mobile: cartões nativos */}
                <ul className={styles.cardList}>
                  {filtered.map((c) => {
                    const busy = actingId === c.id;
                    return (
                      <li key={c.id} className={styles.card}>
                        <div className={styles.cardHead}>
                          <span className={styles.cityDot} style={{ background: c.primaryColor || "var(--color-navy)" }} />
                          <div className={styles.cityInfo}>
                            <span className={styles.cityName}>{c.name}</span>
                            <span className={styles.citySub}>{c.domain}</span>
                          </div>
                        </div>
                        <div className={styles.cardBadges}>
                          {c.onboardingStatus === "concluido" ? (
                            <Badge tone="success" dot>Concluído</Badge>
                          ) : (
                            <Badge tone="warning" dot>Pendente</Badge>
                          )}
                          {c.active ? (
                            <Badge tone="success">Ativa</Badge>
                          ) : (
                            <Badge tone="neutral">Inativa</Badge>
                          )}
                        </div>
                        <div className={styles.cardActions}>
                          <Button
                            variant="secondary"
                            disabled={busy}
                            onClick={() => resendInvite(c)}
                          >
                            Reenviar convite
                          </Button>
                          <Button
                            variant={c.active ? "danger" : "primary"}
                            disabled={busy}
                            onClick={() => toggleActive(c)}
                          >
                            {c.active ? "Desativar" : "Ativar"}
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </>
        )}
      </section>

      {/* ---------- criar cidade ---------- */}
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Nova cidade"
        subtitle="Provisiona a cidade e convida o primeiro administrador"
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
            <Button loading={createM.loading} disabled={!canSubmit} onClick={submitCreate}>
              Criar cidade
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          {/* toggle de modo */}
          <div className={styles.modeSwitch} role="tablist" aria-label="Modo de cadastro">
            <button
              type="button"
              role="tab"
              aria-selected={draft.mode === "delegado"}
              className={`${styles.modeBtn} ${draft.mode === "delegado" ? styles.modeActive : ""}`}
              onClick={() => set("mode", "delegado")}
            >
              <span className={styles.modeTitle}>Deixar a prefeitura configurar</span>
              <span className={styles.modeDesc}>Só o essencial agora. O admin da cidade completa a marca no onboarding.</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={draft.mode === "completo"}
              className={`${styles.modeBtn} ${draft.mode === "completo" ? styles.modeActive : ""}`}
              onClick={() => set("mode", "completo")}
            >
              <span className={styles.modeTitle}>Configuro agora</span>
              <span className={styles.modeDesc}>Já defino marca e órgão gestor — onboarding concluído na criação.</span>
            </button>
          </div>

          {/* dados da cidade */}
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Cidade</span>
            <div className={styles.grid}>
              <FormField label="Nome da cidade" required className={styles.spanTwo}>
                <Input
                  placeholder="Prefeitura de São Paulo"
                  value={draft.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </FormField>
              <FormField
                label="Subdomínio"
                required
                className={styles.spanTwo}
                hint={domainPreview ? `Domínio final: ${domainPreview}` : "Use minúsculas, números e hífens."}
              >
                <Input
                  placeholder="sao-paulo"
                  value={draft.subdomain}
                  onChange={(e) => set("subdomain", normalizeSubdomain(e.target.value))}
                />
              </FormField>
            </div>
          </div>

          {/* primeiro admin */}
          <div className={styles.section}>
            <span className={styles.sectionLabel}>Primeiro administrador</span>
            <div className={styles.grid}>
              <FormField label="Nome" required className={styles.spanTwo}>
                <Input
                  placeholder="Nome e sobrenome"
                  value={draft.adminName}
                  onChange={(e) => set("adminName", e.target.value)}
                />
              </FormField>
              <FormField label="E-mail" required>
                <Input
                  type="email"
                  placeholder="admin@cidade.gov.br"
                  value={draft.adminEmail}
                  onChange={(e) => set("adminEmail", normalizeEmail(e.target.value))}
                />
              </FormField>
              <FormField label="Telefone">
                <Input
                  placeholder="(00) 00000-0000"
                  value={draft.adminPhone}
                  onChange={(e) => set("adminPhone", maskPhone(e.target.value))}
                />
              </FormField>
            </div>
            <p className={styles.inviteHint}>
              O administrador recebe um convite por e-mail para criar a senha e acessar o painel da cidade.
            </p>
          </div>

          {/* modo completo — marca + órgão gestor */}
          {draft.mode === "completo" && (
            <>
              <div className={styles.section}>
                <span className={styles.sectionLabel}>Marca</span>
                <div className={styles.grid}>
                  <FormField label="Cor primária">
                    <ColorField value={draft.primaryColor} onChange={(v) => set("primaryColor", v)} />
                  </FormField>
                  <FormField label="Cor secundária">
                    <ColorField value={draft.secondaryColor} onChange={(v) => set("secondaryColor", v)} />
                  </FormField>
                  <FormField label="Logo (URL)" className={styles.spanTwo}>
                    <Input
                      placeholder="https://…/logo.png"
                      value={draft.logoUrl}
                      onChange={(e) => set("logoUrl", e.target.value)}
                    />
                  </FormField>
                </div>
              </div>

              <div className={styles.section}>
                <span className={styles.sectionLabel}>Órgão gestor</span>
                <div className={styles.grid}>
                  <FormField label="CNPJ">
                    <Input
                      placeholder="00.000.000/0000-00"
                      inputMode="numeric"
                      value={draft.cnpj}
                      onChange={(e) => set("cnpj", maskCnpj(e.target.value))}
                    />
                  </FormField>
                  <FormField label="Telefone">
                    <Input
                      placeholder="(00) 0000-0000"
                      value={draft.orgPhone}
                      onChange={(e) => set("orgPhone", maskPhone(e.target.value))}
                    />
                  </FormField>
                  <FormField label="E-mail">
                    <Input
                      type="email"
                      placeholder="contato@cidade.gov.br"
                      value={draft.orgEmail}
                      onChange={(e) => set("orgEmail", normalizeEmail(e.target.value))}
                    />
                  </FormField>
                  <FormField label="Cabeçalho do documento">
                    <Input
                      placeholder="Prefeitura Municipal de…"
                      value={draft.documentHeader}
                      onChange={(e) => set("documentHeader", e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </>
          )}

          {formError && <Alert tone="danger">{formError}</Alert>}
        </div>
      </Modal>
    </div>
  );
}

// campo de cor: swatch nativo + hex texto, alinhado ao design system.
function ColorField({ value, onChange }) {
  return (
    <span className={styles.colorField}>
      <input
        type="color"
        className={styles.colorSwatch}
        value={value || "#032e59"}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Selecionar cor"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#032e59"
      />
    </span>
  );
}
