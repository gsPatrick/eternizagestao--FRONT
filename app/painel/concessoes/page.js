"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Pagination from "@/components/molecules/Pagination/Pagination";
import StatCard from "@/components/molecules/StatCard/StatCard";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import FormField from "@/components/molecules/FormField/FormField";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource } from "@/lib/api/useResource";
import { listConcessions, getConcessionsSummary, issueConcession } from "@/lib/api/resources/concessions";
import { listGraves } from "@/lib/api/resources/graves";
import { listPeople } from "@/lib/api/resources/people";

// "Hoje" REAL — antes era fixo em 16/07/2026, congelando "vence em X meses".
const TODAY = new Date();

const STATUS_META = {
  ativa: { label: "Ativa", tone: "success" },
  vencida: { label: "Vencida", tone: "danger" },
  transferida: { label: "Transferida", tone: "neutral" },
  encerrada: { label: "Encerrada", tone: "neutral" },
  cancelada: { label: "Cancelada", tone: "danger" },
};

const TYPE_META = {
  perpetua: { label: "Perpétua", tone: "inverse" },
  temporaria: { label: "Temporária", tone: "navy" },
};

// "YYYY-MM-DD" → "DD/MM/YYYY" (o layout usa datas no formato BR)
function isoToBr(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function parseBr(date) {
  const [d, m, y] = date.split("/").map(Number);
  return new Date(y, m - 1, d);
}

function monthsUntil(end) {
  if (!end) return null;
  return Math.round((parseBr(end) - TODAY) / (1000 * 60 * 60 * 24 * 30.44));
}

// Adapta a linha da API para o shape que o layout consome.
function toRow(c) {
  return {
    id: c.id,
    contract: c.contractNumber || `#${String(c.id).slice(0, 8)}`,
    owner: c.person?.fullName || "—",
    cpf: c.person?.cpf || "",
    responsible: c.responsible?.fullName || null,
    grave: c.grave?.code || "—",
    graveId: c.grave?.id || c.graveId,
    type: c.concessionType,
    start: isoToBr(c.startDate),
    end: isoToBr(c.endDate),
    status: c.status,
  };
}

function expiryInfo(row) {
  if (row.type === "perpetua") return { text: "Sem vencimento", tone: null };
  if (row.status !== "ativa") return { text: row.end ? `Até ${row.end}` : "—", tone: null };
  const months = monthsUntil(row.end);
  if (months === null) return { text: "—", tone: null };
  if (months < 0) return { text: "Vencida", tone: "danger" };
  if (months <= 6) return { text: `Vence em ${months} ${months === 1 ? "mês" : "meses"}`, tone: "danger" };
  if (months <= 12) return { text: `Vence em ${months} meses`, tone: "warning" };
  return { text: `Vence em ${row.end.slice(-4)}`, tone: null };
}

const PER_PAGE = 30;

export default function ConcessionsListPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [newType, setNewType] = useState("perpetua");
  // formulário de emissão de concessão (proprietário + responsável legal)
  const emptyForm = {
    graveId: "",
    personId: "",
    responsiblePersonId: "",
    startDate: "2026-07-16",
    endDate: "",
    value: "",
    contractNumber: "",
  };
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const setF = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // fontes dos pickers (jazigos e pessoas do tenant)
  const gravesRes = useResource(({ signal }) => listGraves({ perPage: 500 }, { signal }), []);
  const peopleRes = useResource(({ signal }) => listPeople({ perPage: 500 }, { signal }), []);
  const graveOptions = useMemo(() => gravesRes.data?.data ?? [], [gravesRes.data]);
  const peopleOptions = useMemo(() => peopleRes.data?.data ?? [], [peopleRes.data]);

  async function submitConcession() {
    if (!form.graveId || !form.personId) {
      setFormError("Selecione o jazigo e o concessionário (proprietário).");
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const rawValue = String(form.value || "").replace(/[^\d.,]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".");
      await issueConcession(form.graveId, {
        personId: form.personId,
        responsiblePersonId: form.responsiblePersonId || undefined,
        concessionType: newType,
        startDate: form.startDate || undefined,
        endDate: newType === "temporaria" ? form.endDate || undefined : undefined,
        value: rawValue ? Number(rawValue) : undefined,
        contractNumber: form.contractNumber || undefined,
      });
      setModalOpen(false);
      setForm(emptyForm);
      refetch();
      summaryRes.refetch();
    } catch (e) {
      setFormError(e?.message || "Não foi possível emitir a concessão.");
    } finally {
      setSubmitting(false);
    }
  }

  // debounce da busca (evita um request por tecla)
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const summaryRes = useResource(({ signal }) => getConcessionsSummary({ signal }), []);
  const summary = summaryRes.data;

  const listParams = useMemo(
    () => ({
      page,
      perPage: PER_PAGE,
      status: statusFilter || undefined,
      type: typeFilter || undefined,
      search: debouncedSearch || undefined,
    }),
    [page, statusFilter, typeFilter, debouncedSearch]
  );

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listConcessions(listParams, { signal }),
    [listParams]
  );

  const rows = useMemo(() => (data?.data ?? []).map(toRow), [data]);
  const meta = data?.meta;
  const totalPages = meta?.totalPages || 1;
  const totalItems = meta?.totalItems ?? rows.length;

  const stats = {
    active: summary?.active ?? 0,
    perpetual: summary?.perpetual ?? 0,
    expiring: summary?.expiring ?? 0,
    expired: summary?.expired ?? 0,
    total: summary?.total ?? 0,
    byStatus: summary?.byStatus ?? {},
  };
  const nf = (n) => Number(n || 0).toLocaleString("pt-BR");
  const activePct = stats.total ? Math.round((stats.active / stats.total) * 100) : 0;

  function setStatus(value) {
    setStatusFilter((prev) => (prev === value ? "" : value));
    setPage(1);
  }

  function renderTableBody() {
    if (loading) return <Skeleton variant="row" count={6} />;
    if (error) return <ErrorState onRetry={refetch} />;
    if (!rows.length) {
      return (
        <EmptyState
          title="Nenhuma concessão registrada"
          message={
            debouncedSearch || statusFilter || typeFilter
              ? "Nenhum contrato corresponde aos filtros aplicados. Ajuste a busca para ver outros resultados."
              : "Emita a primeira concessão para vincular um titular a um jazigo deste cemitério."
          }
        />
      );
    }
    return (
      <DataTable
        columns={[
          { key: "contract", label: "Contrato", render: (row) => <code className={styles.code}>{row.contract}</code> },
          {
            key: "owner",
            label: "Concessionário",
            render: (row) => (
              <span className={styles.personCell}>
                <Avatar name={row.owner} size="sm" />
                <span className={styles.personInfo}>
                  <span className={styles.personName}>{row.owner}</span>
                  <span className={styles.personCpf}>
                    {row.responsible ? `resp.: ${row.responsible}` : row.cpf}
                  </span>
                </span>
              </span>
            ),
          },
          {
            key: "grave",
            label: "Jazigo",
            render: (row) => (
              <Link href={`/painel/sepulturas/${row.graveId}`} className={styles.graveLink}>
                {row.grave}
              </Link>
            ),
          },
          { key: "type", label: "Tipo", render: (row) => <Badge tone={TYPE_META[row.type]?.tone}>{TYPE_META[row.type]?.label}</Badge> },
          {
            key: "validity",
            label: "Vigência",
            render: (row) => {
              const info = expiryInfo(row);
              return (
                <span className={styles.validity}>
                  <span>Desde {row.start}</span>
                  <span className={`${styles.validitySub} ${info.tone ? styles[`validity_${info.tone}`] : ""}`}>
                    {info.text}
                  </span>
                </span>
              );
            },
          },
          { key: "status", label: "Situação", render: (row) => <Badge tone={STATUS_META[row.status]?.tone} dot>{STATUS_META[row.status]?.label}</Badge> },
          {
            key: "actions",
            label: "",
            align: "right",
            render: (row) => (
              <Link href={`/painel/concessoes/${row.id}`} className={styles.detailLink}>Detalhes</Link>
            ),
          },
        ]}
        rows={rows}
        footer={
          <>
            <span>{nf(rows.length)} de {nf(totalItems)} contratos</span>
            <Pagination page={page} totalPages={totalPages} onChange={setPage} />
          </>
        }
      />
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Concessões</h1>
          <p className={styles.subtitle}>{nf(stats.total)} contratos registrados</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button
            onClick={() => setModalOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Nova concessão
          </Button>
        </div>
      </header>

      <section className={styles.stats}>
        <StatCard label="Concessões ativas" value={nf(stats.active)} caption={`${activePct}% do total`} />
        <StatCard label="Perpétuas" value={nf(stats.perpetual)} caption="entre as ativas" />
        <StatCard label="A vencer em 12 meses" value={nf(stats.expiring)} deltaTone="danger" caption="exigem renovação" />
        <StatCard label="Vencidas" value={nf(stats.expired)} deltaTone="danger" caption="pendentes de regularização" />
      </section>

      {stats.expiring > 0 && (
        <Alert tone="warning" title={`${stats.expiring} concessão(ões) temporária(s) vencem nos próximos 12 meses`}>
          Os titulares serão notificados automaticamente por WhatsApp. Use o filtro
          “A vencer” para revisar e renovar os contratos.
        </Alert>
      )}

      <div className={styles.statusChips}>
        <button className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`} onClick={() => { setStatusFilter(""); setPage(1); }}>
          Todas <span className={styles.chipCount}>{nf(stats.total)}</span>
        </button>
        <button className={`${styles.chip} ${statusFilter === "a_vencer" ? styles.chipActive : ""}`} onClick={() => setStatus("a_vencer")}>
          <span className={`${styles.chipDot} ${styles.dot_warning}`} />
          A vencer
          <span className={styles.chipCount}>{nf(stats.expiring)}</span>
        </button>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <button
            key={key}
            className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
            onClick={() => setStatus(key)}
          >
            <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
            {meta.label}
            <span className={styles.chipCount}>{nf(stats.byStatus[key] ?? 0)}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input
            placeholder="Buscar por concessionário, CPF, contrato ou jazigo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
        <div className={styles.filters}>
          <Select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">Todos os tipos</option>
            <option value="perpetua">Perpétua</option>
            <option value="temporaria">Temporária</option>
          </Select>
        </div>
      </div>

      <div className={styles.desktopTable}>
        {renderTableBody()}
      </div>

      <div className={styles.mobileList}>
        {loading && <Skeleton variant="card" count={4} />}
        {!loading && error && <ErrorState onRetry={refetch} />}
        {!loading && !error && !rows.length && (
          <EmptyState title="Nenhuma concessão registrada" message="Nenhum contrato corresponde aos filtros aplicados." />
        )}
        {!loading && !error && rows.map((row) => {
          const info = expiryInfo(row);
          return (
            <Link key={row.id} href={`/painel/concessoes/${row.id}`} className={styles.mobileCard}>
              <div className={styles.mobileCardTop}>
                <code className={styles.code}>{row.contract}</code>
                <Badge tone={STATUS_META[row.status]?.tone} dot>{STATUS_META[row.status]?.label}</Badge>
              </div>
              <div className={styles.mobileCardBody}>
                <span className={styles.mobileCardName}>{row.owner}</span>
                <span className={styles.mobileCardMeta}>
                  {row.grave} · {TYPE_META[row.type]?.label} ·{" "}
                  <span className={info.tone ? styles[`validity_${info.tone}`] : ""}>{info.text}</span>
                </span>
              </div>
              <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          );
        })}
        {!loading && !error && rows.length > 0 && (
          <p className={styles.mobileCount}>{nf(rows.length)} de {nf(totalItems)} contratos</p>
        )}
      </div>

      {/* ---- nova concessão (PDF 3.2: tipo + vigência + concessionário responsável) ---- */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova concessão"
        subtitle="Emita um contrato vinculando um titular a um jazigo sem concessão ativa"
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button
              loading={submitting}
              disabled={!form.graveId || !form.personId}
              onClick={submitConcession}
            >
              Emitir concessão
            </Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); submitConcession(); }}>
          <div className={styles.formGrid}>
            <FormField label="Jazigo" required hint="A unidade não pode ter concessão ativa">
              <Select
                value={form.graveId}
                onChange={(e) => setF("graveId", e.target.value)}
                disabled={gravesRes.loading}
              >
                <option value="" disabled>
                  {gravesRes.loading ? "Carregando jazigos…" : "Selecione a unidade…"}
                </option>
                {graveOptions.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code}{g.status?.name ? ` · ${g.status.name}` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Concessionário (proprietário)" required hint="Titular legal da concessão">
              <Select
                value={form.personId}
                onChange={(e) => setF("personId", e.target.value)}
                disabled={peopleRes.loading}
              >
                <option value="" disabled>
                  {peopleRes.loading ? "Carregando pessoas…" : "Selecione a pessoa…"}
                </option>
                {peopleOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}{p.cpf ? ` · ${p.cpf}` : ""}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Responsável legal" hint="Opcional — quem responde pelo jazigo (pode diferir do proprietário)">
              <Select
                value={form.responsiblePersonId}
                onChange={(e) => setF("responsiblePersonId", e.target.value)}
                disabled={peopleRes.loading}
              >
                <option value="">Sem responsável distinto</option>
                {peopleOptions
                  .filter((p) => p.id !== form.personId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}{p.cpf ? ` · ${p.cpf}` : ""}
                    </option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Tipo de concessão" required>
              <Select value={newType} onChange={(e) => setNewType(e.target.value)}>
                <option value="perpetua">Perpétua</option>
                <option value="temporaria">Temporária</option>
              </Select>
            </FormField>
            <FormField label="Início da vigência" required>
              <Input type="date" value={form.startDate} onChange={(e) => setF("startDate", e.target.value)} />
            </FormField>
            {newType === "temporaria" && (
              <FormField label="Fim da vigência" required hint="Validade da concessão temporária">
                <Input type="date" value={form.endDate} onChange={(e) => setF("endDate", e.target.value)} />
              </FormField>
            )}
            <FormField label="Nº do contrato" hint="Opcional">
              <Input
                placeholder="CON-2026-0001"
                value={form.contractNumber}
                onChange={(e) => setF("contractNumber", e.target.value)}
              />
            </FormField>
            <FormField label="Valor da concessão">
              <Input
                placeholder="R$ 0,00"
                inputMode="decimal"
                value={form.value}
                onChange={(e) => setF("value", e.target.value)}
              />
            </FormField>
          </div>
          {formError && <Alert tone="danger">{formError}</Alert>}
        </form>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="concessões"
        totalCount={stats.total}
        filteredCount={totalItems}
      />
    </div>
  );
}
