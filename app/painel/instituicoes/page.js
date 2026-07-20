"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";

import { maskPhone } from "@/lib/masks";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import {
  listInstitutions,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  toInstitutionRow,
  toInstitutionPayload,
} from "@/lib/api/resources/institutions";

// Máscara de CNPJ (00.000.000/0000-00) — telefone reaproveita lib/masks.
function maskCnpj(value = "") {
  return String(value)
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

const EMPTY_FORM = {
  name: "", type: "", cnpj: "", phone: "", email: "", street: "", state: "", city: "", notes: "",
};

export default function InstituicoesPage() {
  const currentUser = useMemo(() => getUser(), []);
  const canWrite = ["admin", "operador", "super_admin"].includes(currentUser?.role);
  const canDelete = ["admin", "super_admin"].includes(currentUser?.role);

  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [notice, setNotice] = useState(null);

  const listParams = useMemo(() => {
    const p = { perPage: 100 };
    const q = query.trim();
    if (q) p.search = q;
    return p;
  }, [query]);

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listInstitutions(listParams, { signal }),
    [listParams]
  );

  const rows = useMemo(() => (data?.data ?? []).map(toInstitutionRow), [data]);
  const total = data?.meta?.totalItems ?? rows.length;
  const isFiltered = query.trim().length > 0;

  const saveM = useMutation((body) =>
    form?.id ? updateInstitution(form.id, body) : createInstitution(body)
  );
  const deleteM = useMutation((id) => deleteInstitution(id));
  const saving = saveM.loading;

  function flash(message, tone = "success") {
    setNotice({ tone, message });
    setTimeout(() => setNotice(null), 4500);
  }

  function openNew() { setForm({ ...EMPTY_FORM }); }
  function openEdit(row) { setForm({ ...row }); }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.name.trim()) return flash("Informe o nome da instituição.", "danger");
    try {
      const editing = Boolean(form.id);
      await saveM.mutate(toInstitutionPayload(form));
      setForm(null);
      await refetch();
      flash(editing ? "Instituição atualizada." : "Instituição cadastrada com sucesso.");
    } catch (e) {
      flash(e?.message || "Não foi possível salvar a instituição.", "danger");
    }
  }

  async function doDelete() {
    try {
      await deleteM.mutate(confirmDelete.id);
      setConfirmDelete(null);
      await refetch();
      flash("Instituição excluída.");
    } catch (e) {
      flash(e?.message || "Não foi possível excluir a instituição.", "danger");
    }
  }

  const columns = [
    {
      key: "name", label: "Nome",
      render: (i) => (
        <div className={styles.cellStack}>
          <span className={styles.rowName}>{i.name}</span>
          {i.cnpj && <span className={styles.rowSub}>{i.cnpj}</span>}
        </div>
      ),
    },
    { key: "type", label: "Tipo", render: (i) => (i.type ? <Badge tone="neutral">{i.type}</Badge> : <span className={styles.muted}>—</span>) },
    { key: "phone", label: "Telefone", render: (i) => (i.phone ? <span className={styles.mono}>{i.phone}</span> : <span className={styles.muted}>—</span>) },
    {
      key: "city", label: "Cidade / UF",
      render: (i) => <span className={styles.cityCell}>{[i.city, i.state].filter(Boolean).join(" — ") || "—"}</span>,
    },
    {
      key: "action", label: "",
      render: (i) => (
        <div className={styles.rowActions}>
          {canWrite && <button className={styles.iconBtn} onClick={() => openEdit(i)}>Editar</button>}
          {canDelete && <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setConfirmDelete(i)}>Excluir</button>}
          {!canWrite && <span className={styles.muted}>—</span>}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Instituições</h1>
          <p className={styles.subtitle}>Cadastro de instituições (hospitais, IML, igrejas…) por cidade</p>
        </div>
        <div className={styles.actions}>
          {canWrite && (
            <Button onClick={openNew}
              iconLeft={
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              }
            >
              Nova instituição
            </Button>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Instituições cadastradas" value={String(total)} caption="referências da cidade" />
      </div>

      {!canWrite && !loading && !error && (
        <Alert tone="info">
          Você tem acesso somente de leitura a esta área — apenas administradores e operadores podem cadastrar ou editar.
        </Alert>
      )}

      {notice && <Alert tone={notice.tone}>{notice.message}</Alert>}

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input
            placeholder="Buscar por nome, tipo, cidade ou CNPJ…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className={styles.desktopTable}>
          <Skeleton variant="row" count={6} />
        </div>
      ) : error ? (
        <ErrorState onRetry={refetch} />
      ) : !rows.length ? (
        <EmptyState
          title={isFiltered ? "Nenhuma instituição encontrada" : "Nenhuma instituição cadastrada"}
          message={
            isFiltered
              ? "Ajuste o termo de busca para encontrar a instituição."
              : "Comece cadastrando a primeira instituição desta cidade."
          }
          action={!isFiltered && canWrite ? <Button onClick={openNew}>Nova instituição</Button> : undefined}
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable columns={columns} rows={rows} rowKey={(i) => i.id} emptyMessage="Nenhuma instituição encontrada." />
          </div>

          <div className={styles.mobileList}>
            <span className={styles.mobileCount}>{rows.length} instituição(ões)</span>
            {rows.map((i) => (
              <button key={i.id} className={styles.mobileCard} onClick={() => (canWrite ? openEdit(i) : undefined)}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.rowName}>{i.name}</span>
                  {i.type ? <Badge tone="neutral">{i.type}</Badge> : <Badge tone="navy">{i.state || "—"}</Badge>}
                </div>
                <div className={styles.mobileCardBody}>
                  <span>{[i.city, i.state].filter(Boolean).join(" — ") || "—"}</span>
                  {i.phone && <span className={styles.mono}>{i.phone}</span>}
                </div>
                {canWrite && (
                  <span className={styles.mobileCardChevron}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}

      {/* ---------- nova / editar ---------- */}
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar · ${form.name}` : "Nova instituição"}
        subtitle="Cadastro de referência da cidade"
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button loading={saving} onClick={submit}>
              {form?.id ? "Salvar alterações" : "Cadastrar instituição"}
            </Button>
          </>
        }
      >
        {form && (
          <div className={styles.form}>
            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Identificação</span>
              <div className={styles.formGrid}>
                <FormField label="Nome" required className={styles.spanTwo}>
                  <Input value={form.name} placeholder="Hospital, IML, igreja…"
                    onChange={(e) => setField("name", e.target.value)} />
                </FormField>
                <FormField label="Tipo">
                  <Input value={form.type} placeholder="Hospital, IML, Igreja…"
                    onChange={(e) => setField("type", e.target.value)} />
                </FormField>
                <FormField label="CNPJ">
                  <Input value={form.cnpj} placeholder="00.000.000/0000-00"
                    onChange={(e) => setField("cnpj", maskCnpj(e.target.value))} />
                </FormField>
                <FormField label="Telefone">
                  <Input value={form.phone} placeholder="(00) 0000-0000"
                    onChange={(e) => setField("phone", maskPhone(e.target.value))} />
                </FormField>
                <FormField label="E-mail">
                  <Input type="email" value={form.email} placeholder="contato@exemplo.com"
                    onChange={(e) => setField("email", e.target.value)} />
                </FormField>
              </div>
            </section>

            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Endereço</span>
              <div className={styles.formGrid}>
                <FormField label="Logradouro" className={styles.spanTwo}>
                  <Input value={form.street} placeholder="Rua, número · bairro"
                    onChange={(e) => setField("street", e.target.value)} />
                </FormField>
                <FormField label="Estado (UF)">
                  <Input value={form.state} placeholder="SP" maxLength={2}
                    onChange={(e) => setField("state", e.target.value.toUpperCase())} />
                </FormField>
                <FormField label="Município">
                  <Input value={form.city} placeholder="Guarulhos"
                    onChange={(e) => setField("city", e.target.value)} />
                </FormField>
                <FormField label="Observações" className={styles.spanTwo}>
                  <Textarea rows={3} value={form.notes} placeholder="Contexto, contatos, observações…"
                    onChange={(e) => setField("notes", e.target.value)} />
                </FormField>
              </div>
            </section>
          </div>
        )}
      </Modal>

      {/* ---------- confirmar exclusão ---------- */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Excluir instituição"
        subtitle={confirmDelete?.name}
        width={460}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="danger" loading={deleteM.loading} onClick={doDelete}>Excluir</Button>
          </>
        }
      >
        <p>Tem certeza que deseja excluir <strong>{confirmDelete?.name}</strong>? Esta ação pode ser desfeita apenas pelo suporte.</p>
      </Modal>
    </div>
  );
}
