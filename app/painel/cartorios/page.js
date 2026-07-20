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
  listCartorios,
  createCartorio,
  updateCartorio,
  deleteCartorio,
  toCartorioRow,
  toCartorioPayload,
} from "@/lib/api/resources/cartorios";

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
  name: "", state: "", city: "", cnpj: "", phone: "", email: "", street: "", notes: "",
};

export default function CartoriosPage() {
  const currentUser = useMemo(() => getUser(), []);
  const canWrite = ["admin", "operador", "super_admin"].includes(currentUser?.role);
  const canDelete = ["admin", "super_admin"].includes(currentUser?.role);

  const [query, setQuery] = useState("");
  const [form, setForm] = useState(null); // { ...fields, id? }
  const [confirmDelete, setConfirmDelete] = useState(null); // row
  const [notice, setNotice] = useState(null); // { tone, message }

  const listParams = useMemo(() => {
    const p = { perPage: 100 };
    const q = query.trim();
    if (q) p.search = q;
    return p;
  }, [query]);

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listCartorios(listParams, { signal }),
    [listParams]
  );

  const rows = useMemo(() => (data?.data ?? []).map(toCartorioRow), [data]);
  const total = data?.meta?.totalItems ?? rows.length;
  const isFiltered = query.trim().length > 0;

  const saveM = useMutation((body) =>
    form?.id ? updateCartorio(form.id, body) : createCartorio(body)
  );
  const deleteM = useMutation((id) => deleteCartorio(id));
  const saving = saveM.loading;

  function flash(message, tone = "success") {
    setNotice({ tone, message });
    setTimeout(() => setNotice(null), 4500);
  }

  function openNew() { setForm({ ...EMPTY_FORM }); }
  function openEdit(row) { setForm({ ...row }); }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    if (!form.name.trim()) return flash("Informe o nome do cartório.", "danger");
    if (!form.state.trim()) return flash("Informe o estado (UF).", "danger");
    if (!form.city.trim()) return flash("Informe o município.", "danger");
    try {
      const editing = Boolean(form.id);
      await saveM.mutate(toCartorioPayload(form));
      setForm(null);
      await refetch();
      flash(editing ? "Cartório atualizado." : "Cartório cadastrado com sucesso.");
    } catch (e) {
      flash(e?.message || "Não foi possível salvar o cartório.", "danger");
    }
  }

  async function doDelete() {
    try {
      await deleteM.mutate(confirmDelete.id);
      setConfirmDelete(null);
      await refetch();
      flash("Cartório excluído.");
    } catch (e) {
      flash(e?.message || "Não foi possível excluir o cartório.", "danger");
    }
  }

  const columns = [
    {
      key: "name", label: "Nome",
      render: (c) => (
        <div className={styles.cellStack}>
          <span className={styles.rowName}>{c.name}</span>
          {c.street && <span className={styles.rowSub}>{c.street}</span>}
        </div>
      ),
    },
    { key: "state", label: "Estado", render: (c) => <span className={styles.uf}>{c.state || "—"}</span> },
    { key: "city", label: "Município", render: (c) => <span className={styles.cityCell}>{c.city || "—"}</span> },
    {
      key: "cnpj", label: "CNPJ",
      render: (c) => (c.cnpj ? <span className={styles.mono}>{c.cnpj}</span> : <span className={styles.muted}>—</span>),
    },
    {
      key: "phone", label: "Telefone",
      render: (c) => (c.phone ? <span className={styles.mono}>{c.phone}</span> : <span className={styles.muted}>—</span>),
    },
    {
      key: "action", label: "",
      render: (c) => (
        <div className={styles.rowActions}>
          {canWrite && <button className={styles.iconBtn} onClick={() => openEdit(c)}>Editar</button>}
          {canDelete && <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setConfirmDelete(c)}>Excluir</button>}
          {!canWrite && <span className={styles.muted}>—</span>}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Cartórios</h1>
          <p className={styles.subtitle}>Cadastro de cartórios de registro civil por cidade</p>
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
              Novo cartório
            </Button>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Cartórios cadastrados" value={String(total)} caption="registro civil por cidade" />
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
            placeholder="Buscar por nome, município ou CNPJ…"
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
          title={isFiltered ? "Nenhum cartório encontrado" : "Nenhum cartório cadastrado"}
          message={
            isFiltered
              ? "Ajuste o termo de busca para encontrar o cartório."
              : "Comece cadastrando o primeiro cartório desta cidade."
          }
          action={!isFiltered && canWrite ? <Button onClick={openNew}>Novo cartório</Button> : undefined}
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable columns={columns} rows={rows} rowKey={(c) => c.id} emptyMessage="Nenhum cartório encontrado." />
          </div>

          <div className={styles.mobileList}>
            <span className={styles.mobileCount}>{rows.length} cartório(s)</span>
            {rows.map((c) => (
              <button key={c.id} className={styles.mobileCard} onClick={() => (canWrite ? openEdit(c) : undefined)}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.rowName}>{c.name}</span>
                  <Badge tone="navy">{c.state || "—"}</Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span>{c.city || "—"}</span>
                  {c.cnpj && <span className={styles.mono}>{c.cnpj}</span>}
                  {c.phone && <span className={styles.mono}>{c.phone}</span>}
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

      {/* ---------- novo / editar ---------- */}
      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? `Editar · ${form.name}` : "Novo cartório"}
        subtitle="Cadastro de referência usado nos documentos e registros"
        width={640}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button loading={saving} onClick={submit}>
              {form?.id ? "Salvar alterações" : "Cadastrar cartório"}
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
                  <Input value={form.name} placeholder="1º Cartório de Registro Civil"
                    onChange={(e) => setField("name", e.target.value)} />
                </FormField>
                <FormField label="Estado (UF)" required>
                  <Input value={form.state} placeholder="SP" maxLength={2}
                    onChange={(e) => setField("state", e.target.value.toUpperCase())} />
                </FormField>
                <FormField label="Município" required>
                  <Input value={form.city} placeholder="Guarulhos"
                    onChange={(e) => setField("city", e.target.value)} />
                </FormField>
                <FormField label="CNPJ">
                  <Input value={form.cnpj} placeholder="00.000.000/0000-00"
                    onChange={(e) => setField("cnpj", maskCnpj(e.target.value))} />
                </FormField>
                <FormField label="Telefone">
                  <Input value={form.phone} placeholder="(00) 0000-0000"
                    onChange={(e) => setField("phone", maskPhone(e.target.value))} />
                </FormField>
              </div>
            </section>

            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Contato & endereço</span>
              <div className={styles.formGrid}>
                <FormField label="E-mail" className={styles.spanTwo}>
                  <Input type="email" value={form.email} placeholder="cartorio@exemplo.com"
                    onChange={(e) => setField("email", e.target.value)} />
                </FormField>
                <FormField label="Logradouro" className={styles.spanTwo}>
                  <Input value={form.street} placeholder="Rua, número · bairro"
                    onChange={(e) => setField("street", e.target.value)} />
                </FormField>
                <FormField label="Observações" className={styles.spanTwo}>
                  <Textarea rows={3} value={form.notes} placeholder="Horário, competência, contexto…"
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
        title="Excluir cartório"
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
