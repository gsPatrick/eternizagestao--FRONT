"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./PublicAgenda.module.css";

import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { useResource } from "@/lib/api/useResource";
import { getPublicCemeteries, getPublicAgenda } from "@/lib/api/resources/public";

/**
 * Agenda pública do cemitério — mesmos 4 modos do painel (Dia · Semana · Mês ·
 * Agenda/lista), com o mesmo layout. Read-only e com informação pública:
 * velórios, sepultamentos e exumações. Temada pela cor do tenant.
 *
 * Fonte: API pública. Escolhe o PRIMEIRO cemitério do tenant
 * (GET /public/cemeteries) e carrega a agenda dele
 * (GET /public/cemeteries/:id/agenda). Estados: loading → error → vazio → conteúdo.
 */

const DAY_START = 8;
const DAY_END = 18;
const HOUR_PX = 54;

// getDay(): 0=Dom … 6=Sáb. Trabalhamos no fuso LOCAL — o MESMO do painel. As
// datas chegam em ISO/UTC e são convertidas para a hora local; renderizar em UTC
// fazia um sepultamento das 09:00 (BRT) aparecer como 12:00 na agenda pública.
const DOW_LABEL = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

// Rótulo por tipo + estilo (exumação reaproveita a cor de sepultamento) +
// duração padrão (só para desenhar o bloco na grade de horas).
const TYPE_LABEL = { velorio: "Velório", sepultamento: "Sepultamento", exumacao: "Exumação" };
const TYPE_STYLE = { velorio: "velorio", sepultamento: "sepultamento", exumacao: "sepultamento" };
const TYPE_DURATION_MIN = { velorio: 180, sepultamento: 60, exumacao: 60 };

function toMin(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function hhmm(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Segunda-feira (00:00 local) da semana que contém `d`.
function startOfWeekLocal(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const mondayOffset = (x.getDay() + 6) % 7; // Seg = 0
  x.setDate(x.getDate() - mondayOffset);
  return x;
}

// Converte os itens da API no shape que as views consomem.
function transformEvents(items) {
  return (items || [])
    .map((it) => {
      const start = new Date(it.dateTime);
      if (Number.isNaN(start.getTime())) return null;
      const style = TYPE_STYLE[it.type] || "sepultamento";
      const end = new Date(start.getTime() + (TYPE_DURATION_MIN[it.type] || 60) * 60000);
      return {
        id: it.id,
        date: start,
        key: dateKey(start),
        type: style, // usado nas classes CSS (ev_velorio / ev_sepultamento)
        label: TYPE_LABEL[it.type] || "Cerimônia",
        name: it.deceasedName || it.title || "Cerimônia",
        start: hhmm(start),
        end: hhmm(end),
        place: it.place || "Local a confirmar",
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

export default function PublicAgenda({ cityName, tenantSlug }) {
  const [view, setView] = useState("week");
  const [selectedDay, setSelectedDay] = useState(0);

  useEffect(() => {
    if (window.innerWidth <= 768) setView("day");
  }, []);

  // 1) cemitérios do tenant → 2) agenda do primeiro cemitério
  const cemeteries = useResource(
    ({ signal }) =>
      tenantSlug ? getPublicCemeteries({ tenant: tenantSlug, signal }) : Promise.resolve([]),
    [tenantSlug]
  );
  const cemeteryId = cemeteries.data?.[0]?.id || null;

  const agenda = useResource(
    ({ signal }) =>
      cemeteryId ? getPublicAgenda(cemeteryId, { tenant: tenantSlug, signal }) : Promise.resolve([]),
    [cemeteryId, tenantSlug]
  );

  const events = useMemo(() => transformEvents(agenda.data), [agenda.data]);

  // Ancora a semana/mês na PRIMEIRA cerimônia (assim as views Dia/Semana/Mês
  // mostram dados reais); sem eventos, ancora em hoje.
  const anchor = useMemo(() => {
    const base = events.length ? events[0].date : new Date();
    return startOfWeekLocal(base);
  }, [events]);

  const todayKey = dateKey(new Date());

  // Semana ancorada (Seg → Dom)
  const WEEK = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(anchor);
      d.setDate(anchor.getDate() + i);
      const key = dateKey(d);
      return { label: DOW_LABEL[d.getDay()], date: pad(d.getDate()), key, today: key === todayKey, dateObj: d };
    });
  }, [anchor, todayKey]);

  const todayIndex = Math.max(0, WEEK.findIndex((d) => d.today));

  useEffect(() => {
    setSelectedDay(todayIndex >= 0 ? todayIndex : 0);
  }, [todayIndex]);

  const eventsByKey = useMemo(() => {
    const map = {};
    for (const e of events) (map[e.key] ||= []).push(e);
    return map;
  }, [events]);

  // Mês ancorado — grade completa (Seg-primeiro), eventos casados por data.
  const MONTH_CELLS = useMemo(() => {
    const year = anchor.getFullYear();
    const monthDate = events.length ? events[0].date : anchor;
    const month = monthDate.getMonth();
    const first = new Date(year, month, 1);
    const startDow = (first.getDay() + 6) % 7; // Seg = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const total = Math.ceil((startDow + daysInMonth) / 7) * 7;
    const gridStart = new Date(first);
    gridStart.setDate(1 - startDow);
    return Array.from({ length: total }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const key = dateKey(d);
      const inMonth = d.getMonth() === month;
      return {
        day: d.getDate(),
        muted: !inMonth,
        today: key === todayKey,
        key,
        weekIndex: WEEK.findIndex((w) => w.key === key),
        events: inMonth ? eventsByKey[key] || [] : [],
      };
    });
  }, [anchor, events, eventsByKey, WEEK, todayKey]);

  // Lista/Agenda — todos os dias com eventos (não só a semana ancorada).
  const AGENDA_DAYS = useMemo(() => {
    const keys = Object.keys(eventsByKey).sort();
    return keys.map((key) => {
      const list = eventsByKey[key].slice().sort((a, b) => toMin(a.start) - toMin(b.start));
      const d = list[0].date;
      return {
        key,
        date: pad(d.getDate()),
        label: DOW_LABEL[d.getDay()],
        month: MONTHS[d.getMonth()],
        today: key === todayKey,
        items: list,
      };
    });
  }, [eventsByKey, todayKey]);

  const hours = useMemo(
    () => Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i),
    []
  );
  const gridHeight = (DAY_END - DAY_START) * HOUR_PX;
  const visibleDays = view === "week" ? WEEK.map((_, i) => i) : [selectedDay];
  const dayEvents = (dayIndex) => eventsByKey[WEEK[dayIndex]?.key] || [];

  // Faixa de datas no subtítulo (dinâmica).
  const rangeLabel = `${WEEK[0].date} — ${WEEK[6].date} de ${MONTHS[WEEK[0].dateObj.getMonth()]} de ${WEEK[0].dateObj.getFullYear()}`;

  // Estados — a agenda (grade) é SEMPRE exibida; sem cerimônias, a grade
  // aparece vazia (ancorada na semana atual), igual ao painel.
  const loading = cemeteries.loading || (cemeteryId && agenda.loading);
  const error = cemeteries.error || agenda.error;
  const retry = () => {
    cemeteries.refetch();
    agenda.refetch();
  };

  return (
    <section className={styles.section} id="agenda">
      <div className={styles.inner}>
        <header className={styles.head}>
          <div>
            <span className={styles.kicker}>Agenda pública</span>
            <h2 className={styles.title}>Velórios e sepultamentos</h2>
            <p className={styles.sub}>
              Cerimônias programadas{cityName ? ` no ${cityName}` : ""} · {rangeLabel}.
            </p>
          </div>
          {!loading && !error && (
            <div className={styles.viewToggle}>
              {[["day", "Dia"], ["week", "Semana"], ["month", "Mês"], ["list", "Agenda"]].map(([key, label]) => (
                <button
                  key={key}
                  className={`${styles.viewBtn} ${view === key ? styles.viewBtnActive : ""}`}
                  onClick={() => setView(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </header>

        {/* ---- LOADING ---- */}
        {loading && (
          <div className={styles.calendar} aria-busy="true">
            <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 4 }}>
              <Skeleton variant="line" width="40%" />
              <Skeleton variant="block" height={gridHeight} />
            </div>
          </div>
        )}

        {/* ---- ERROR ---- */}
        {!loading && error && <ErrorState onRetry={retry} />}

        {/* ---- CONTEÚDO (grade SEMPRE visível; vazia quando não há cerimônias) ---- */}
        {!loading && !error && (
          <>
            {/* toolbar: navegação + legenda */}
            <div className={styles.toolbar}>
              <div className={styles.navGroup}>
                <button className={styles.navBtn} aria-label="Anterior">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <button className={styles.todayBtn} onClick={() => setSelectedDay(todayIndex)}>Hoje</button>
                <button className={styles.navBtn} aria-label="Próximo">
                  <svg viewBox="0 0 16 16" fill="none"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
              </div>
              <div className={styles.legendRow}>
                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.ev_velorio_dot}`} /> Velório</span>
                <span className={styles.legendItem}><span className={`${styles.legendDot} ${styles.ev_sepultamento_dot}`} /> Sepultamento</span>
              </div>
            </div>

            {/* chips de dia (só no modo dia) */}
            {view === "day" && (
              <div className={styles.dayChips}>
                {WEEK.map((day, index) => (
                  <button
                    key={day.key}
                    className={`${styles.dayChip} ${index === selectedDay ? styles.dayChipActive : ""} ${day.today ? styles.dayChipToday : ""}`}
                    onClick={() => setSelectedDay(index)}
                  >
                    <span className={styles.dayChipLabel}>{day.label}</span>
                    <span className={styles.dayChipDate}>{day.date}</span>
                  </button>
                ))}
              </div>
            )}

            {/* ---- DIA / SEMANA: grade de horas ---- */}
            {(view === "week" || view === "day") && (
              <div className={styles.calendar}>
                <div className={styles.bodyScroll}>
                  <div className={styles.headRow} style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, 1fr)` }}>
                    <div />
                    {visibleDays.map((dayIndex) => (
                      <div key={dayIndex} className={`${styles.dayHead} ${WEEK[dayIndex].today ? styles.dayHeadToday : ""}`}>
                        <span className={styles.dayHeadLabel}>{WEEK[dayIndex].label}</span>
                        <span className={styles.dayHeadDate}>{WEEK[dayIndex].date}</span>
                      </div>
                    ))}
                  </div>

                  <div className={styles.bodyRow} style={{ height: gridHeight, gridTemplateColumns: `56px repeat(${visibleDays.length}, 1fr)` }}>
                    <div className={styles.timeGutter}>
                      {hours.map((h) => (
                        <span key={h} className={styles.timeLabel} style={{ top: (h - DAY_START) * HOUR_PX + 4 }}>
                          {String(h).padStart(2, "0")}:00
                        </span>
                      ))}
                    </div>

                    {visibleDays.map((dayIndex) => (
                      <div key={dayIndex} className={`${styles.dayCol} ${WEEK[dayIndex].today ? styles.dayColToday : ""}`}>
                        {hours.slice(1, -1).map((h) => (
                          <span key={h} className={styles.hourLine} style={{ top: (h - DAY_START) * HOUR_PX }} />
                        ))}
                        {dayEvents(dayIndex).map((event) => {
                          const top = Math.max(((toMin(event.start) - DAY_START * 60) / 60) * HOUR_PX, 0);
                          const height = Math.max(((toMin(event.end) - toMin(event.start)) / 60) * HOUR_PX - 3, 28);
                          return (
                            <div key={event.id} className={`${styles.event} ${styles[`ev_${event.type}`]}`} style={{ top, height }}>
                              <span className={styles.eventTime}>{event.start} – {event.end}</span>
                              <span className={styles.eventTitle}>{event.label} · {event.name}</span>
                              <span className={styles.eventPlace}>{event.place}</span>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ---- MÊS ---- */}
            {view === "month" && (
              <div className={styles.monthGrid}>
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((label) => (
                  <span key={label} className={styles.monthDow}>{label}</span>
                ))}
                {MONTH_CELLS.map((cell, index) => {
                  const cellEvents = cell.events;
                  return (
                    <button
                      key={index}
                      className={`${styles.monthCell} ${cell.muted ? styles.monthCellMuted : ""} ${cell.today ? styles.monthCellToday : ""}`}
                      onClick={() => {
                        if (cell.weekIndex >= 0) { setSelectedDay(cell.weekIndex); setView("day"); }
                      }}
                    >
                      <span className={styles.monthDay}>{cell.day}</span>
                      <span className={styles.monthEvents}>
                        {cellEvents.slice(0, 2).map((event) => (
                          <span key={event.id} className={`${styles.monthPill} ${styles[`ev_${event.type}`]}`}>
                            {event.start} {event.name.split(" ")[0]}
                          </span>
                        ))}
                        {cellEvents.length > 2 && <span className={styles.monthMore}>+{cellEvents.length - 2}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ---- LISTA / AGENDA ---- */}
            {view === "list" && (
              <div className={styles.agendaList}>
                {AGENDA_DAYS.length === 0 && (
                  <EmptyState
                    title="Nenhum velório ou sepultamento agendado"
                    message="Não há cerimônias públicas programadas no momento. Em caso de dúvida, fale com a administração do cemitério."
                  />
                )}
                {AGENDA_DAYS.map((day) => (
                  <section key={day.key} className={styles.agendaDay}>
                    <header className={`${styles.agendaDayHead} ${day.today ? styles.agendaDayHeadToday : ""}`}>
                      <span className={styles.agendaDayNum}>{day.date}</span>
                      <span className={styles.agendaDayLabel}>{day.label} · {day.month} {day.today ? "· hoje" : ""}</span>
                    </header>
                    <ul className={styles.agendaItems}>
                      {day.items.map((event) => (
                        <li key={event.id}>
                          <div className={styles.agendaItem}>
                            <span className={styles.agendaTime}>{event.start}<em>{event.end}</em></span>
                            <span className={`${styles.agendaBar} ${styles[`ev_${event.type}_dot`]}`} />
                            <span className={styles.agendaBody}>
                              <span className={styles.agendaTitle}>{event.label} · {event.name}</span>
                              <span className={styles.agendaMeta}>{event.place}</span>
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}

            <p className={styles.note}>
              Informações sujeitas a alteração. Em caso de dúvida, fale com a administração do cemitério.
            </p>
          </>
        )}
      </div>
    </section>
  );
}
