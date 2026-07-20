"use client";

import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import StatCard from "@/components/molecules/StatCard/StatCard";
import LiveClock from "@/components/molecules/LiveClock/LiveClock";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

/* -------------------------------------------------------------------------
 * Formatação e mapeamentos — o FRONT é dono da apresentação; a API serve os
 * números crus (ver lib/api/resources/dashboard.js).
 * ------------------------------------------------------------------------- */
const MONTHS_PT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const nfInt = new Intl.NumberFormat("pt-BR");
const nfBRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const fmtInt = (n) => nfInt.format(Math.round(n || 0));
const fmtBRL = (n) => nfBRL.format(n || 0);
const fmtMil = (n) => {
  const v = n || 0;
  return Math.abs(v) >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace(".", ",")} mil` : nfBRL.format(v);
};
const fmtPct = (n) => `${String(n ?? 0).replace(".", ",")}%`;
const monthLabel = (ym) => MONTHS_PT[parseInt(String(ym).slice(5, 7), 10) - 1] || ym;
const timeOf = (iso) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const relTime = (iso) => {
  const d = new Date(iso);
  const min = Math.round((Date.now() - d.getTime()) / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const days = Math.round(h / 24);
  if (days === 1) return "ontem";
  if (days < 7) return `há ${days} dias`;
  return d.toLocaleDateString("pt-BR");
};
const pctChange = (cur, prev) => (prev ? ((cur - prev) / prev) * 100 : null);
const fmtDelta = (p) => `${Math.abs(p).toFixed(1).replace(".", ",")}%`;

const AGENDA_BADGE = {
  velorio: <Badge tone="navy">Velório</Badge>,
  sepultamento: <Badge tone="success">Sepultamento</Badge>,
  exumacao: <Badge tone="warning">Exumação</Badge>,
  visita_tecnica: <Badge tone="navy">Visita técnica</Badge>,
  outro: <Badge tone="navy">Evento</Badge>,
};

const activityIconKey = (entityType, action) => {
  if (action === "exclusao") return "block";
  switch (entityType) {
    case "Sepultamento":
      return "burial";
    case "Exumação":
      return "exhum";
    case "Cobrança":
      return "payment";
    case "Documento":
      return "doc";
    default:
      return "doc";
  }
};
const ACTIVITY_TONE = { payment: "success", burial: "navy", doc: "navy", exhum: "warning", block: "danger" };

const ACTIVITY_ICONS = {
  payment: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4 8.2l2.6 2.6 5.4-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  burial: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4.5 13V6.5a3.5 3.5 0 017 0V13M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  doc: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M4.5 2.5h5L12 5v8.5h-7.5v-11z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M6.5 8h3.5M6.5 10.5h2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  block: (
    <svg viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="5.6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.2 4.2l7.6 7.6" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  exhum: (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 12V4M8 4L5.4 6.6M8 4l2.6 2.6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 13.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const DONUT_GAP = 1.6;

function DonutChart({ data }) {
  let acc = 0;
  const segments = data.map((seg) => {
    const start = acc;
    acc += seg.value;
    return { ...seg, start };
  });

  return (
    <svg viewBox="0 0 100 100" className={styles.donutSvg} role="img" aria-label="Distribuição de ocupação">
      <circle cx="50" cy="50" r="41" className={styles.donutTrack} />
      {segments.map((seg) => {
        const dash = Math.max(seg.value - DONUT_GAP, 0.4);
        return (
          <circle
            key={seg.label}
            cx="50"
            cy="50"
            r="41"
            pathLength="100"
            className={styles.donutSeg}
            stroke={seg.color}
            strokeDasharray={`${dash} ${100 - dash}`}
            strokeDashoffset={-(seg.start + DONUT_GAP / 2)}
          />
        );
      })}
    </svg>
  );
}

/**
 * Apresentação pura do dashboard. Recebe `data` no MESMO shape que a API
 * (getDashboard) retorna e renderiza tudo — sem fetch, sem loading/error.
 * Usado pelo painel real (app/painel/page.js) e pela vitrine da landing
 * (PanelShowcase, com dados mockados).
 */
export function DashboardView({ data }) {
  // ---- transformação do shape da API para o que os componentes leem ----
  const occ = data?.occupancy ?? { total: 0, byStatus: [] };
  const occupiedCount = occ.byStatus.find((s) => s.slug === "ocupada")?.count ?? 0;
  const occupancyRate = occ.total ? Math.round((occupiedCount / occ.total) * 100) : 0;
  const occSegments = occ.byStatus.map((s) => ({
    label: s.statusName,
    value: occ.total ? Math.round((s.count / occ.total) * 1000) / 10 : 0,
    color: s.color || "#8b99ab",
  }));

  const series = data?.revenueSeries ?? [];
  const revMonths = series.map((r, i) => ({
    label: monthLabel(r.month),
    value: (r.total || 0) / 1000,
    current: i === series.length - 1,
  }));
  const maxRevenue = Math.max(1, ...revMonths.map((m) => m.value));
  const lastTotal = series.length ? series[series.length - 1].total : 0;
  const prevTotal = series.length > 1 ? series[series.length - 2].total : 0;
  const revChange = pctChange(lastTotal, prevTotal);
  const revUp = (revChange ?? 0) >= 0;

  const finance = data?.finance ?? { receivedThisMonth: 0, overdueTotal: 0, overdueCount: 0 };

  const agenda = (data?.todaySchedule ?? []).map((s) => ({
    key: s.id,
    time: timeOf(s.startsAt),
    type: s.scheduleType,
    title: s.title || s.deceasedName || "Evento",
    place: s.place || "—",
  }));

  const debtors = (data?.topDebtors ?? []).map((d) => ({
    key: d.personId,
    name: d.personName || "—",
    grave: d.graveCode || "—",
    amount: fmtBRL(d.overdueTotal),
    count: d.overdueCount,
  }));

  const activity = (data?.recentActivity ?? []).map((a) => {
    const type = activityIconKey(a.entityType, a.action);
    return {
      key: a.id,
      type,
      tone: ACTIVITY_TONE[type],
      text: a.description || `${a.entityType || "Registro"} ${a.action || ""}`.trim(),
      time: relTime(a.createdAt),
    };
  });

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Visão geral</h1>
          <p className={styles.subtitle}>
            <LiveClock suffix="Cemitério Municipal" />
          </p>
        </div>
        <div className={styles.actions}>
          <Link href="/painel/cobrancas">
            <Button variant="secondary">Gerar cobranças</Button>
          </Link>
          <Link href="/painel/sepultamentos?novo=1">
            <Button
              iconLeft={
                <svg viewBox="0 0 16 16" fill="none">
                  <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                </svg>
              }
            >
              Registrar sepultamento
            </Button>
          </Link>
        </div>
      </header>

      <section className={styles.stats}>
        <StatCard label="Jazigos ocupados" value={fmtInt(occupiedCount)} caption={`de ${fmtInt(occ.total)} unidades`} />
        <StatCard
          label="Arrecadação do mês"
          value={fmtMil(finance.receivedThisMonth)}
          delta={revChange != null ? fmtDelta(revChange) : undefined}
          deltaTone={revUp ? "success" : "danger"}
          caption="até hoje"
        />
        <StatCard
          label="Inadimplência"
          value={fmtPct(data?.delinquencyRate)}
          deltaTone="danger"
          caption={`${finance.overdueCount} cobranças vencidas`}
        />
        <StatCard label="Sepultamentos" value={fmtInt(data?.burialsThisMonth)} caption="no mês" />
      </section>

      <section className={styles.mainGrid}>
        <article className={`${styles.card} ${styles.revenue}`}>
          <header className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Arrecadação</h2>
              <p className={styles.cardSub}>Últimos 12 meses</p>
            </div>
            <Link href="/painel/relatorios" className={styles.cardLink}>Ver relatório</Link>
          </header>
          <div className={styles.revenueHero}>
            <strong className={styles.revenueValue}>{fmtMil(lastTotal)}</strong>
            {revChange != null && (
              <span className={styles.revenueDelta}>
                <svg viewBox="0 0 12 12" fill="none" style={revUp ? undefined : { transform: "scaleY(-1)" }}>
                  <path d="M6 9.5V2.5M6 2.5L2.8 5.7M6 2.5l3.2 3.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {fmtDelta(revChange)}
              </span>
            )}
            {series.length > 1 && (
              <span className={styles.revenueCaption}>vs. {monthLabel(series[series.length - 2].month)}</span>
            )}
          </div>
          {revMonths.length ? (
            <div className={styles.chart} role="img" aria-label="Gráfico de arrecadação dos últimos 12 meses">
              <div className={styles.chartGrid} aria-hidden="true" />
              {revMonths.map((month, i) => (
                <div key={`${month.label}-${i}`} className={styles.chartCol}>
                  <span className={styles.chartTip}>R$ {month.value.toFixed(1).replace(".", ",")} mil</span>
                  <div
                    className={`${styles.chartBar} ${month.current ? styles.chartBarCurrent : ""}`}
                    style={{ height: `${(month.value / maxRevenue) * 100}%` }}
                  />
                  <span className={styles.chartLabel}>{month.label}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="Sem arrecadação registrada" message="Os pagamentos confirmados aparecerão aqui mês a mês." />
          )}
        </article>

        <article className={`${styles.card} ${styles.occupancy}`}>
          <header className={styles.cardHead}>
            <div>
              <h2 className={styles.cardTitle}>Ocupação</h2>
              <p className={styles.cardSub}>Situação das {fmtInt(occ.total)} unidades</p>
            </div>
          </header>
          {occSegments.length ? (
            <div className={styles.donutWrap}>
              <div className={styles.donut}>
                <DonutChart data={occSegments} />
                <div className={styles.donutHole}>
                  <strong>{occupancyRate}%</strong>
                  <span>ocupação</span>
                </div>
              </div>
              <ul className={styles.legend}>
                {occSegments.map((seg) => (
                  <li key={seg.label} className={styles.legendItem}>
                    <span className={styles.legendDot} style={{ background: seg.color }} />
                    <span className={styles.legendLabel}>{seg.label}</span>
                    <span className={styles.legendValue}>{seg.value}%</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <EmptyState title="Nenhuma sepultura cadastrada" message="Cadastre as sepulturas para acompanhar a ocupação do cemitério." />
          )}
        </article>
      </section>

      <section className={styles.bottomGrid}>
        <article className={styles.card}>
          <header className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Agenda de hoje</h2>
            <Link href="/painel/agenda" className={styles.cardLink}>Ver agenda</Link>
          </header>
          {agenda.length ? (
            <ul className={styles.agendaList}>
              {agenda.map((item) => (
                <li key={item.key} className={styles.agendaItem}>
                  <span className={styles.agendaTime}>{item.time}</span>
                  <span className={styles.agendaRail} />
                  <div className={styles.agendaBody}>
                    <div className={styles.agendaRow}>{AGENDA_BADGE[item.type] || AGENDA_BADGE.outro}</div>
                    <span className={styles.agendaTitle}>{item.title}</span>
                    <span className={styles.agendaPlace}>{item.place}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Agenda livre por hoje" message="Nenhum evento agendado para hoje neste cemitério." />
          )}
        </article>

        <article className={styles.card}>
          <header className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Inadimplência</h2>
            <Link href="/painel/inadimplencia" className={styles.cardLink}>Ver painel</Link>
          </header>
          {debtors.length ? (
            <>
              <ul className={styles.debtorList}>
                {debtors.map((debtor) => (
                  <li key={debtor.key} className={styles.debtorItem}>
                    <Avatar name={debtor.name} size="sm" />
                    <div className={styles.debtorInfo}>
                      <span className={styles.debtorName}>{debtor.name}</span>
                      <span className={styles.debtorGrave}>{debtor.grave}</span>
                    </div>
                    <div className={styles.debtorMeta}>
                      <span className={styles.debtorAmount}>{debtor.amount}</span>
                      <span className={styles.debtorMonths}>
                        {debtor.count} {debtor.count === 1 ? "cobrança" : "cobranças"}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <footer className={styles.debtorFooter}>
                <span>Total em atraso</span>
                <strong>{fmtBRL(finance.overdueTotal)}</strong>
              </footer>
            </>
          ) : (
            <EmptyState title="Em dia com as cobranças" message="Nenhuma cobrança em atraso no momento." />
          )}
        </article>

        <article className={styles.card}>
          <header className={styles.cardHead}>
            <h2 className={styles.cardTitle}>Atividade recente</h2>
            <Link href="/painel/auditoria" className={styles.cardLink}>Ver tudo</Link>
          </header>
          {activity.length ? (
            <ul className={styles.activityList}>
              {activity.map((event) => (
                <li key={event.key} className={styles.activityItem}>
                  <span className={`${styles.activityIcon} ${styles[`tone_${event.tone}`]}`}>
                    {ACTIVITY_ICONS[event.type]}
                  </span>
                  <div className={styles.activityBody}>
                    <span className={styles.activityText}>{event.text}</span>
                    <span className={styles.activityTime}>{event.time}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sem movimentações ainda" message="As ações registradas no sistema aparecerão aqui." />
          )}
        </article>
      </section>
    </div>
  );
}
