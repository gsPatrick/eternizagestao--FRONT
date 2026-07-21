"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import api from "@/lib/api/client";
import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listBillings,
  getBillingsSummary,
  getBilling,
  createBilling,
  generateBillings,
  reissueBilling,
  cancelBilling,
  normalizeBilling,
  toApiStatus,
  toApiOrigin,
} from "@/lib/api/resources/billings";
import {
  createManualPayment,
  simulateGatewayPayment,
} from "@/lib/api/resources/payments";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Pagination from "@/components/molecules/Pagination/Pagination";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import FileViewer from "@/components/organisms/FileViewer/FileViewer";

import { todayISO, toLocalISODate } from "@/lib/date-local";

/**
 * Datas dos formulários — nada de data fixa no código.
 * `addDays` devolve YYYY-MM-DD no fuso LOCAL (via toLocalISODate); usar
 * `toISOString()` aqui devolveria UTC e, depois das 21h no Brasil, gravaria o
 * dia seguinte na baixa de pagamento e no vencimento.
 */
function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

// Vencimento padrão da nova cobrança: HOJE + 14 dias. Critério: prazo usual de
// boleto emitido no balcão (duas semanas dão tempo de o pagador receber e pagar
// sem cair em atraso), e é relativo a hoje — antes era "2026-07-30" fixo, que
// já nasceria vencido em qualquer dia posterior.
const DEFAULT_DUE_DAYS = 14;

// Geração em lote: gera até o ÚLTIMO DIA DO MÊS SEGUINTE (competência corrente
// + a próxima), em vez da data fixa "2026-08-31".
function defaultGenerateUntil() {
  const now = new Date();
  // dia 0 do mês +2 = último dia do mês +1
  return toLocalISODate(new Date(now.getFullYear(), now.getMonth() + 2, 0));
}

const STATUS_META = {
  pendente: { label: "Pendente", tone: "warning" },
  pago: { label: "Pago", tone: "success" },
  atraso: { label: "Em atraso", tone: "danger" },
  cancelado: { label: "Cancelado", tone: "neutral" },
  estornado: { label: "Estornado", tone: "neutral" },
};

const ORIGIN_META = {
  taxa: "Taxa de manutenção",
  servico: "Serviço",
  avulsa: "Avulsa",
};

const MONTH_NAME = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(new Date());

function money(v) {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function total(row) {
  return row.amount + row.fine + row.interest;
}

function daysLate(due) {
  const [d, m, y] = due.split("/").map(Number);
  const diff = Math.round((new Date() - new Date(y, m - 1, d)) / 86400000);
  return diff;
}

function parseAmount(v) {
  if (typeof v === "number") return v;
  const cleaned = String(v || "").replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function BillingsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [page, setPage] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [copied, setCopied] = useState("");
  // Baixa de pagamento: data de HOJE (o operador registra o que acabou de
  // receber). Era "2026-07-16" fixo — gravaria o pagamento com data errada.
  const [payForm, setPayForm] = useState(() => ({ method: "pix", date: todayISO() }));
  const [newForm, setNewForm] = useState(() => ({
    payerPersonId: "", graveId: "", description: "", origin: "servico", amount: "",
    dueDate: addDays(DEFAULT_DUE_DAYS),
  }));
  const [genForm, setGenForm] = useState(() => ({ until: defaultGenerateUntil() }));
  const [actionError, setActionError] = useState("");

  // ---- dados ao vivo ------------------------------------------------------
  const listParams = useMemo(
    () => ({
      page,
      perPage: 30,
      status: toApiStatus(statusFilter) || undefined,
      origin: toApiOrigin(originFilter) || undefined,
    }),
    [page, statusFilter, originFilter]
  );

  const { data: listData, loading: listLoading, error: listError, refetch } = useResource(
    ({ signal }) => listBillings(listParams, { signal }),
    [page, statusFilter, originFilter]
  );

  const { data: summary, refetch: refetchSummary } = useResource(
    ({ signal }) => getBillingsSummary({ origin: toApiOrigin(originFilter) || undefined }, { signal }),
    [originFilter]
  );

  const { data: detailRaw, refetch: refetchDetail } = useResource(
    ({ signal }) => (detailId ? getBilling(detailId, { signal }) : Promise.resolve(null)),
    [detailId]
  );

  // pickers da nova cobrança (endpoints reais de people/graves)
  const { data: peopleRes } = useResource(
    ({ signal }) => api.get("/people", { params: { perPage: 100 }, meta: true, signal }),
    []
  );
  const { data: gravesRes } = useResource(
    ({ signal }) => api.get("/graves", { params: { perPage: 100 }, meta: true, signal }),
    []
  );
  const people = peopleRes?.data ?? [];
  const graves = gravesRes?.data ?? [];

  const rows = useMemo(() => (listData?.data ?? []).map(normalizeBilling), [listData]);
  const meta = listData?.meta;
  const detail = detailRaw ? normalizeBilling(detailRaw) : null;

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter(
      (row) =>
        row.payer.toLowerCase().includes(term) ||
        row.grave.toLowerCase().includes(term) ||
        row.number.toLowerCase().includes(term)
    );
  }, [rows, search]);

  const byStatus = summary?.byStatus || {};
  const statusCount = (key) => byStatus[toApiStatus(key)]?.count ?? 0;
  const totalCount = summary?.total ?? 0;

  // ---- mutações -----------------------------------------------------------
  const payM = useMutation(({ id, body }) => createManualPayment(id, body));
  const simM = useMutation((id) => simulateGatewayPayment(id, { method: "pix" }));
  const reissueM = useMutation((id) => reissueBilling(id, {}));
  const cancelM = useMutation((id) => cancelBilling(id, {}));
  const genM = useMutation((body) => generateBillings(body));
  const createM = useMutation((body) => createBilling(body));

  async function refreshAll() {
    await Promise.all([refetch(), refetchSummary()]);
  }

  async function manualPayment() {
    setActionError("");
    try {
      await payM.mutate({ id: detail.id, body: { method: payForm.method, paidAt: payForm.date } });
      setPayOpen(false);
      await Promise.all([refreshAll(), refetchDetail()]);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function simulateGateway() {
    setActionError("");
    try {
      await simM.mutate(detail.id);
      await Promise.all([refreshAll(), refetchDetail()]);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function reissue() {
    setActionError("");
    try {
      await reissueM.mutate(detail.id);
      setDetailId(null);
      await refreshAll();
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function cancel() {
    setActionError("");
    try {
      await cancelM.mutate(detail.id);
      setDetailId(null);
      await refreshAll();
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function submitGenerate() {
    setActionError("");
    try {
      await genM.mutate({ until: genForm.until });
      setGenerateOpen(false);
      await refreshAll();
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function submitNew() {
    setActionError("");
    try {
      await createM.mutate({
        payerPersonId: newForm.payerPersonId,
        graveId: newForm.graveId || undefined,
        description: newForm.description,
        origin: newForm.origin,
        amount: parseAmount(newForm.amount),
        dueDate: newForm.dueDate,
      });
      setNewOpen(false);
      setNewForm({
        payerPersonId: "", graveId: "", description: "", origin: "servico", amount: "",
        dueDate: addDays(DEFAULT_DUE_DAYS), // recalculado a cada limpeza do form
      });
      await refreshAll();
    } catch (e) {
      setActionError(e.message);
    }
  }

  const detailBusy = payM.loading || simM.loading || reissueM.loading || cancelM.loading;

  function copy(text, key) {
    if (!text) return;
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 2000);
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Cobranças</h1>
          <p className={styles.subtitle}>Boleto e PIX via gateway · baixa automática</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button variant="secondary" onClick={() => setGenerateOpen(true)}>Gerar em lote</Button>
          <Button
            onClick={() => setNewOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Nova cobrança
          </Button>
        </div>
      </header>

      <section className={styles.stats}>
        <StatCard label="Recebido no mês" value={money(summary?.receivedThisMonth)} caption={`${summary?.receivedCount ?? 0} baixas em ${MONTH_NAME}`} />
        <StatCard label="A receber (pendentes)" value={money(summary?.pendingTotal)} caption={`${statusCount("pendente")} cobranças`} />
        <StatCard label="Em atraso" value={money(summary?.overdueTotal)} delta={`${summary?.overdueCount ?? 0}`} deltaTone="danger" caption="ver inadimplência" />
        <StatCard label="Baixas automáticas" value={`${summary?.autoRatio ?? 0}%`} caption="dos pagamentos do mês" />
      </section>

      <div className={styles.statusChips}>
        <button className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`} onClick={() => { setStatusFilter(""); setPage(1); }}>
          Todas <span className={styles.chipCount}>{totalCount}</span>
        </button>
        {Object.entries(STATUS_META).map(([key, meta]) => (
          <button
            key={key}
            className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
            onClick={() => { setStatusFilter(statusFilter === key ? "" : key); setPage(1); }}
          >
            <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
            {meta.label}
            <span className={styles.chipCount}>{statusCount(key)}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Input
            placeholder="Buscar por pagador, jazigo ou nº da cobrança…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            }
          />
        </div>
        <div className={styles.filters}>
          <Select value={originFilter} onChange={(e) => { setOriginFilter(e.target.value); setPage(1); }}>
            <option value="">Todas as origens</option>
            {Object.entries(ORIGIN_META).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </Select>
        </div>
      </div>

      {listError ? (
        <ErrorState onRetry={refetch} />
      ) : listLoading ? (
        <div className={styles.desktopTable}>
          <Skeleton variant="row" count={8} />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Nenhuma cobrança emitida"
          message="Emita a primeira cobrança avulsa ou gere as taxas de manutenção em lote para começar a receber por boleto e PIX."
          action={<Button onClick={() => setNewOpen(true)}>Nova cobrança</Button>}
        />
      ) : (
        <>
          <div className={styles.desktopTable}>
            <DataTable
              columns={[
                {
                  key: "number",
                  label: "Cobrança",
                  render: (row) => (
                    <span className={styles.billCell}>
                      <span className={styles.billDesc}>{row.description}</span>
                      <span className={styles.billNumber}>{row.number} · {row.period}</span>
                    </span>
                  ),
                },
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
                { key: "grave", label: "Jazigo", render: (row) => (row.graveId ? <Link href={`/painel/sepulturas/${row.graveId}`} className={styles.graveLink}>{row.grave}</Link> : <span className={styles.graveLink}>—</span>) },
                { key: "amount", label: "Valor", align: "right", render: (row) => <span className={styles.amount}>{money(total(row))}</span> },
                {
                  key: "due",
                  label: "Vencimento",
                  render: (row) => (
                    <span className={styles.dueCell}>
                      <span>{row.due}</span>
                      {row.status === "atraso" && <span className={styles.lateDays}>{daysLate(row.due)} dias em atraso</span>}
                    </span>
                  ),
                },
                {
                  key: "status",
                  label: "Situação",
                  render: (row) => (
                    <span className={styles.statusCell}>
                      <Badge tone={STATUS_META[row.status]?.tone} dot>{STATUS_META[row.status]?.label}</Badge>
                      {row.auto && (
                        <span className={styles.autoFlag} title={`Baixa automática · ${row.method} · ${row.paidAt}`}>
                          <svg viewBox="0 0 12 12" fill="none"><path d="M6.8 1L2.5 7h3l-.8 4L9.5 5h-3l.3-4z" fill="currentColor" /></svg>
                        </span>
                      )}
                    </span>
                  ),
                },
                {
                  key: "actions",
                  label: "",
                  align: "right",
                  render: (row) => <button className={styles.detailLink} onClick={() => setDetailId(row.id)}>Detalhes</button>,
                },
              ]}
              rows={filtered}
              footer={
                <>
                  <span>{filtered.length} de {meta?.totalItems ?? rows.length} cobranças</span>
                  <Pagination page={page} totalPages={meta?.totalPages ?? 1} onChange={setPage} />
                </>
              }
            />
          </div>

          <div className={styles.mobileList}>
            {filtered.map((row) => (
              <button key={row.id} className={styles.mobileCard} onClick={() => setDetailId(row.id)}>
                <div className={styles.mobileCardTop}>
                  <span className={styles.mobileCardName}>{row.payer}</span>
                  <Badge tone={STATUS_META[row.status]?.tone} dot>{STATUS_META[row.status]?.label}</Badge>
                </div>
                <div className={styles.mobileCardBody}>
                  <span className={styles.mobileCardAmount}>{money(total(row))}</span>
                  <span className={styles.mobileCardMeta}>
                    {row.description} · vence {row.due}
                    {row.status === "atraso" && <em className={styles.lateDays}> · {daysLate(row.due)}d em atraso</em>}
                  </span>
                </div>
                <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                  <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
            <p className={styles.mobileCount}>{filtered.length} de {meta?.totalItems ?? rows.length} cobranças</p>
          </div>
        </>
      )}

      {/* ---- detalhe da cobrança ---- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? detail.description : ""}
        subtitle={detail ? `${detail.number} · competência ${detail.period} · ${ORIGIN_META[detail.origin] || detail.origin}` : ""}
        width={640}
        footer={
          detail && (
            <>
              {(detail.status === "pendente" || detail.status === "atraso") && (
                <>
                  <Button variant="danger" loading={cancelM.loading} disabled={detailBusy} onClick={cancel}>Cancelar</Button>
                  <span className={styles.footSpacer} />
                  <Button variant="secondary" loading={reissueM.loading} disabled={detailBusy} onClick={reissue}>2ª via</Button>
                  {/* Reabre a baixa sempre com a data de hoje (sessões longas
                      podem atravessar a virada do dia). */}
                  <Button variant="secondary" disabled={detailBusy} onClick={() => { setPayForm((f) => ({ ...f, date: todayISO() })); setPayOpen(true); }}>Registrar pagamento</Button>
                </>
              )}
              {detail.status === "pago" && <span className={styles.footSpacer} />}
              <Button variant="secondary" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            <div className={styles.detailHead}>
              <span className={styles.personCell}>
                <Avatar name={detail.payer} size="md" />
                <span>
                  <span className={styles.personName}>{detail.payer}</span>
                  {detail.graveId && (
                    <Link href={`/painel/sepulturas/${detail.graveId}`} className={styles.detailGraveLink}>
                      Jazigo {detail.grave}
                    </Link>
                  )}
                </span>
              </span>
              <Badge tone={STATUS_META[detail.status]?.tone} dot>{STATUS_META[detail.status]?.label}</Badge>
            </div>

            {actionError && <Alert tone="danger">{actionError}</Alert>}

            {/* composição do valor */}
            <div className={styles.valueBox}>
              <div className={styles.valueRow}><span>Valor original</span><strong>{money(detail.amount)}</strong></div>
              {detail.fine > 0 && <div className={styles.valueRow}><span>Multa</span><strong>{money(detail.fine)}</strong></div>}
              {detail.interest > 0 && <div className={styles.valueRow}><span>Juros de mora</span><strong>{money(detail.interest)}</strong></div>}
              <div className={`${styles.valueRow} ${styles.valueTotal}`}>
                <span>Total {detail.status === "pago" ? "pago" : "a pagar"}</span>
                <strong>{money(total(detail))}</strong>
              </div>
            </div>

            {(detail.status === "pendente" || detail.status === "atraso") && (
              <>
                {detail.reissued && (
                  <Alert tone="info">2ª via — boleto e código PIX renovados, vencimento {detail.due}.</Alert>
                )}
                {/* canais de pagamento (gateway) */}
                <div className={styles.payChannels}>
                  <div className={styles.channel}>
                    <span className={styles.channelLabel}>PIX copia e cola</span>
                    <code className={styles.channelCode}>{detail.pixCopyPaste ? `${detail.pixCopyPaste.slice(0, 46)}…` : "gerando…"}</code>
                    <Button size="sm" variant="secondary" disabled={!detail.pixCopyPaste} onClick={() => copy(detail.pixCopyPaste, "pix")}>
                      {copied === "pix" ? "Copiado ✓" : "Copiar código"}
                    </Button>
                  </div>
                  <div className={styles.channel}>
                    <span className={styles.channelLabel}>Boleto — linha digitável</span>
                    <code className={styles.channelCode}>{detail.boletoDigitableLine || "gerando…"}</code>
                    <Button size="sm" variant="secondary" disabled={!detail.boletoDigitableLine} onClick={() => copy(detail.boletoDigitableLine, "boleto")}>
                      {copied === "boleto" ? "Copiada ✓" : "Copiar linha"}
                    </Button>
                  </div>
                </div>
                <button className={styles.simulate} onClick={simulateGateway} disabled={detailBusy}>
                  ⚡ Simular confirmação do gateway (baixa automática)
                </button>
              </>
            )}

            {detail.status === "pago" && (
              <>
                <Alert tone="success" title={detail.auto ? "Baixa automática realizada" : "Pagamento registrado"}>
                  {detail.auto
                    ? `Confirmação da instituição financeira via ${detail.method} em ${detail.paidAt} — baixa, recibo e histórico atualizados sem conferência manual.`
                    : `Recebido em ${detail.method} · ${detail.paidAt}.`}
                </Alert>
                {detail.receipt && (
                  <div className={styles.receiptBox}>
                    <div className={styles.receiptInfo}>
                      <span className={styles.receiptLabel}>Recibo vinculado à sepultura</span>
                      <span className={styles.receiptNumber}>nº {detail.receipt}</span>
                    </div>
                    {detail.receiptUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setPreview({ name: `recibo-${detail.receipt?.replace("/", "-")}.pdf`, category: "Recibo de pagamento", url: detail.receiptUrl })}
                      >
                        Ver recibo
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}

            {/* histórico da cobrança */}
            <div className={styles.historyBlock}>
              <span className={styles.historyTitle}>Histórico</span>
              <ul className={styles.historyList}>
                {detail.status === "pago" && (
                  <li><em>{detail.paidAt}</em> {detail.auto ? `⚡ Baixa automática (${detail.method})${detail.receipt ? ` + recibo nº ${detail.receipt}` : ""}` : `Pagamento manual (${detail.method})${detail.receipt ? ` + recibo nº ${detail.receipt}` : ""}`}</li>
                )}
                {detail.status === "atraso" && <li><em>{detail.due}</em> Vencida — multa e juros aplicados · titular notificado por WhatsApp</li>}
                <li><em>{detail.number}</em> Cobrança gerada via gateway — boleto e PIX emitidos</li>
              </ul>
            </div>
          </div>
        )}
      </Modal>

      {/* ---- registrar pagamento (baixa manual) ---- */}
      <Modal
        open={payOpen}
        onClose={() => setPayOpen(false)}
        title="Registrar pagamento"
        subtitle={detail ? `${detail.number} · ${money(total(detail))}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button loading={payM.loading} onClick={manualPayment}>Confirmar baixa</Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          <FormField label="Método" required>
            <Select value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value })}>
              <option value="pix">PIX</option>
              <option value="boleto">Boleto</option>
              <option value="dinheiro">Dinheiro</option>
              <option value="cartao_credito">Cartão</option>
            </Select>
          </FormField>
          <FormField label="Data do pagamento" required>
            <Input type="date" value={payForm.date} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} />
          </FormField>
          <Alert tone="info">
            O recibo será emitido automaticamente e vinculado à sepultura, e a
            movimentação registrada no histórico do jazigo.
          </Alert>
        </div>
      </Modal>

      {/* ---- gerar em lote ---- */}
      <Modal
        open={generateOpen}
        onClose={() => setGenerateOpen(false)}
        title="Gerar cobranças em lote"
        subtitle="Taxas de manutenção com vencimento no período"
        footer={
          <>
            <Button variant="ghost" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
            <Button loading={genM.loading} onClick={submitGenerate}>Gerar cobranças</Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          <FormField label="Vencimentos até" required>
            <Input type="date" value={genForm.until} onChange={(e) => setGenForm({ until: e.target.value })} />
          </FormField>
          <Alert tone="info" title="Prévia da geração">
            Cada taxa de manutenção ativa com vencimento até a data escolhida gera
            boleto + código PIX no gateway e notifica o titular por WhatsApp.
            Competências já cobradas são puladas automaticamente.
          </Alert>
        </div>
      </Modal>

      {/* ---- nova cobrança avulsa ---- */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Nova cobrança"
        subtitle="Avulsa ou de serviço · boleto + PIX emitidos na hora"
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              loading={createM.loading}
              disabled={!newForm.payerPersonId || !newForm.description || !newForm.amount}
              onClick={submitNew}
            >
              Emitir cobrança
            </Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {actionError && <Alert tone="danger">{actionError}</Alert>}
          <div className={styles.formGrid}>
            <FormField label="Pagador" required>
              <Select value={newForm.payerPersonId} onChange={(e) => setNewForm({ ...newForm, payerPersonId: e.target.value })}>
                <option value="" disabled>Selecione…</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Jazigo (opcional)">
              <Select value={newForm.graveId} onChange={(e) => setNewForm({ ...newForm, graveId: e.target.value })}>
                <option value="">Sem vínculo</option>
                {graves.map((g) => (
                  <option key={g.id} value={g.id}>{g.code}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Descrição" required>
              <Input placeholder="Ex.: serviço de limpeza da lápide" value={newForm.description} onChange={(e) => setNewForm({ ...newForm, description: e.target.value })} />
            </FormField>
            <FormField label="Origem" required>
              <Select value={newForm.origin} onChange={(e) => setNewForm({ ...newForm, origin: e.target.value })}>
                <option value="servico">Serviço</option>
                <option value="avulsa">Avulsa</option>
              </Select>
            </FormField>
            <FormField label="Valor" required>
              <Input placeholder="R$ 0,00" inputMode="decimal" value={newForm.amount} onChange={(e) => setNewForm({ ...newForm, amount: e.target.value })} />
            </FormField>
            <FormField label="Vencimento" required>
              <Input type="date" value={newForm.dueDate} onChange={(e) => setNewForm({ ...newForm, dueDate: e.target.value })} />
            </FormField>
          </div>
          <Alert tone="info">
            Boleto e código PIX são gerados pelo gateway e enviados ao pagador
            por WhatsApp assim que a cobrança for emitida.
          </Alert>
        </div>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="cobranças"
        totalCount={totalCount}
        filteredCount={filtered.length}
      />

      <FileViewer open={Boolean(preview)} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
