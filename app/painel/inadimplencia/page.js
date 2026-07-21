"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";

import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import IntegrationRequired, { useIntegrationGuard } from "@/components/molecules/IntegrationRequired/IntegrationRequired";
import {
  getPanel,
  getSummary,
  blockPayer,
  unblockPayer,
  notifyPayer,
  notifyAll,
  syncBlocks,
} from "@/lib/api/resources/delinquency";

function money(v) {
  return (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// datas da API: DATEONLY ("YYYY-MM-DD") ou timestamp ISO → "dd/mm/aaaa" | null
function fmtDate(v) {
  if (!v) return null;
  const iso = String(v);
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("pt-BR");
}

// linha do painel (agrupada por pagador) → shape que a tabela/modal renderizam
function mapDebtor(r) {
  return {
    id: r.person?.id,
    name: r.person?.fullName || "Pagador sem cadastro",
    cpf: r.person?.cpf || "—",
    whatsapp: r.person?.whatsapp || "—",
    graves: (r.graves || []).map((g) => ({ code: g.code, id: g.id })),
    blocked: !!r.blocked,
    lastNotified: fmtDate(r.lastNotifiedAt),
    billings: (r.billings || []).map((b) => ({
      number: b.code || String(b.id || "").slice(0, 8) || "—",
      desc: b.description || b.referencePeriod || "Cobrança vencida",
      due: fmtDate(b.dueDate) || "—",
      days: b.daysOverdue ?? 0,
      amount: Number(b.totalAmount) || 0,
    })),
  };
}

function debtorTotal(d) {
  return d.billings.reduce((s, b) => s + b.amount, 0);
}

function oldestDays(d) {
  return d.billings.length ? Math.max(...d.billings.map((b) => b.days)) : 0;
}

export default function DelinquencyPage() {
  const [search, setSearch] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [notifyAllDone, setNotifyAllDone] = useState(false);
  const [actionError, setActionError] = useState(null);

  // ---- dados reais ----
  const panelRes = useResource(({ signal }) => getPanel({ perPage: 100 }, { signal }), []);
  const summaryRes = useResource(({ signal }) => getSummary({ signal }), []);

  const refetchAll = useCallback(() => {
    panelRes.refetch();
    summaryRes.refetch();
  }, [panelRes, summaryRes]);

  const loading = panelRes.loading || summaryRes.loading;
  const error = panelRes.error || summaryRes.error;
  const summary = summaryRes.data;

  const debtors = useMemo(
    () => (panelRes.data?.data ?? []).map(mapDebtor),
    [panelRes.data]
  );

  const detail = detailId ? debtors.find((d) => d.id === detailId) : null;

  // ---- mutations ----
  const blockMut = useMutation(blockPayer);
  const unblockMut = useMutation(unblockPayer);
  // Avisar inadimplente é exatamente o que depende de e-mail/WhatsApp: sem
  // provedor configurado a API recusa, e o operador precisa saber que o devedor
  // NÃO foi avisado — antes o sistema dizia "enviada" e ninguém recebia nada.
  const guard = useIntegrationGuard();
  const notifyMut = useMutation(notifyPayer);
  const notifyAllMut = useMutation(notifyAll);
  const syncMut = useMutation(syncBlocks);
  const saving =
    blockMut.loading || unblockMut.loading || notifyMut.loading ||
    notifyAllMut.loading || syncMut.loading;

  const filtered = useMemo(() => {
    return debtors.filter((d) => {
      const term = search.trim().toLowerCase();
      if (!term) return true;
      return (
        d.name.toLowerCase().includes(term) ||
        d.cpf.replace(/\D/g, "").includes(term.replace(/\D/g, "") || "␀") ||
        d.graves.some((g) => (g.code || "").toLowerCase().includes(term))
      );
    });
  }, [debtors, search]);

  const totals = useMemo(() => ({
    overdue: Number(summary?.overdueTotal) || 0,
    count: summary?.overdueBillings || 0,
    blocked: summary?.blockedGraves || 0,
  }), [summary]);

  const rate = summary
    ? Number(summary.delinquencyRate || 0).toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      })
    : "0,0";

  // aging: distribuição do vencido por faixa de atraso (vem do /summary)
  const aging = useMemo(() => {
    const buckets = (summary?.aging ?? []).map((a) => ({
      label: a.label,
      min: a.minDays,
      value: Number(a.total) || 0,
    }));
    const max = Math.max(...buckets.map((b) => b.value), 1);
    return buckets.map((b) => ({ ...b, pct: (b.value / max) * 100 }));
  }, [summary]);

  // sincroniza bloqueios com a situação de inadimplência (POST /sync-blocks)
  async function syncBlocksAction() {
    setActionError(null);
    try {
      const res = await syncMut.mutate();
      const nb = res?.blocked?.length || 0;
      const nu = res?.unblocked?.length || 0;
      setSyncResult(`${nb} jazigo(s) bloqueado(s) · ${nu} desbloqueado(s) — sincronizado com a inadimplência`);
      refetchAll();
    } catch (e) {
      setSyncResult(null);
      setActionError(e.message);
    }
  }

  async function notifyAllAction() {
    setActionError(null);
    try {
      await notifyAllMut.mutate();
      setNotifyAllDone(true);
      setTimeout(() => setNotifyAllDone(false), 4000);
      refetchAll();
    } catch (e) {
      if (guard.capture(e)) return;
      setActionError(e.message);
    }
  }

  async function notifyOne() {
    if (!detail) return;
    setActionError(null);
    try {
      await notifyMut.mutate(detail.id);
      refetchAll();
    } catch (e) {
      if (guard.capture(e)) return;
      setActionError(e.message);
    }
  }

  async function toggleBlock() {
    if (!detail) return;
    setActionError(null);
    try {
      if (detail.blocked) await unblockMut.mutate(detail.id);
      else await blockMut.mutate(detail.id);
      refetchAll();
    } catch (e) {
      if (guard.capture(e)) return;
      setActionError(e.message);
    }
  }

  function renderBody() {
    if (loading) {
      return (
        <>
          <section className={styles.stats}>
            <Skeleton variant="block" height={96} />
            <Skeleton variant="block" height={96} />
            <Skeleton variant="block" height={96} />
            <Skeleton variant="block" height={96} />
          </section>
          <Skeleton variant="block" height={170} />
          <Skeleton variant="row" count={6} />
        </>
      );
    }
    if (error) {
      return <ErrorState onRetry={refetchAll} />;
    }
    if (!debtors.length) {
      return (
        <EmptyState
          title="Nenhum débito em atraso — carteira em dia"
          message="Todas as cobranças estão em dia. Assim que uma cobrança vencer, o devedor aparece aqui automaticamente."
        />
      );
    }

    return (
      <>
        <section className={styles.stats}>
          <StatCard label="Índice de inadimplência" value={`${rate}%`} caption="dos valores a receber" />
          <StatCard label="Total vencido" value={money(totals.overdue)} caption={`${totals.count} cobranças vencidas`} />
          <StatCard label="A receber (a vencer)" value={money(summary?.pendingReceivable)} caption="pendentes em dia" />
          <StatCard label="Jazigos bloqueados" value={String(totals.blocked)} caption="operações suspensas" />
        </section>

        <Alert tone="warning" title="Bloqueio operacional automático">
          Jazigos com pendências financeiras ficam impedidos de receber <strong>novos
          sepultamentos e reformas</strong> até a regularização — os alertas de vencimento
          são enviados automaticamente por WhatsApp.
        </Alert>

        {/* aging do vencido */}
        <section className={styles.agingCard}>
          <header className={styles.agingHead}>
            <h2 className={styles.agingTitle}>Vencido por tempo de atraso</h2>
            <span className={styles.agingTotal}>{money(totals.overdue)}</span>
          </header>
          <div className={styles.agingBars}>
            {aging.map((bucket) => (
              <div key={bucket.label} className={styles.agingRow}>
                <span className={styles.agingLabel}>{bucket.label}</span>
                <div className={styles.agingTrack}>
                  <div
                    className={`${styles.agingFill} ${bucket.min > 90 ? styles.agingFillDanger : bucket.min > 30 ? styles.agingFillWarning : ""}`}
                    style={{ width: `${Math.max(bucket.pct, 2)}%` }}
                  />
                </div>
                <span className={styles.agingValue}>{money(bucket.value)}</span>
              </div>
            ))}
          </div>
        </section>

        <div className={styles.searchBox}>
          <Input
            placeholder="Buscar devedor por nome, CPF ou jazigo…"
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
              {
                key: "name",
                label: "Proprietário devedor",
                render: (row) => (
                  <span className={styles.personCell}>
                    <Avatar name={row.name} size="sm" />
                    <span className={styles.personInfo}>
                      <span className={styles.personName}>{row.name}</span>
                      <span className={styles.personCpf}>{row.cpf}</span>
                    </span>
                  </span>
                ),
              },
              {
                key: "graves",
                label: "Jazigos",
                render: (row) => (
                  <span className={styles.gravesCell}>
                    {row.graves.map((g) => (
                      <Link key={g.code} href={`/painel/sepulturas/${g.id}`} className={styles.graveLink}>{g.code}</Link>
                    ))}
                  </span>
                ),
              },
              { key: "count", label: "Vencidas", align: "right", render: (row) => <strong>{row.billings.length}</strong> },
              { key: "total", label: "Total devido", align: "right", render: (row) => <span className={styles.debtAmount}>{money(debtorTotal(row))}</span> },
              {
                key: "oldest",
                label: "Mais antiga",
                render: (row) => {
                  const days = oldestDays(row);
                  return <span className={`${styles.days} ${days > 90 ? styles.daysDanger : days > 30 ? styles.daysWarning : ""}`}>{days} dias</span>;
                },
              },
              {
                key: "blocked",
                label: "Bloqueio",
                render: (row) => row.blocked
                  ? <Badge tone="danger" dot>Bloqueado</Badge>
                  : <Badge tone="neutral">—</Badge>,
              },
              { key: "notified", label: "Último aviso", render: (row) => <span className={styles.notified}>{row.lastNotified || "nunca"}</span> },
              {
                key: "actions",
                label: "",
                align: "right",
                render: (row) => <button className={styles.detailLink} onClick={() => setDetailId(row.id)}>Detalhes</button>,
              },
            ]}
            rows={filtered}
            footer={<span>{filtered.length} devedores · {totals.count} cobranças vencidas</span>}
          />
        </div>

        <div className={styles.mobileList}>
          {filtered.map((row) => (
            <button key={row.id} className={styles.mobileCard} onClick={() => setDetailId(row.id)}>
              <div className={styles.mobileCardTop}>
                <span className={styles.personCell}>
                  <Avatar name={row.name} size="sm" />
                  <span className={styles.personName}>{row.name}</span>
                </span>
                {row.blocked ? <Badge tone="danger" dot>Bloqueado</Badge> : <Badge tone="warning" dot>{oldestDays(row)}d</Badge>}
              </div>
              <div className={styles.mobileCardBody}>
                <span className={styles.mobileCardAmount}>{money(debtorTotal(row))}</span>
                <span className={styles.mobileCardMeta}>{row.billings.length} vencida(s) · {row.graves.map((g) => g.code).join(", ")}</span>
              </div>
              <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
          <p className={styles.mobileCount}>{filtered.length} devedores</p>
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Inadimplência</h1>
          <p className={styles.subtitle}>Painel estratégico de valores a receber e cobranças vencidas</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" disabled={loading} onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button variant="secondary" loading={saving} disabled={loading} onClick={notifyAllAction}>Notificar todos</Button>
          <Button loading={saving} disabled={loading} onClick={syncBlocksAction}>Sincronizar bloqueios</Button>
        </div>
      </header>

      {syncResult && (
        <Alert tone="success" title="Bloqueios sincronizados">{syncResult}</Alert>
      )}
      {notifyAllDone && (
        <Alert tone="success" title="Notificações enviadas">
          Todos os devedores receberam o lembrete de débito por WhatsApp com os códigos de pagamento.
        </Alert>
      )}
      {actionError && (
        <Alert tone="danger" title="Não foi possível concluir a ação">{actionError}</Alert>
      )}

      {renderBody()}

      {/* ---- detalhe do devedor ---- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? detail.name : ""}
        subtitle={detail ? `${detail.cpf} · ${detail.whatsapp}` : ""}
        width={640}
        footer={
          detail && (
            <>
              <Button variant={detail.blocked ? "secondary" : "danger"} loading={saving} onClick={toggleBlock}>
                {detail.blocked ? "Desbloquear jazigos" : "Bloquear jazigos"}
              </Button>
              <span className={styles.footSpacer} />
              <Button variant="secondary" loading={saving} onClick={notifyOne}>Notificar por WhatsApp</Button>
              <Button variant="secondary" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            <div className={styles.debtSummary}>
              <div>
                <span className={styles.debtSummaryLabel}>Total devido</span>
                <span className={styles.debtSummaryValue}>{money(debtorTotal(detail))}</span>
              </div>
              <div className={styles.debtSummaryRight}>
                {detail.blocked && <Badge tone="danger" dot>Jazigos bloqueados</Badge>}
                <span className={styles.notifiedNote}>
                  Último aviso: <strong>{detail.lastNotified || "nunca"}</strong>
                </span>
              </div>
            </div>

            <ul className={styles.billList}>
              {detail.billings.map((bill) => (
                <li key={bill.number} className={styles.billRow}>
                  <div className={styles.billInfo}>
                    <span className={styles.billDesc}>{bill.desc}</span>
                    <span className={styles.billMeta}>{bill.number} · venceu {bill.due}</span>
                  </div>
                  <span className={`${styles.days} ${bill.days > 90 ? styles.daysDanger : styles.daysWarning}`}>{bill.days}d</span>
                  <span className={styles.billAmount}>{money(bill.amount)}</span>
                </li>
              ))}
            </ul>

            <Alert tone="info">
              Valores incluem multa e juros. A 2ª via com códigos atualizados é enviada
              junto com a notificação — pagamentos dão baixa automática e o desbloqueio
              pode ser sincronizado em um clique.
            </Alert>

            <Link href="/painel/cobrancas">
              <Button variant="ghost" size="sm" full>Ver todas as cobranças deste devedor</Button>
            </Link>
          </div>
        )}
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="devedores"
        totalCount={panelRes.data?.meta?.total ?? debtors.length}
        filteredCount={filtered.length}
      />

      <IntegrationRequired integration={guard.integration} onClose={guard.close} />
    </div>
  );
}
