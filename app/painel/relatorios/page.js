"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Tabs from "@/components/molecules/Tabs/Tabs";
import StatCard from "@/components/molecules/StatCard/StatCard";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import DataTable from "@/components/organisms/DataTable/DataTable";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getReport, exportReport, EXPORT_FORMATS } from "@/lib/api/resources/reports";
import {
  listDataExports,
  createDataExport,
  downloadDataExport,
} from "@/lib/api/resources/data-exports";
import { listCemeteries } from "@/lib/api/resources/cemeteries";
import { todayISO, toLocalISODate } from "@/lib/date-local";

const TODAY = new Date().toLocaleDateString("pt-BR");

const CATEGORIES = {
  operacional: { label: "Operacional", tone: "info" },
  financeiro: { label: "Financeiro", tone: "navy" },
  cadastros: { label: "Cadastros", tone: "neutral" },
};

const REPORTS = [
  { id: "ocupacao", category: "operacional", name: "Ocupação por cemitério e quadra", desc: "Jazigos ocupados, livres e taxa de ocupação por quadra." },
  { id: "sepultamentos", category: "operacional", name: "Sepultados por período", desc: "Relação de sepultados registrados no intervalo escolhido." },
  { id: "exumacoes", category: "operacional", name: "Exumações por destino", desc: "Exumações agrupadas por destino dos restos mortais." },
  { id: "velorios", category: "operacional", name: "Agenda de velórios", desc: "Reservas de salas de velório confirmadas e realizadas no período." },
  { id: "arrecadacao", category: "financeiro", name: "Arrecadação por período e taxa", desc: "Valores emitidos e recebidos por tipo de taxa." },
  { id: "inadimplencia", category: "financeiro", name: "Inadimplência (aging)", desc: "Cobranças em atraso agrupadas por faixa de dias." },
  { id: "cobrancas", category: "financeiro", name: "Cobranças emitidas × pagas", desc: "Conversão mensal de cobranças emitidas em pagamentos." },
  { id: "concessoes", category: "cadastros", name: "Concessões a vencer", desc: "Contratos com vencimento nos próximos meses." },
  { id: "sepultados", category: "cadastros", name: "Sepultados por localização", desc: "Distribuição de sepultados por quadra e situação." },
  { id: "transferencias", category: "cadastros", name: "Transferências de propriedade", desc: "Mudanças de titularidade de concessões no período." },
];

// Formatação de células (dados vêm da API — ver lib/api/resources/reports.js).
function fmtCell(iso) {
  return iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "—";
}
function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
function brl(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
}
function pct(part, total) {
  return total ? `${Math.round((part / total) * 100)}%` : "—";
}
const dash = (v) => (v === null || v === undefined || v === "" ? "—" : v);

/**
 * Metadados de apresentação por relatório: colunas do preview (mesma estrutura
 * do layout original) + `toRow` que mapeia o objeto servido pela API para a
 * linha da tabela. O id é o do catálogo REPORTS → endpoint em reports.js.
 */
const REPORT_META = {
  ocupacao: {
    columns: [{ label: "Cemitério" }, { label: "Quadra" }, { label: "Jazigos", num: true }, { label: "Ocupados", num: true }, { label: "Livres", num: true }, { label: "Ocupação", num: true }],
    toRow: (o) => [dash(o.cemetery), dash(o.block), o.totalGraves, o.occupied, o.free, pct(o.occupied, o.totalGraves)],
  },
  sepultamentos: {
    columns: [{ label: "Data" }, { label: "Sepultado" }, { label: "Jazigo" }, { label: "Cemitério" }, { label: "Declarante" }],
    toRow: (o) => [fmtCell(o.burialDate), dash(o.deceasedName), dash(o.graveCode), dash(o.cemeteryName), dash(o.declarantName)],
  },
  exumacoes: {
    columns: [{ label: "Solicitada" }, { label: "Sepultado" }, { label: "Jazigo origem" }, { label: "Destino" }, { label: "Situação" }],
    toRow: (o) => [fmtCell(o.requestDate), dash(o.deceasedName), dash(o.originGraveCode), dash(o.destinationType), dash(o.status)],
  },
  velorios: {
    columns: [{ label: "Data" }, { label: "Horário" }, { label: "Sala" }, { label: "Falecido" }, { label: "Situação" }],
    toRow: (o) => [fmtCell(o.startsAt), `${fmtTime(o.startsAt)} – ${fmtTime(o.endsAt)}`, dash(o.chapelName), dash(o.deceasedName || o.title), dash(o.status)],
  },
  arrecadacao: {
    columns: [{ label: "Data" }, { label: "Pagador" }, { label: "Descrição" }, { label: "Método" }, { label: "Valor", num: true }],
    toRow: (o) => [fmtCell(o.paidAt), dash(o.payerName), dash(o.billingDescription), dash(o.method), brl(o.amountPaid)],
  },
  inadimplencia: {
    columns: [{ label: "Pagador" }, { label: "CPF" }, { label: "Jazigo" }, { label: "Vencimento" }, { label: "Valor", num: true }, { label: "Dias", num: true }],
    toRow: (o) => [dash(o.payerName), dash(o.payerCpf), dash(o.graveCode), fmtCell(o.dueDate), brl(o.totalAmount), o.daysOverdue],
  },
  cobrancas: {
    columns: [{ label: "Mês" }, { label: "Emitidas", num: true }, { label: "Pagas", num: true }, { label: "Conversão", num: true }, { label: "Valor emitido", num: true }, { label: "Valor recebido", num: true }],
    toRow: (o) => [o.month, o.issued, o.paid, `${o.conversionRate}%`, brl(o.issuedAmount), brl(o.paidAmount)],
  },
  concessoes: {
    columns: [{ label: "Contrato" }, { label: "Concessionário" }, { label: "Jazigo" }, { label: "Vencimento" }, { label: "Dias restantes", num: true }],
    toRow: (o) => [dash(o.contractNumber), dash(o.personName), dash(o.graveCode), fmtCell(o.endDate), o.daysRemaining ?? "—"],
  },
  sepultados: {
    columns: [{ label: "Cemitério" }, { label: "Quadra" }, { label: "Ativos", num: true }, { label: "Exumados", num: true }, { label: "Total", num: true }],
    toRow: (o) => [dash(o.cemetery), dash(o.block), o.active, o.exhumed, o.total],
  },
  transferencias: {
    columns: [{ label: "Data" }, { label: "Contrato" }, { label: "De" }, { label: "Para" }, { label: "Motivo" }],
    toRow: (o) => [fmtCell(o.transferDate), dash(o.contractNumber), dash(o.fromPersonName), dash(o.toPersonName), dash(o.transferReason)],
  },
};

/**
 * Catálogo das remessas para órgãos públicos. Cada card dispara uma exportação
 * real na feature `data-exports` (POST /data-exports) com o exportType oficial:
 *   - cartório       → exporter 'cartorio'
 *   - órgão municipal → exporter 'orgao_municipal'
 * O back-end gera o arquivo em CSV (formato servido hoje pela data-exports); o
 * "formato exigido" no rodapé é o leiaute-alvo do órgão, informativo.
 */
const REMESSAS = [
  {
    id: "cartorio",
    exportType: "cartorio",
    format: "csv",
    name: "Cartório de Registro Civil",
    desc: "Remessa de sepultamentos do período com dados dos óbitos, jazigos e autorizações para conferência do registro civil.",
    formatLabel: "XML — leiaute CRC Nacional",
    formatShort: "CSV",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M5 2.5h7l3.5 3.5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <circle cx="10" cy="10.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10 12.7v2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "prefeitura",
    exportType: "orgao_municipal",
    format: "csv",
    name: "Prefeitura / Tribunal de Contas",
    desc: "Arrecadação por taxa, concessões ativas e inadimplência consolidadas para a prestação de contas do órgão gestor.",
    formatLabel: "CSV + PDF assinado (e-TCE)",
    formatShort: "CSV",
    icon: (
      <svg viewBox="0 0 20 20" fill="none">
        <path d="M3 17.5h14M4.5 17.5V8h11v9.5M10 2.5 3.5 8h13L10 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
        <path d="M7.5 17.5v-4.5h5v4.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      </svg>
    ),
  },
];

const FORMAT_TONES = { PDF: "navy", XLSX: "success", CSV: "neutral", XML: "info", JSON: "neutral" };

// Rótulos de apresentação para os registros reais de data-exports.
const EXPORT_TYPE_LABEL = {
  cartorio: "Remessa — Cartório de Registro Civil",
  orgao_municipal: "Remessa — Prefeitura / Órgão Municipal",
  ocupacao: "Ocupação por cemitério e quadra",
  financeiro: "Arrecadação (financeiro)",
  sepultamentos: "Sepultados por período",
  exumacoes: "Exumações por destino",
  inadimplencia: "Inadimplência (aging)",
  outro: "Exportação de dados",
};
const REMESSA_TYPES = new Set(["cartorio", "orgao_municipal"]);
const STATUS_LABEL = { pendente: "Pendente", processando: "Processando", concluido: "Concluído", erro: "Falhou" };

/**
 * Período padrão dos relatórios: MÊS CORRENTE (dia 1 → hoje), no fuso local.
 * Era fixo em 01/07/2026 → 16/07/2026, ou seja: em qualquer outro mês a tela
 * abria filtrando um período que não é o que o operador quer ver.
 * É uma função (e não uma constante) para que o período seja recalculado a cada
 * abertura do filtro — uma aba deixada aberta na virada do mês continuaria com
 * o mês anterior.
 */
function defaultParams() {
  const iso = todayISO();
  return { from: `${iso.slice(0, 7)}-01`, to: iso, cemeteryId: "", format: "pdf" };
}

// Rótulo "mês/ano" do mês corrente (ex.: "julho/2026") para as legendas.
function currentMonthLabel() {
  const now = new Date();
  return `${new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(now)}/${now.getFullYear()}`;
}

function fmtDate(iso) {
  return iso ? String(iso).slice(0, 10).split("-").reverse().join("/") : "";
}

// Mapeia um DataExport (API) para a linha exibida no histórico.
function toHistoryRow(e) {
  const hasPeriod = e.periodStart || e.periodEnd;
  return {
    id: e.id,
    name: EXPORT_TYPE_LABEL[e.exportType] || e.exportType,
    period: hasPeriod ? `${fmtDate(e.periodStart) || "…"} – ${fmtDate(e.periodEnd) || "…"}` : "—",
    by: e.requestedBy?.name || "Sistema",
    at: fmtCell(e.createdAt),
    format: String(e.format || "").toUpperCase(),
    status: e.status,
    remessa: REMESSA_TYPES.has(e.exportType),
    raw: e,
  };
}

/**
 * Prévia de um relatório — busca as linhas reais na API (useResource) e
 * renderiza no padrão obrigatório: loading (Skeleton) → error (ErrorState) →
 * vazio (EmptyState) → conteúdo (tabela). O layout da tabela é o do design.
 */
function ReportPreview({ report, params }) {
  const meta = REPORT_META[report.id];
  const { data, loading, error, refetch } = useResource(
    ({ signal }) =>
      getReport(
        report.id,
        { from: params.from, to: params.to, cemeteryId: params.cemeteryId || undefined },
        { signal }
      ),
    [report.id, params.from, params.to, params.cemeteryId]
  );

  if (loading) {
    return (
      <div className={styles.previewWrap}>
        <div className={styles.previewScroll}>
          <Skeleton variant="row" count={6} />
        </div>
      </div>
    );
  }
  if (error) return <ErrorState onRetry={refetch} />;

  const rows = data?.data ?? [];
  if (!rows.length) {
    return (
      <EmptyState
        title="Sem dados para o período selecionado"
        message="Ajuste o período ou o cemitério e gere o relatório novamente."
      />
    );
  }

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewScroll}>
        <table className={styles.previewTable}>
          <thead>
            <tr>
              {meta.columns.map((c) => (
                <th key={c.label} className={c.num ? styles.num : undefined}>{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((obj, i) => {
              const row = meta.toRow(obj);
              return (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td key={j} className={meta.columns[j].num ? styles.num : undefined}>{cell}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [paramsReport, setParamsReport] = useState(null);
  const [params, setParams] = useState(defaultParams);
  const [previewReport, setPreviewReport] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportForm, setExportForm] = useState(() => ({ reportId: REPORTS[0].id, ...defaultParams() }));
  const [remessaLoading, setRemessaLoading] = useState(null);
  const [feedback, setFeedback] = useState(null);

  // Histórico real de exportações/remessas (feature data-exports).
  const {
    data: exportsData,
    loading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useResource(({ signal }) => listDataExports({ perPage: 50 }, { signal }), []);
  const history = useMemo(() => (exportsData?.data ?? []).map(toHistoryRow), [exportsData]);

  const now = new Date();
  const monthSuffix = `/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`;
  const monthCount = useMemo(() => history.filter((h) => h.at.endsWith(monthSuffix)).length, [history, monthSuffix]);
  const orgCount = useMemo(() => history.filter((h) => h.remessa).length, [history]);
  const lastGenerated = history[0];

  // Cemitérios reais para o filtro (o restante do filtro é from/to).
  const { data: cemData } = useResource(
    ({ signal }) => listCemeteries({ perPage: 100 }, { signal }),
    []
  );
  const cemeteries = cemData?.data ?? [];
  const cemeteryName = (id) => (id ? cemeteries.find((c) => c.id === id)?.name || "Cemitério" : "Todos");

  // Exportação real de relatório (csv/xlsx/pdf) via useMutation.
  const { mutate: runExport, loading: exporting } = useMutation(exportReport);
  // Geração real de remessa (POST /data-exports) e download do arquivo gerado.
  const { mutate: runCreateExport } = useMutation(createDataExport);
  const { mutate: runDownload } = useMutation(downloadDataExport);

  function flash(message) {
    setFeedback(message);
    setTimeout(() => setFeedback(null), 4500);
  }

  function openParams(report) {
    setParams(defaultParams());
    setParamsReport(report);
  }

  // "Gerar relatório" abre a prévia com dados reais; o download sai da prévia.
  function generateReport() {
    const report = paramsReport;
    setParamsReport(null);
    setPreviewReport({ report, params });
  }

  // Baixa o relatório em preview no formato pedido (arquivo real da API).
  async function downloadReport(format) {
    if (!previewReport) return;
    const { report, params: p } = previewReport;
    const fmt = String(format).toLowerCase();
    try {
      await runExport(
        report.id,
        { from: p.from, to: p.to, cemeteryId: p.cemeteryId || undefined },
        fmt,
        `${report.id}-${p.from}_a_${p.to}.${fmt}`
      );
      flash(`Arquivo ${fmt.toUpperCase()} de "${report.name}" baixado.`);
    } catch (e) {
      flash(e?.message || "Não foi possível exportar o relatório.");
    }
  }

  // Exportação rápida a partir do botão "Exportar" do topo.
  async function quickExport(format) {
    const report = REPORTS.find((r) => r.id === exportForm.reportId);
    const fmt = String(format).toLowerCase();
    try {
      await runExport(
        exportForm.reportId,
        { from: exportForm.from, to: exportForm.to, cemeteryId: exportForm.cemeteryId || undefined },
        fmt,
        `${exportForm.reportId}-${exportForm.from}_a_${exportForm.to}.${fmt}`
      );
      flash(`Arquivo ${fmt.toUpperCase()} de "${report.name}" baixado.`);
      setExportOpen(false);
    } catch (e) {
      flash(e?.message || "Não foi possível exportar o relatório.");
    }
  }

  // Gera uma remessa oficial real e atualiza o histórico.
  async function generateRemessa(remessa) {
    setRemessaLoading(remessa.id);
    const isoToday = todayISO();
    const isoMonthStart = `${isoToday.slice(0, 7)}-01`;
    try {
      await runCreateExport({
        exportType: remessa.exportType,
        format: remessa.format,
        periodStart: isoMonthStart,
        periodEnd: isoToday,
      });
      await refetchHistory();
      flash("Remessa gerada e disponível no histórico para download.");
    } catch (e) {
      flash(e?.message || "Não foi possível gerar a remessa.");
    } finally {
      setRemessaLoading(null);
    }
  }

  // Baixa o arquivo real de um registro do histórico (se concluído).
  async function downloadHistory(row) {
    if (row.status !== "concluido" || !row.raw.fileUrl) {
      flash(`Exportação ${(STATUS_LABEL[row.status] || row.status).toLowerCase()} — arquivo indisponível.`);
      return;
    }
    try {
      await runDownload(row.raw, `${row.raw.exportType}-${row.at.replace(/\//g, "-")}.${row.raw.format}`);
    } catch (e) {
      flash(e?.message || "Não foi possível baixar o arquivo.");
    }
  }

  function catalogFor(category) {
    return (
      <div className={styles.tabContent}>
        <div className={`${styles.typeGrid} ${styles.reportGrid}`}>
          {REPORTS.filter((r) => r.category === category).map((r) => (
            <article key={r.id} className={styles.typeCard}>
              <div className={styles.typeCardHead}>
                <Badge tone={CATEGORIES[r.category].tone}>{CATEGORIES[r.category].label}</Badge>
              </div>
              <span className={styles.typeName}>{r.name}</span>
              <p className={styles.typeDesc}>{r.desc}</p>
              <div className={styles.reportAction}>
                <Button variant="secondary" size="sm" onClick={() => openParams(r)}>Gerar relatório</Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    );
  }

  const historyColumns = [
    {
      key: "name", label: "Relatório",
      render: (h) => (
        <div className={styles.docCell}>
          <span className={styles.reportName}>{h.name}</span>
          {h.remessa && <span className={styles.docType}>remessa para órgão público</span>}
        </div>
      ),
    },
    { key: "period", label: "Período", render: (h) => <span className={styles.refCell}>{h.period}</span> },
    {
      key: "generated", label: "Gerado",
      render: (h) => (
        <div className={styles.dates}>
          <span>{h.at}</span>
          <span className={styles.datesSub}>{h.by}</span>
        </div>
      ),
    },
    { key: "format", label: "Formato", render: (h) => <Badge tone={FORMAT_TONES[h.format] || "neutral"}>{h.format}</Badge> },
    {
      key: "action", label: "",
      render: (h) => (h.status === "concluido"
        ? <button className={styles.detailLink} onClick={() => downloadHistory(h)}>Baixar</button>
        : <span className={styles.docType}>{STATUS_LABEL[h.status] || h.status}</span>),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Relatórios</h1>
          <p className={styles.subtitle}>Indicadores de ocupação, sepultamentos, arrecadação e remessas para órgãos públicos</p>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => { setExportForm({ reportId: REPORTS[0].id, ...defaultParams() }); setExportOpen(true); }}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Exportar
          </Button>
        </div>
      </header>

      <div className={styles.stats}>
        {/* legenda derivada do mês corrente — monthCount já conta pelo mês de hoje */}
        <StatCard label="Gerados no mês" value={String(monthCount)} caption={currentMonthLabel()} />
        <StatCard label="Exportações p/ órgãos públicos" value={String(orgCount)} caption="cartório e prefeitura" />
        {/* Card "Agendados" removido: não existe agendamento de remessas na API
            (data-exports expõe só GET /, GET /:id e POST /) — o valor "2" era
            inventado. */}
        <StatCard label="Último gerado" value={lastGenerated ? lastGenerated.at : "—"} caption={lastGenerated ? lastGenerated.name : "nenhum relatório"} />
      </div>

      {feedback && <Alert tone="success">{feedback}</Alert>}

      <Tabs
        items={[
          { label: "Operacional", count: REPORTS.filter((r) => r.category === "operacional").length, content: catalogFor("operacional") },
          { label: "Financeiro", count: REPORTS.filter((r) => r.category === "financeiro").length, content: catalogFor("financeiro") },
          { label: "Cadastros", count: REPORTS.filter((r) => r.category === "cadastros").length, content: catalogFor("cadastros") },
        ]}
      />

      {/* ---------- exportação para órgãos públicos ---------- */}
      <section className={styles.orgSection}>
        <div className={styles.orgSectionHead}>
          <h2 className={styles.blockTitle}>Exportação para órgãos públicos</h2>
          <p className={styles.blockDesc}>Remessas no leiaute exigido por cada órgão, prontas para envio ou download.</p>
        </div>
        <div className={styles.orgGrid}>
          {REMESSAS.map((r) => (
            <article key={r.id} className={styles.orgCard}>
              <div className={styles.orgHead}>
                <span className={styles.orgIcon}>{r.icon}</span>
                <span className={styles.orgName}>{r.name}</span>
              </div>
              <p className={styles.orgDesc}>{r.desc}</p>
              <div className={styles.orgFoot}>
                <span className={styles.orgFormat}>Formato exigido: <code>{r.formatLabel}</code></span>
                <Button variant="secondary" size="sm" loading={remessaLoading === r.id} onClick={() => generateRemessa(r)}>
                  Gerar remessa
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* ---------- histórico ---------- */}
      <section className={styles.block}>
        <div>
          <h2 className={styles.blockTitle}>Histórico de relatórios gerados</h2>
          <p className={styles.blockDesc}>Relatórios e remessas ficam disponíveis para download por 12 meses.</p>
        </div>

        {historyLoading ? (
          <Skeleton variant="row" count={6} />
        ) : historyError ? (
          <ErrorState onRetry={refetchHistory} />
        ) : history.length === 0 ? (
          <EmptyState
            title="Nenhuma exportação gerada ainda"
            message="Gere um relatório ou uma remessa para órgãos públicos — os arquivos aparecem aqui para download."
          />
        ) : (
          <>
            <div className={styles.desktopTable}>
              <DataTable columns={historyColumns} rows={history} rowKey={(h) => h.id} emptyMessage="Nenhum relatório gerado ainda." />
            </div>

            <div className={styles.mobileList}>
              <span className={styles.mobileCount}>{history.length} relatório(s)</span>
              {history.map((h) => (
                <button key={h.id} className={styles.mobileCard} onClick={() => downloadHistory(h)}>
                  <div className={styles.mobileCardTop}>
                    <span className={styles.mobileCardName}>{h.name}</span>
                    <Badge tone={FORMAT_TONES[h.format] || "neutral"}>{h.format}</Badge>
                  </div>
                  <div className={styles.mobileCardBody}>
                    <span className={styles.mobileCardMeta}>{h.period}</span>
                    <span className={styles.mobileCardMeta}>{h.at} · {h.by}</span>
                  </div>
                  <span className={styles.mobileCardChevron}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ---------- parâmetros do relatório ---------- */}
      <Modal
        open={Boolean(paramsReport)}
        onClose={() => setParamsReport(null)}
        title="Gerar relatório"
        subtitle={paramsReport?.name}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setParamsReport(null)}>Cancelar</Button>
            <Button onClick={generateReport}>Gerar relatório</Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <FormField label="Período — de" required>
              <Input type="date" value={params.from} onChange={(e) => setParams({ ...params, from: e.target.value })} />
            </FormField>
            <FormField label="Período — até" required>
              <Input type="date" value={params.to} onChange={(e) => setParams({ ...params, to: e.target.value })} />
            </FormField>
            <FormField label="Cemitério">
              <Select value={params.cemeteryId} onChange={(e) => setParams({ ...params, cemeteryId: e.target.value })}>
                <option value="">Todos</option>
                {cemeteries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Formato">
              <Select value={params.format} onChange={(e) => setParams({ ...params, format: e.target.value })}>
                <option value="pdf">PDF</option>
                <option value="xlsx">XLSX (Excel)</option>
                <option value="csv">CSV</option>
              </Select>
            </FormField>
          </div>
          <Alert tone="info">
            A prévia abre em seguida com os dados consolidados até <strong>{TODAY}</strong> —
            o arquivo final sai com o cabeçalho do órgão gestor.
          </Alert>
        </div>
      </Modal>

      {/* ---------- prévia do relatório ---------- */}
      <Modal
        open={Boolean(previewReport)}
        onClose={() => setPreviewReport(null)}
        title={previewReport?.report.name || ""}
        subtitle={previewReport ? `Prévia — ${CATEGORIES[previewReport.report.category].label}` : ""}
        width={760}
        footer={
          previewReport && (
            <>
              <Button variant="secondary" loading={exporting} onClick={() => downloadReport("csv")}>Baixar CSV</Button>
              <Button loading={exporting} onClick={() => downloadReport(previewReport.params.format)}>
                Baixar {previewReport.params.format.toUpperCase()}
              </Button>
              <Button variant="ghost" onClick={() => setPreviewReport(null)}>Fechar</Button>
            </>
          )
        }
      >
        {previewReport && (
          <div className={styles.form}>
            <div className={styles.previewMeta}>
              <span className={styles.metaChip}>Período: {fmtDate(previewReport.params.from)} – {fmtDate(previewReport.params.to)}</span>
              <span className={styles.metaChip}>Cemitério: {cemeteryName(previewReport.params.cemeteryId)}</span>
              <span className={styles.metaChip}>Formato: {previewReport.params.format.toUpperCase()}</span>
              <span className={styles.metaChip}>Gerado em {TODAY}</span>
            </div>
            <ReportPreview report={previewReport.report} params={previewReport.params} />
            <p className={styles.previewNote}>
              Dados consolidados da base até {TODAY}. Use “Baixar CSV” para exportar o
              relatório no formato aberto — PDF e XLSX saem já formatados para impressão e planilha.
            </p>
          </div>
        )}
      </Modal>

      {/* ---------- exportação rápida (topo) ---------- */}
      <Modal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Exportar relatório"
        subtitle="Escolha o relatório, o período e o formato do arquivo"
        width={560}
        footer={<Button variant="ghost" onClick={() => setExportOpen(false)}>Fechar</Button>}
      >
        <div className={styles.form}>
          <FormField label="Relatório">
            <Select value={exportForm.reportId} onChange={(e) => setExportForm({ ...exportForm, reportId: e.target.value })}>
              {REPORTS.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </Select>
          </FormField>
          <div className={styles.formGrid}>
            <FormField label="Período — de">
              <Input type="date" value={exportForm.from} onChange={(e) => setExportForm({ ...exportForm, from: e.target.value })} />
            </FormField>
            <FormField label="Período — até">
              <Input type="date" value={exportForm.to} onChange={(e) => setExportForm({ ...exportForm, to: e.target.value })} />
            </FormField>
            <FormField label="Cemitério">
              <Select value={exportForm.cemeteryId} onChange={(e) => setExportForm({ ...exportForm, cemeteryId: e.target.value })}>
                <option value="">Todos</option>
                {cemeteries.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </FormField>
          </div>
          <span className={styles.sectionLabel}>Formato do arquivo</span>
          <div className={styles.actions}>
            {EXPORT_FORMATS.map((f) => (
              <Button key={f} variant="secondary" size="sm" loading={exporting} onClick={() => quickExport(f)}>
                Baixar {f.toUpperCase()}
              </Button>
            ))}
          </div>
          <Alert tone="info">
            Cada formato baixa direto: CSV aberto, XLSX para planilha e PDF pronto para impressão —
            com os dados consolidados até {TODAY}.
          </Alert>
        </div>
      </Modal>
    </div>
  );
}
