"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Switch from "@/components/atoms/Switch/Switch";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Tabs from "@/components/molecules/Tabs/Tabs";
import StatCard from "@/components/molecules/StatCard/StatCard";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import { getUser } from "@/lib/api/session";
import RowActions from "@/components/molecules/RowActions/RowActions";
import ConfirmDelete from "@/components/molecules/ConfirmDelete/ConfirmDelete";
import {
  listFeeTypes, createFeeType, updateFeeType, deleteFeeType,
  listFees, createFee, adjustFee, batchAdjustFees,
  suspendFee, reactivateFee, terminateFee,
  listGraveOptions, listPayerOptions,
} from "@/lib/api/resources/fees";

const STATUS_META = {
  ativa: { label: "Ativa", tone: "success" },
  suspensa: { label: "Suspensa", tone: "warning" },
  encerrada: { label: "Encerrada", tone: "neutral" },
};

const PERIOD_META = {
  mensal: "Mensal",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

const PERIOD_FACTOR = { mensal: 12, trimestral: 4, semestral: 2, anual: 1, unica: 0 };

function money(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// "YYYY-MM-DD" → "DD/MM/YYYY"
function fmtDate(d) {
  if (!d) return "—";
  const [y, m, day] = String(d).slice(0, 10).split("-");
  return `${day}/${m}/${y}`;
}

// "YYYY-MM-DD" → "MM/YYYY" (histórico de reajustes)
function fmtMonth(d) {
  if (!d) return "";
  const [y, m] = String(d).slice(0, 10).split("-");
  return `${m}/${y}`;
}

function parsePercent(text) {
  const n = parseFloat(String(text).replace("%", "").replace("+", "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : null;
}

function daysUntil(dateStr) {
  if (!dateStr) return null;
  const due = new Date(`${String(dateStr).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((due - today) / 86400000);
}

// API MaintenanceFee → shape que a página consome.
function mapFee(f) {
  return {
    id: f.id,
    grave: f.grave?.code ?? "—",
    graveId: f.graveId,
    type: f.feeType?.name ?? "—",
    payer: f.payer?.fullName ?? "—",
    amount: Number(f.amount),
    periodicity: f.periodicity,
    nextDue: fmtDate(f.nextDueDate),
    nextDueRaw: f.nextDueDate || null,
    status: f.status,
    adjusts: (Array.isArray(f.adjustments) ? f.adjustments : []).map((a) => ({
      date: fmtMonth(a.date),
      from: Number(a.from),
      to: Number(a.to),
      reason: a.reason || "—",
    })),
  };
}

// API FeeType → shape do catálogo.
function mapType(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description || "—",
    amount: Number(t.defaultAmount ?? 0),
    periodicity: t.periodicity,
    inUse: t.inUse ?? 0,
    active: t.active,
  };
}

export default function FeesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [applyOpen, setApplyOpen] = useState(false);
  const [newTypeOpen, setNewTypeOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [batchOpen, setBatchOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [adjustForm, setAdjustForm] = useState({ value: "", reason: "IPCA 2026 (+4,8%)" });
  const [applyType, setApplyType] = useState("");

  // ---- dados da API ----
  const feesQ = useResource(({ signal }) => listFees({ perPage: 200 }, { signal }), []);
  const typesQ = useResource(({ signal }) => listFeeTypes({ signal }), []);
  const gravesQ = useResource(({ signal }) => listGraveOptions({ signal }), []);
  const peopleQ = useResource(({ signal }) => listPayerOptions({ signal }), []);

  const fees = useMemo(() => (feesQ.data?.data ?? []).map(mapFee), [feesQ.data]);
  const types = useMemo(() => (typesQ.data ?? []).map(mapType), [typesQ.data]);
  const graves = gravesQ.data?.data ?? [];
  const people = peopleQ.data?.data ?? [];

  // ---- mutations (useMutation + refetch) ----
  const createTypeM = useMutation(createFeeType);
  const updateTypeM = useMutation(updateFeeType);
  const createFeeM = useMutation(createFee);
  const adjustM = useMutation(adjustFee);
  const suspendM = useMutation(suspendFee);
  const reactivateM = useMutation(reactivateFee);
  const terminateM = useMutation(terminateFee);
  const batchM = useMutation(batchAdjustFees);

  const detail = detailId ? fees.find((f) => f.id === detailId) : null;

  const filtered = useMemo(() => {
    return fees.filter((row) => {
      const term = search.trim().toLowerCase();
      if (term && !row.payer.toLowerCase().includes(term) && !row.grave.toLowerCase().includes(term) && !row.type.toLowerCase().includes(term)) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      return true;
    });
  }, [fees, search, statusFilter]);

  // define o tipo padrão dos formulários assim que o catálogo carrega
  useEffect(() => {
    if (!applyType && types.length) {
      const first = types.find((t) => t.active) || types[0];
      if (first) setApplyType(first.id);
    }
  }, [types, applyType]);

  async function runAction(fn, onOk) {
    setSaving(true);
    setFormError("");
    try {
      await fn();
      if (onOk) onOk();
    } catch (e) {
      setFormError(e?.message || "Não foi possível concluir a ação.");
    } finally {
      setSaving(false);
    }
  }

  function saveAdjust() {
    runAction(
      async () => {
        const value = Number(String(adjustForm.value).replace(",", "."));
        await adjustM.mutate(detail.id, { newAmount: value, reason: adjustForm.reason });
        await feesQ.refetch();
      },
      () => setAdjustOpen(false)
    );
  }

  function toggleStatus() {
    runAction(async () => {
      const action = detail.status === "ativa" ? suspendM : reactivateM;
      await action.mutate(detail.id);
      await feesQ.refetch();
    });
  }

  function endFee() {
    runAction(async () => {
      await terminateM.mutate(detail.id);
      await feesQ.refetch();
    });
  }

  const [typeForm, setTypeForm] = useState({ name: "", description: "", amount: "", periodicity: "anual" });
  // o mesmo modal serve para criar e editar: editingType guarda o tipo em edição
  const [editingType, setEditingType] = useState(null);
  const currentUser = getUser();
  const canDeleteType = ["admin", "super_admin"].includes(currentUser?.role);
  const [confirmDeleteType, setConfirmDeleteType] = useState(null);
  const [deleteTypeError, setDeleteTypeError] = useState("");
  const deleteTypeM = useMutation(deleteFeeType);

  function openTypeForm(type = null) {
    setEditingType(type);
    setTypeForm(type
      ? {
          name: type.name || "",
          description: type.description || "",
          amount: String(type.amount ?? ""),
          periodicity: type.periodicity || "anual",
        }
      : { name: "", description: "", amount: "", periodicity: "anual" });
    setNewTypeOpen(true);
  }

  function saveType() {
    if (!editingType) return createType();
    runAction(
      async () => {
        await updateTypeM.mutate(editingType.id, {
          name: typeForm.name,
          description: typeForm.description || null,
          defaultAmount: Number(String(typeForm.amount).replace(",", ".")) || 0,
          periodicity: typeForm.periodicity,
        });
        await typesQ.refetch();
      },
      () => { setEditingType(null); setNewTypeOpen(false); }
    );
  }

  async function doDeleteType() {
    setDeleteTypeError("");
    try {
      await deleteTypeM.mutate(confirmDeleteType.id);
      setConfirmDeleteType(null);
      await typesQ.refetch();
    } catch (e) {
      setDeleteTypeError(e?.message || "Não foi possível excluir o tipo de taxa.");
    }
  }

  function createType() {
    runAction(
      async () => {
        await createTypeM.mutate({
          name: typeForm.name || "Nova taxa",
          description: typeForm.description || null,
          defaultAmount: Number(String(typeForm.amount).replace(",", ".")) || 0,
          periodicity: typeForm.periodicity,
        });
        await typesQ.refetch();
      },
      () => {
        setTypeForm({ name: "", description: "", amount: "", periodicity: "anual" });
        setNewTypeOpen(false);
      }
    );
  }

  function toggleTypeActive(type) {
    runAction(async () => {
      await updateTypeM.mutate(type.id, { active: !type.active });
      await typesQ.refetch();
    });
  }

  // ---- aplicar taxa ----
  const [applyForm, setApplyForm] = useState({ graveId: "", payerPersonId: "", amount: "", periodicity: "anual", nextDueDate: "" });
  const selectedType = types.find((t) => t.id === applyType);
  const selectedGrave = graves.find((g) => g.id === applyForm.graveId);
  const graveOwner = selectedGrave?.owner?.person || null;

  function openApply() {
    setFormError("");
    setApplyForm({ graveId: "", payerPersonId: "", amount: "", periodicity: selectedType?.periodicity || "anual", nextDueDate: "" });
    setApplyOpen(true);
  }

  function applyFee() {
    runAction(
      async () => {
        const grave = graves.find((g) => g.id === applyForm.graveId);
        const payerId = applyForm.payerPersonId || grave?.owner?.person?.id || null;
        if (!applyForm.graveId) throw new Error("Selecione o jazigo.");
        if (!payerId) throw new Error("Selecione o pagador — este jazigo não tem concessionário ativo.");
        await createFeeM.mutate({
          graveId: applyForm.graveId,
          feeTypeId: applyType,
          payerPersonId: payerId,
          concessionId: grave?.owner?.concessionId || undefined,
          amount: applyForm.amount ? Number(String(applyForm.amount).replace(",", ".")) : undefined,
          periodicity: applyForm.periodicity || selectedType?.periodicity,
          nextDueDate: applyForm.nextDueDate || undefined,
        });
        await feesQ.refetch();
        await typesQ.refetch();
      },
      () => setApplyOpen(false)
    );
  }

  // ---- reajuste em lote ----
  const [batchForm, setBatchForm] = useState({ feeTypeId: "", percentText: "" });
  const [batchPreview, setBatchPreview] = useState(null);

  function openBatch() {
    setFormError("");
    const first = types.find((t) => t.active) || types[0];
    setBatchForm({ feeTypeId: first?.id || "", percentText: "" });
    setBatchPreview(null);
    setBatchOpen(true);
  }

  // Prévia via dryRun sempre que tipo/índice mudarem.
  useEffect(() => {
    if (!batchOpen) return;
    const pct = parsePercent(batchForm.percentText);
    if (!batchForm.feeTypeId || pct === null) {
      setBatchPreview(null);
      return;
    }
    let cancelled = false;
    batchAdjustFees({ feeTypeId: batchForm.feeTypeId, percent: pct, dryRun: true })
      .then((r) => { if (!cancelled) setBatchPreview(r); })
      .catch(() => { if (!cancelled) setBatchPreview(null); });
    return () => { cancelled = true; };
  }, [batchOpen, batchForm.feeTypeId, batchForm.percentText]);

  function applyBatch() {
    runAction(
      async () => {
        const pct = parsePercent(batchForm.percentText);
        if (!batchForm.feeTypeId || pct === null) throw new Error("Informe o tipo e o índice de reajuste.");
        await batchM.mutate({ feeTypeId: batchForm.feeTypeId, percent: pct, reason: batchForm.percentText, dryRun: false });
        await feesQ.refetch();
      },
      () => setBatchOpen(false)
    );
  }

  // ---- métricas dos cards ----
  const activeFees = fees.filter((f) => f.status === "ativa");
  const yearlyRevenue = activeFees.reduce((s, f) => s + f.amount * (PERIOD_FACTOR[f.periodicity] ?? 1), 0);
  const distinctGraves = new Set(activeFees.map((f) => f.graveId)).size;
  const dueIn30 = activeFees.filter((f) => {
    const d = daysUntil(f.nextDueRaw);
    return d !== null && d >= 0 && d <= 30;
  }).length;
  const suspendedCount = fees.filter((f) => f.status === "suspensa").length;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Taxas de manutenção</h1>
          <p className={styles.subtitle}>Por jazigo, vinculadas ao proprietário responsável</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button variant="secondary" onClick={openBatch}>Reajuste em lote</Button>
          <Button
            onClick={openApply}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Aplicar taxa
          </Button>
        </div>
      </header>

      <Tabs
        items={[
          {
            label: "Taxas por jazigo",
            count: fees.length,
            content: feesQ.loading ? (
              <div className={styles.tabContent}>
                <Skeleton variant="row" count={8} />
              </div>
            ) : feesQ.error ? (
              <div className={styles.tabContent}>
                <ErrorState onRetry={feesQ.refetch} />
              </div>
            ) : !fees.length ? (
              <div className={styles.tabContent}>
                <EmptyState
                  title="Nenhuma taxa aplicada"
                  message="Aplique a primeira taxa de manutenção a um jazigo — a cobrança passa a ser gerada automaticamente."
                  action={<Button onClick={openApply}>Aplicar taxa</Button>}
                />
              </div>
            ) : (
              <div className={styles.tabContent}>
                <section className={styles.stats}>
                  <StatCard label="Taxas ativas" value={activeFees.length.toLocaleString("pt-BR")} caption={`em ${distinctGraves.toLocaleString("pt-BR")} jazigos`} />
                  <StatCard label="Receita anual prevista" value={money(yearlyRevenue)} caption="pelas taxas ativas" />
                  <StatCard label="Vencimentos em 30 dias" value={String(dueIn30)} caption="geram cobrança automática" />
                  <StatCard label="Suspensas" value={String(suspendedCount)} deltaTone="danger" caption="sem cobrança" />
                </section>

                <div className={styles.statusChips}>
                  <button className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`} onClick={() => setStatusFilter("")}>
                    Todas <span className={styles.chipCount}>{fees.length}</span>
                  </button>
                  {Object.entries(STATUS_META).map(([key, meta]) => (
                    <button
                      key={key}
                      className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
                      onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
                    >
                      <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
                      {meta.label}
                      <span className={styles.chipCount}>{fees.filter((f) => f.status === key).length}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.searchBox}>
                  <Input
                    placeholder="Buscar por pagador, jazigo ou tipo de taxa…"
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

                <div className={styles.desktopTable}>
                  <DataTable
                    columns={[
                      { key: "grave", label: "Jazigo", render: (row) => <Link href={`/painel/sepulturas/${row.graveId}`} className={styles.graveLink}>{row.grave}</Link> },
                      { key: "type", label: "Tipo de taxa" },
                      {
                        key: "payer",
                        label: "Pagador",
                        render: (row) => (
                          <span className={styles.personCell}>
                            <Avatar name={row.payer} size="sm" />
                            <span className={styles.personName}>{row.payer}</span>
                          </span>
                        ),
                      },
                      { key: "amount", label: "Valor", align: "right", render: (row) => <span className={styles.amount}>{money(row.amount)}</span> },
                      { key: "periodicity", label: "Periodicidade", render: (row) => <Badge tone="navy">{PERIOD_META[row.periodicity]}</Badge> },
                      { key: "nextDue", label: "Próx. vencimento" },
                      { key: "status", label: "Situação", render: (row) => <Badge tone={STATUS_META[row.status].tone} dot>{STATUS_META[row.status].label}</Badge> },
                      {
                        key: "actions",
                        label: "",
                        align: "right",
                        render: (row) => <button className={styles.detailLink} onClick={() => setDetailId(row.id)}>Detalhes</button>,
                      },
                    ]}
                    rows={filtered}
                  />
                </div>

                <div className={styles.mobileList}>
                  {filtered.map((row) => (
                    <button key={row.id} className={styles.mobileCard} onClick={() => setDetailId(row.id)}>
                      <div className={styles.mobileCardTop}>
                        <span className={styles.mobileCardName}>{row.payer}</span>
                        <Badge tone={STATUS_META[row.status].tone} dot>{STATUS_META[row.status].label}</Badge>
                      </div>
                      <div className={styles.mobileCardBody}>
                        <span className={styles.mobileCardAmount}>{money(row.amount)} · {PERIOD_META[row.periodicity]}</span>
                        <span className={styles.mobileCardMeta}>{row.grave} · vence {row.nextDue}</span>
                      </div>
                      <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                        <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            ),
          },
          {
            label: "Catálogo de tipos",
            count: types.length,
            content: typesQ.loading ? (
              <div className={styles.tabContent}>
                <Skeleton variant="card" count={4} />
              </div>
            ) : typesQ.error ? (
              <div className={styles.tabContent}>
                <ErrorState onRetry={typesQ.refetch} />
              </div>
            ) : !types.length ? (
              <div className={styles.tabContent}>
                <EmptyState
                  title="Nenhum tipo de taxa cadastrado"
                  message="Cadastre o primeiro tipo de taxa com valor padrão e periodicidade para começar a aplicar às sepulturas."
                  action={<Button onClick={() => setNewTypeOpen(true)}>Novo tipo</Button>}
                />
              </div>
            ) : (
              <div className={styles.tabContent}>
                <div className={styles.typesHead}>
                  <p className={styles.typesHint}>
                    Os tipos definem o valor padrão e a periodicidade — a taxa aplicada a
                    cada jazigo pode personalizar valor e vencimento.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => openTypeForm(null)}>Novo tipo</Button>
                </div>
                <div className={styles.typeGrid}>
                  {types.map((type) => (
                    <article key={type.id} className={`${styles.typeCard} ${!type.active ? styles.typeCardInactive : ""}`}>
                      <header className={styles.typeCardHead}>
                        <span className={styles.typeName}>{type.name}</span>
                        <Switch
                          checked={type.active}
                          onChange={() => toggleTypeActive(type)}
                        />
                      </header>
                      <p className={styles.typeDesc}>{type.description}</p>
                      <div className={styles.typeMeta}>
                        <span className={styles.typeAmount}>{money(type.amount)}</span>
                        <Badge tone="navy">{PERIOD_META[type.periodicity]}</Badge>
                        <span className={styles.typeUse}>{type.inUse.toLocaleString("pt-BR")} jazigo(s)</span>
                      </div>
                      <RowActions
                        onEdit={() => openTypeForm(type)}
                        canDelete={canDeleteType}
                        onDelete={() => { setDeleteTypeError(""); setConfirmDeleteType(type); }}
                      />
                    </article>
                  ))}
                </div>
              </div>
            ),
          },
        ]}
      />

      {/* ---- detalhe da taxa ---- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? detail.type : ""}
        subtitle={detail ? `Jazigo ${detail.grave} · pagador ${detail.payer}` : ""}
        width={620}
        footer={
          detail && (
            <>
              {detail.status !== "encerrada" && (
                <Button variant="danger" loading={saving} onClick={endFee}>Encerrar</Button>
              )}
              <span className={styles.footSpacer} />
              {detail.status !== "encerrada" && (
                <>
                  <Button variant="secondary" loading={saving} onClick={toggleStatus}>
                    {detail.status === "ativa" ? "Suspender" : "Reativar"}
                  </Button>
                  <Button variant="secondary" loading={saving} onClick={() => { setFormError(""); setAdjustForm({ value: String(detail.amount), reason: "IPCA 2026 (+4,8%)" }); setAdjustOpen(true); }}>
                    Reajustar valor
                  </Button>
                </>
              )}
              <Button variant="secondary" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            {formError && !adjustOpen && <Alert tone="danger">{formError}</Alert>}
            <dl className={styles.detailGrid}>
              <div><dt>Valor atual</dt><dd className={styles.bigValue}>{money(detail.amount)}</dd></div>
              <div><dt>Periodicidade</dt><dd>{PERIOD_META[detail.periodicity]}</dd></div>
              <div><dt>Próximo vencimento</dt><dd>{detail.nextDue}</dd></div>
              <div><dt>Situação</dt><dd><Badge tone={STATUS_META[detail.status].tone} dot>{STATUS_META[detail.status].label}</Badge></dd></div>
            </dl>

            {detail.status === "suspensa" && (
              <Alert tone="warning">Taxa suspensa — nenhuma cobrança é gerada enquanto não for reativada.</Alert>
            )}
            {detail.status === "ativa" && (
              <Alert tone="info">
                A cobrança de {detail.nextDue} será gerada automaticamente (boleto + PIX)
                e o pagador notificado por WhatsApp.
              </Alert>
            )}

            <div className={styles.historyBlock}>
              <span className={styles.historyTitle}>Histórico de reajustes</span>
              {detail.adjusts.length ? (
                <ul className={styles.historyList}>
                  {detail.adjusts.map((adj, index) => (
                    <li key={index}>
                      <em>{adj.date}</em> {money(adj.from)} → <strong>{money(adj.to)}</strong> · {adj.reason}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={styles.emptyHistory}>Sem reajustes registrados.</p>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ---- reajustar valor ---- */}
      <Modal
        open={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title="Reajustar valor"
        subtitle={detail ? `${detail.type} · atual ${money(detail.amount)}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveAdjust}>Aplicar reajuste</Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormField label="Novo valor" required>
            <Input value={adjustForm.value} onChange={(e) => setAdjustForm({ ...adjustForm, value: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" />
          </FormField>
          <FormField label="Motivo / índice" required hint="Registrado no histórico de reajustes">
            <Input value={adjustForm.reason} onChange={(e) => setAdjustForm({ ...adjustForm, reason: e.target.value })} />
          </FormField>
          <Alert tone="info">O novo valor vale a partir da próxima cobrança gerada.</Alert>
        </div>
      </Modal>

      {/* ---- reajuste em lote ---- */}
      <Modal
        open={batchOpen}
        onClose={() => setBatchOpen(false)}
        title="Reajuste em lote"
        subtitle="Aplica um índice a todas as taxas ativas de um tipo"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBatchOpen(false)}>Cancelar</Button>
            <Button loading={saving} disabled={!batchPreview || !batchPreview.affected} onClick={applyBatch}>
              Aplicar a {(batchPreview?.affected ?? 0).toLocaleString("pt-BR")} taxas
            </Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className={styles.formGrid}>
            <FormField label="Tipo de taxa" required>
              <Select value={batchForm.feeTypeId} onChange={(e) => setBatchForm({ ...batchForm, feeTypeId: e.target.value })}>
                {types.filter((t) => t.active).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Índice de reajuste" required hint="Ex.: +4,8% (IPCA 2026)">
              <Input value={batchForm.percentText} onChange={(e) => setBatchForm({ ...batchForm, percentText: e.target.value })} placeholder="+4,8%" />
            </FormField>
          </div>
          {batchPreview ? (
            <Alert tone="warning" title="Prévia">
              {(batchPreview.affected ?? 0).toLocaleString("pt-BR")} taxa(s) ativa(s)
              {batchPreview.sample?.[0] ? (
                <> · {money(batchPreview.sample[0].from)} → <strong>{money(batchPreview.sample[0].to)}</strong></>
              ) : null}
              {" "}· vale a partir das próximas cobranças. Cada reajuste fica no histórico individual da taxa.
            </Alert>
          ) : (
            <Alert tone="info">Informe o tipo de taxa e o índice de reajuste para ver a prévia.</Alert>
          )}
        </div>
      </Modal>

      {/* ---- aplicar taxa a um jazigo ---- */}
      <Modal
        open={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Aplicar taxa a um jazigo"
        subtitle="Vinculada ao proprietário responsável pelo pagamento"
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setApplyOpen(false)}>Cancelar</Button>
            <Button loading={saving} disabled={!applyForm.graveId || !applyType} onClick={applyFee}>Aplicar taxa</Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <div className={styles.formGrid}>
            <FormField label="Jazigo" required>
              <Select value={applyForm.graveId} onChange={(e) => setApplyForm({ ...applyForm, graveId: e.target.value })}>
                <option value="" disabled>Selecione…</option>
                {graves.map((g) => (
                  <option key={g.id} value={g.id}>{g.code}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Tipo de taxa" required>
              <Select value={applyType} onChange={(e) => setApplyType(e.target.value)}>
                {types.filter((t) => t.active).map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Pagador" required hint={graveOwner ? `Concessionário atual: ${graveOwner.fullName}` : "Preenchido com o concessionário do jazigo"}>
              <Select value={applyForm.payerPersonId} onChange={(e) => setApplyForm({ ...applyForm, payerPersonId: e.target.value })}>
                <option value="">Concessionário atual (automático)</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Valor" hint={selectedType ? `Padrão do tipo: ${money(selectedType.amount)}` : ""}>
              <Input value={applyForm.amount} onChange={(e) => setApplyForm({ ...applyForm, amount: e.target.value })} placeholder={selectedType ? money(selectedType.amount) : "R$ 0,00"} inputMode="decimal" />
            </FormField>
            <FormField label="Periodicidade" required>
              <Select value={applyForm.periodicity} onChange={(e) => setApplyForm({ ...applyForm, periodicity: e.target.value })}>
                {Object.entries(PERIOD_META).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Primeiro vencimento" required>
              <Input type="date" value={applyForm.nextDueDate} onChange={(e) => setApplyForm({ ...applyForm, nextDueDate: e.target.value })} />
            </FormField>
          </div>
          <Alert tone="info">
            As cobranças passam a ser geradas automaticamente na periodicidade
            definida, com boleto + PIX e notificação ao pagador.
          </Alert>
        </div>
      </Modal>

      {/* ---- novo tipo de taxa ---- */}
      <Modal
        open={newTypeOpen}
        onClose={() => { setNewTypeOpen(false); setEditingType(null); }}
        title={editingType ? "Editar tipo de taxa" : "Novo tipo de taxa"}
        subtitle="Valor padrão e periodicidade do catálogo"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setNewTypeOpen(false); setEditingType(null); }}>Cancelar</Button>
            <Button loading={saving} disabled={!typeForm.name || !typeForm.amount} onClick={saveType}>
              {editingType ? "Salvar alterações" : "Criar tipo"}
            </Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {formError && <Alert tone="danger">{formError}</Alert>}
          <FormField label="Nome" required>
            <Input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Ex.: Taxa de conservação de mausoléu" />
          </FormField>
          <FormField label="Descrição">
            <Input value={typeForm.description} onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })} placeholder="Quando esta taxa se aplica" />
          </FormField>
          <div className={styles.formGrid}>
            <FormField label="Valor padrão" required>
              <Input value={typeForm.amount} onChange={(e) => setTypeForm({ ...typeForm, amount: e.target.value })} inputMode="decimal" placeholder="R$ 0,00" />
            </FormField>
            <FormField label="Periodicidade" required>
              <Select value={typeForm.periodicity} onChange={(e) => setTypeForm({ ...typeForm, periodicity: e.target.value })}>
                {Object.entries(PERIOD_META).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </div>
      </Modal>

      <ConfirmDelete
        open={Boolean(confirmDeleteType)}
        onClose={() => setConfirmDeleteType(null)}
        onConfirm={doDeleteType}
        loading={deleteTypeM.loading}
        title="Excluir tipo de taxa"
        name={confirmDeleteType?.name}
        description={
          deleteTypeError
          || "O tipo sai do catálogo. As taxas já aplicadas com ele continuam ativas e inalteradas."
        }
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="taxas"
        totalCount={fees.length}
        filteredCount={filtered.length}
      />
    </div>
  );
}
