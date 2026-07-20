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

import { maskPhone, maskCpf } from "@/lib/masks";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import {
  listFunerarias,
  createFuneraria,
  updateFuneraria,
  deleteFuneraria,
  toFunerariaRow,
  toFunerariaPayload,
} from "@/lib/api/resources/funerarias";

// Máscara de CNPJ (00.000.000/0000-00) — telefone/CPF reaproveitam lib/masks.
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
  name: "", cnpj: "", phone: "", email: "",
  street: "", district: "", state: "", city: "",
  contactName: "", contactCpf: "", contactPhone: "", contactEmail: "", contactAddress: "",
  notes: "",
};

export default function FunerariasPage() {
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
    ({ signal }) => listFunerarias(listParams, { signal }),
    [listParams]
  );

  const rows = useMemo(() => (data?.data ?? []).map(toFunerariaRow), [data]);
  const total = data?.meta?.totalItems ?? rows.length;
  const isFiltered = query.trim().length > 0;

  const saveM = useMutation((body) =>
    form?.id ? updateFuneraria(form.id, body) : createFuneraria(body)
  );
  const deleteM = useMutation((id) => deleteFuneraria(id));
  const saving = saveM.loading;

  function flash(message, tone = "success") {
    setNotice({ tone, message });
    setTimeout(() => setNotice(null), 4500);
  }

  function openNew() { setForm({ ...EMPTY_FORM }); }
  function openEdit(row) { setForm({ ...row }); }
  function setField(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  async function submit() {
    const required = [
      ["name", "o nome"], ["cnpj", "o CNPJ"], ["phone", "o telefone"],
      ["street", "o logradouro"], ["district", "o bairro"],
      ["state", "o estado (UF)"], ["city", "o município"],
    ];
    for (const [k, label] of required) {
      if (!String(form[k] || "").trim()) return flash(`Informe ${label}.`, "danger");
    }
    try {
      const editing = Boolean(form.id);
      await saveM.mutate(toFunerariaPayload(form));
      setForm(null);
      await refetch();
      flash(editing ? "Funerária atualizada." : "Funerária cadastrada com sucesso.");
    } catch (e) {
      flash(e?.message || "Não foi possível salvar a funerária.", "danger");
    }
  }

  async function doDelete() {
    try {
      await deleteM.mutate(confirmDelete.id);
      setConfirmDelete(null);
      await refetch();
      flash("Funerária excluída.");
    } catch (e) {
      flash(e?.message || "Não foi possível excluir a funerária.", "danger");
    }
  }

  const columns = [
    {
      key: "name", label: "Nome",
      render: (f) => (
        <div className={styles.cellStack}>
          <span className={styles.rowName}>{f.name}</span>
          {f.cnpj && <span className={styles.rowSub}>{f.cnpj}</span>}
        </div>
      ),
    },
    {
      key: "contact", label: "Contato",
      render: (f) => (
        <div className={styles.cellStack}>
          <span className={styles.rowName}>{f.contactName || "—"}</span>
          {(f.contactPhone || f.phone) && <span className={styles.rowSub}>{f.contactPhone || f.phone}</span>}
        </div>
      ),
    },
    { key: "phone", label: "Telefone", render: (f) => <span className={styles.mono}>{f.phone || "—"}</span> },
    {
      key: "city", label: "Cidade / UF",
      render: (f) => <span className={styles.cityCell}>{[f.city, f.state].filter(Boolean).join(" — ") || "—"}</span>,
    },
    {
      key: "action", label: "",
      render: (f) => (
        <div className={styles.rowActions}>
          {canWrite && <button className={styles.iconBtn} onClick={() => openEdit(f)}>Editar</button>}
          {canDelete && <button className={`${styles.iconBtn} ${styles.iconBtnDanger}`} onClick={() => setConfirmDelete(f)}>Excluir</button>}
          {!canWrite && <span className={styles.muted}>—</span>}
        </div>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Funerárias</h1>
          <p className={styles.subtitle}>Cadastro de funerárias parceiras por cidade</p>
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
              Nova funerária
            </Button>
          )}
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Funerárias cadastradas" value={String(total)} caption="parceiras da cidade" />
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
            placeholder="Buscar por nome, CNPJ, cidade ou contato…"
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
          title={isFiltered ? "Nenhuma funerária encontrada" : "Nenhuma funerária cadastrada"}
          message={
            isFiltered
              ? "Ajuste o termo de busca para encontrar a funerária."
              : "Comece cadastrando a primeira funerária desta cidade."
          }
          action={!isFiltered && canWrite ? <Button onClick={openNew}>Nova funerária</Button> : undefined}
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable columns={columns} rows={rows} rowKey={(f) => f.id} emptyMessage="Nenhuma funerária encontrada." />
          </div>

          <div className={styles.mobileList}>
            <span className={styles.mobileCount}>{rows.length} funerária(s)</span>
            {rows.map((f) => (
              <button key={f.id} className={styles.mobileCard} onClick={() => (canWrite ? openEdit(f) : undefined)}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.rowName}>{f.name}</span>
                  <Badge tone="navy">{f.state || "—"}</Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span>{[f.city, f.district].filter(Boolean).join(" · ") || "—"}</span>
                  {f.phone && <span className={styles.mono}>{f.phone}</span>}
                  {f.contactName && <span>Contato: {f.contactName}</span>}
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
        title={form?.id ? `Editar · ${form.name}` : "Nova funerária"}
        subtitle="Dados da funerária e da pessoa de contato"
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button>
            <Button loading={saving} onClick={submit}>
              {form?.id ? "Salvar alterações" : "Cadastrar funerária"}
            </Button>
          </>
        }
      >
        {form && (
          <div className={styles.form}>
            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Dados da funerária</span>
              <div className={styles.formGrid}>
                <FormField label="Nome" required className={styles.spanTwo}>
                  <Input value={form.name} placeholder="Funerária…"
                    onChange={(e) => setField("name", e.target.value)} />
                </FormField>
                <FormField label="CNPJ" required>
                  <Input value={form.cnpj} placeholder="00.000.000/0000-00"
                    onChange={(e) => setField("cnpj", maskCnpj(e.target.value))} />
                </FormField>
                <FormField label="Telefone" required>
                  <Input value={form.phone} placeholder="(00) 0000-0000"
                    onChange={(e) => setField("phone", maskPhone(e.target.value))} />
                </FormField>
                <FormField label="E-mail" className={styles.spanTwo}>
                  <Input type="email" value={form.email} placeholder="contato@funeraria.com"
                    onChange={(e) => setField("email", e.target.value)} />
                </FormField>
              </div>
            </section>

            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Endereço</span>
              <div className={styles.formGrid}>
                <FormField label="Logradouro" required className={styles.spanTwo}>
                  <Input value={form.street} placeholder="Rua, número"
                    onChange={(e) => setField("street", e.target.value)} />
                </FormField>
                <FormField label="Bairro" required>
                  <Input value={form.district} placeholder="Centro"
                    onChange={(e) => setField("district", e.target.value)} />
                </FormField>
                <FormField label="Estado (UF)" required>
                  <Input value={form.state} placeholder="SP" maxLength={2}
                    onChange={(e) => setField("state", e.target.value.toUpperCase())} />
                </FormField>
                <FormField label="Município" required>
                  <Input value={form.city} placeholder="Guarulhos"
                    onChange={(e) => setField("city", e.target.value)} />
                </FormField>
              </div>
            </section>

            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Contato</span>
              <div className={styles.formGrid}>
                <FormField label="Nome do contato">
                  <Input value={form.contactName} placeholder="Nome e sobrenome"
                    onChange={(e) => setField("contactName", e.target.value)} />
                </FormField>
                <FormField label="CPF do contato">
                  <Input value={form.contactCpf} placeholder="000.000.000-00"
                    onChange={(e) => setField("contactCpf", maskCpf(e.target.value))} />
                </FormField>
                <FormField label="Telefone do contato">
                  <Input value={form.contactPhone} placeholder="(00) 00000-0000"
                    onChange={(e) => setField("contactPhone", maskPhone(e.target.value))} />
                </FormField>
                <FormField label="E-mail do contato">
                  <Input type="email" value={form.contactEmail} placeholder="contato@exemplo.com"
                    onChange={(e) => setField("contactEmail", e.target.value)} />
                </FormField>
                <FormField label="Endereço do contato" className={styles.spanTwo}>
                  <Input value={form.contactAddress} placeholder="Endereço do responsável"
                    onChange={(e) => setField("contactAddress", e.target.value)} />
                </FormField>
              </div>
            </section>

            <section className={styles.formSection}>
              <span className={styles.sectionLabel}>Observação</span>
              <FormField label="Observações">
                <Textarea rows={3} value={form.notes} placeholder="Convênios, horários, contexto…"
                  onChange={(e) => setField("notes", e.target.value)} />
              </FormField>
            </section>
          </div>
        )}
      </Modal>

      {/* ---------- confirmar exclusão ---------- */}
      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        title="Excluir funerária"
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
