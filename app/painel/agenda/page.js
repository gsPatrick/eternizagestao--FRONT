"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listSchedules,
  createSchedule,
  changeScheduleStatus,
  adaptSchedule,
  composeNotes,
  toDateKey,
} from "@/lib/api/resources/schedules";
import { listChapels, listCemeteries } from "@/lib/api/resources/chapels";

const DAY_START = 7; // 07:00
const DAY_END = 19; // 19:00
const HOUR_PX = 56;

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]; // segunda-primeiro
const MONTHS = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

const TYPE_META = {
  velorio: { label: "Velório", tone: "navy" },
  sepultamento: { label: "Sepultamento", tone: "success" },
  exumacao: { label: "Exumação", tone: "warning" },
  outro: { label: "Outro", tone: "neutral" },
};

const STATUS_META = {
  agendado: { label: "Agendado", tone: "neutral" },
  confirmado: { label: "Confirmado", tone: "navy" },
  em_andamento: { label: "Em andamento", tone: "navy" },
  concluido: { label: "Concluído", tone: "success" },
  cancelado: { label: "Cancelado", tone: "danger" },
};

// lookups tolerantes: tipo/status inesperado do back nunca quebram o render
const typeMeta = (key) => TYPE_META[key] || TYPE_META.outro;
const statusMeta = (key) => STATUS_META[key] || { label: key, tone: "neutral" };
// classe visual do tipo (os 3 desenhados + neutro para o resto)
const typeClass = (key) => (TYPE_META[key] && key !== "outro" ? key : "outro");

/* ---------- utilidades de data (agenda dirigida por datas reais) ---------- */

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // segunda=0 … domingo=6
  d.setDate(d.getDate() - dow);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function fmtDayMonthYear(date) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${date.getFullYear()}`;
}

// semana (segunda→domingo) que contém a âncora
function buildWeek(anchor) {
  const start = startOfWeek(anchor);
  const todayKey = toDateKey(new Date());
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    const key = toDateKey(date);
    return {
      date,
      key,
      label: WEEKDAYS[i],
      num: String(date.getDate()).padStart(2, "0"),
      full: fmtDayMonthYear(date),
      today: key === todayKey,
    };
  });
}

// grade do mês (segunda-primeiro); apara a última semana se toda fora do mês
function buildMonth(anchor) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const todayKey = toDateKey(new Date());
  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = addDays(gridStart, i);
    cells.push({
      date,
      key: toDateKey(date),
      day: date.getDate(),
      muted: date.getMonth() !== anchor.getMonth(),
      today: toDateKey(date) === todayKey,
    });
  }
  const lastRow = cells.slice(35);
  if (lastRow.every((c) => c.muted)) return cells.slice(0, 35);
  return cells;
}

function toMinutes(time) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function overlaps(a, b) {
  return toMinutes(a.start) < toMinutes(b.end) && toMinutes(a.end) > toMinutes(b.start);
}

export default function AgendaPage() {
  const [anchor, setAnchor] = useState(() => new Date());
  const [view, setView] = useState("week");
  const [selectedDay, setSelectedDay] = useState(() => (new Date().getDay() + 6) % 7);
  const [placeFilter, setPlaceFilter] = useState("");
  const [detail, setDetail] = useState(null);
  const [newOpen, setNewOpen] = useState(false);
  const [nowMin, setNowMin] = useState(null);
  const [formError, setFormError] = useState(null);
  const [form, setForm] = useState(null); // inicializado ao abrir o modal

  const week = useMemo(() => buildWeek(anchor), [anchor]);
  const monthCells = useMemo(() => buildMonth(anchor), [anchor]);

  // vista de dia por padrão no mobile + linha do "agora"
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) setView("day");
    const update = () => {
      const now = new Date();
      setNowMin(now.getHours() * 60 + now.getMinutes());
    };
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, []);

  // período buscado: mês inteiro na vista mês, senão a semana corrente
  const range = useMemo(() => {
    if (view === "month") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const gridStart = startOfWeek(first);
      return { from: gridStart, to: addDays(gridStart, 42) };
    }
    const ws = startOfWeek(anchor);
    return { from: ws, to: addDays(ws, 7) };
  }, [view, anchor]);

  const { data, loading, error, refetch } = useResource(
    ({ signal }) =>
      listSchedules({ from: range.from.toISOString(), to: range.to.toISOString() }, { signal }),
    [range.from.getTime(), range.to.getTime()]
  );

  const events = useMemo(
    () => (Array.isArray(data) ? data : []).map(adaptSchedule),
    [data]
  );

  // cemitério ativo + suas capelas (para o select de local do velório)
  const { data: cemsData } = useResource(({ signal }) => listCemeteries({ signal }), []);
  const cemetery = cemsData?.data?.[0];
  const { data: chapelsData } = useResource(
    ({ signal }) => (cemetery ? listChapels(cemetery.id, { active: true }, { signal }) : Promise.resolve({ data: [] })),
    [cemetery?.id]
  );
  const chapels = chapelsData?.data ?? [];

  // opções do filtro de local: locais realmente presentes no período
  const placeOptions = useMemo(() => {
    const set = new Set();
    events.forEach((e) => {
      if (e.place && e.place !== "—") set.add(e.place);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [events]);

  // eventos por dia (chave YYYY-MM-DD), sem cancelados, respeitando o filtro
  const eventsByDay = useMemo(() => {
    const map = {};
    for (const e of events) {
      if (e.status === "cancelado") continue;
      if (placeFilter && e.place !== placeFilter) continue;
      (map[e.dateKey] = map[e.dateKey] || []).push(e);
    }
    return map;
  }, [events, placeFilter]);

  const dayEvents = (key) => eventsByDay[key] || [];

  // conflito no mesmo local (capela ou jazigo) — pré-checagem de UX; a API
  // também garante server-side (409 SCHEDULE_CONFLICT).
  const conflicts = useMemo(() => {
    if (!form) return [];
    if (toMinutes(form.end) <= toMinutes(form.start)) return [];
    const candidate = { start: form.start, end: form.end };
    return events.filter(
      (e) =>
        e.dateKey === form.dateKey &&
        e.status !== "cancelado" &&
        e.place === form.place &&
        overlaps(e, candidate)
    );
  }, [events, form]);

  const createMut = useMutation(createSchedule);
  const statusMut = useMutation(changeScheduleStatus);
  const saving = createMut.loading || statusMut.loading;

  function openNew() {
    const day = week[selectedDay] || week[0];
    setFormError(null);
    setForm({
      type: "velorio",
      dateKey: day.key,
      start: "09:00",
      end: "11:00",
      place: chapels[0]?.name || "",
      deceased: "",
      responsible: "",
    });
    setNewOpen(true);
  }

  // ao trocar o tipo, ajusta o local (capela para velório, texto livre p/ o resto)
  function changeType(nextType) {
    setForm((f) => ({
      ...f,
      type: nextType,
      place: nextType === "velorio" ? (chapels[0]?.name || "") : "",
    }));
  }

  function buildISO(dateKey, time) {
    const d = new Date(`${dateKey}T${time}:00`);
    return d.toISOString();
  }

  async function createEvent() {
    if (!cemetery) {
      setFormError("Nenhum cemitério disponível para agendar.");
      return;
    }
    setFormError(null);
    const isVelorio = form.type === "velorio";
    const body = {
      scheduleType: form.type,
      cemeteryId: cemetery.id,
      startsAt: buildISO(form.dateKey, form.start),
      endsAt: buildISO(form.dateKey, form.end),
      title: `${typeMeta(form.type).label} · ${form.deceased || "Sem nome"}`,
      notes: composeNotes({
        place: isVelorio ? undefined : form.place,
        responsible: form.responsible,
        deceased: form.deceased,
      }),
    };
    if (isVelorio) {
      const chapel = chapels.find((c) => c.name === form.place);
      if (chapel) body.chapelId = chapel.id;
    }
    try {
      await createMut.mutate(body);
      setNewOpen(false);
      refetch();
    } catch (e) {
      setFormError(e.message || "Não foi possível criar o agendamento.");
    }
  }

  async function setStatus(id, status) {
    try {
      await statusMut.mutate(id, status);
      setDetail(null);
      refetch();
    } catch (e) {
      // erro fica visível no Alert do detalhe
      setFormError(null);
    }
  }

  const hours = Array.from({ length: DAY_END - DAY_START + 1 }, (_, i) => DAY_START + i);
  const gridHeight = (DAY_END - DAY_START) * HOUR_PX;
  const nowTop =
    nowMin !== null && nowMin >= DAY_START * 60 && nowMin <= DAY_END * 60
      ? ((nowMin - DAY_START * 60) / 60) * HOUR_PX
      : null;

  const currentEvent = detail ? events.find((e) => e.id === detail) : null;
  const visibleDays = view === "week" ? week.map((_, i) => i) : [selectedDay];

  // rótulo do período no cabeçalho / subtítulo
  const periodLabel =
    view === "month"
      ? `${MONTHS[anchor.getMonth()]} de ${anchor.getFullYear()}`
      : `${week[0].num} — ${week[6].num} de ${MONTHS[week[6].date.getMonth()]} de ${week[6].date.getFullYear()}`;

  function goPrev() {
    setAnchor((a) => (view === "month" ? new Date(a.getFullYear(), a.getMonth() - 1, 1) : addDays(a, -7)));
  }
  function goNext() {
    setAnchor((a) => (view === "month" ? new Date(a.getFullYear(), a.getMonth() + 1, 1) : addDays(a, 7)));
  }
  function goToday() {
    const now = new Date();
    setAnchor(now);
    setSelectedDay((now.getDay() + 6) % 7);
  }

  const navLabel = view === "month" ? "mês" : "semana";

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Agenda</h1>
          <p className={styles.subtitle}>Velórios, sepultamentos e exumações · {periodLabel}</p>
        </div>
        <div className={styles.actions}>
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
          <Button
            onClick={openNew}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Novo agendamento
          </Button>
        </div>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.navGroup}>
          <button className={styles.navBtn} aria-label={`${navLabel} anterior`} onClick={goPrev}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          <Button variant="secondary" size="sm" onClick={goToday}>Hoje</Button>
          <button className={styles.navBtn} aria-label={`próximo(a) ${navLabel}`} onClick={goNext}>
            <svg viewBox="0 0 16 16" fill="none"><path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </div>
        <div className={styles.placeFilter}>
          <Select value={placeFilter} onChange={(e) => setPlaceFilter(e.target.value)}>
            <option value="">Todos os locais</option>
            {placeOptions.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </div>
        <div className={styles.legendRow}>
          {["velorio", "sepultamento", "exumacao"].map((key) => (
            <span key={key} className={styles.legendItem}>
              <span className={`${styles.legendDot} ${styles[`ev_${key}_dot`]}`} />
              {TYPE_META[key].label}
            </span>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState onRetry={refetch} />
      ) : loading ? (
        <div className={styles.calendar}>
          <div className={styles.bodyScroll}>
            <Skeleton variant="block" height={gridHeight} width="100%" />
          </div>
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          title="Nenhum agendamento neste período"
          message="Nada marcado por aqui. Agende um velório, sepultamento ou exumação para organizar o cemitério."
          action={<Button onClick={openNew}>Novo agendamento</Button>}
        />
      ) : (
        <>
          {view === "day" && (
            <div className={styles.dayChips}>
              {week.map((day, index) => (
                <button
                  key={day.key}
                  className={`${styles.dayChip} ${index === selectedDay ? styles.dayChipActive : ""} ${day.today ? styles.dayChipToday : ""}`}
                  onClick={() => setSelectedDay(index)}
                >
                  <span className={styles.dayChipLabel}>{day.label}</span>
                  <span className={styles.dayChipDate}>{day.num}</span>
                </button>
              ))}
            </div>
          )}

          {(view === "week" || view === "day") && (
            <div className={styles.calendar}>
              <div className={styles.bodyScroll}>
                <div className={styles.headRow} style={{ gridTemplateColumns: `56px repeat(${visibleDays.length}, 1fr)` }}>
                  <div />
                  {visibleDays.map((dayIndex) => (
                    <div key={week[dayIndex].key} className={`${styles.dayHead} ${week[dayIndex].today ? styles.dayHeadToday : ""}`}>
                      <span className={styles.dayHeadLabel}>{week[dayIndex].label}</span>
                      <span className={styles.dayHeadDate}>{week[dayIndex].num}</span>
                    </div>
                  ))}
                </div>

                <div
                  className={styles.bodyRow}
                  style={{ height: gridHeight, gridTemplateColumns: `56px repeat(${visibleDays.length}, 1fr)` }}
                >
                  <div className={styles.timeGutter}>
                    {hours.map((h) => (
                      <span key={h} className={styles.timeLabel} style={{ top: (h - DAY_START) * HOUR_PX + 4 }}>
                        {String(h).padStart(2, "0")}:00
                      </span>
                    ))}
                  </div>

                  {visibleDays.map((dayIndex) => (
                    <div key={week[dayIndex].key} className={`${styles.dayCol} ${week[dayIndex].today ? styles.dayColToday : ""}`}>
                      {hours.slice(1, -1).map((h) => (
                        <span key={h} className={styles.hourLine} style={{ top: (h - DAY_START) * HOUR_PX }} />
                      ))}

                      {week[dayIndex].today && nowTop !== null && (
                        <span className={styles.nowLine} style={{ top: nowTop }}>
                          <span className={styles.nowDot} />
                        </span>
                      )}

                      {dayEvents(week[dayIndex].key).map((event) => {
                        const top = ((toMinutes(event.start) - DAY_START * 60) / 60) * HOUR_PX;
                        const height = Math.max(((toMinutes(event.end) - toMinutes(event.start)) / 60) * HOUR_PX - 3, 26);
                        return (
                          <button
                            key={event.id}
                            className={`${styles.event} ${styles[`ev_${typeClass(event.type)}`]} ${event.status === "concluido" ? styles.eventDone : ""}`}
                            style={{ top, height }}
                            onClick={() => setDetail(event.id)}
                          >
                            <span className={styles.eventTime}>{event.start} – {event.end}</span>
                            <span className={styles.eventTitle}>{event.title}</span>
                            <span className={styles.eventPlace}>{event.place}</span>
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {view === "month" && (
            <div className={styles.monthGrid}>
              {WEEKDAYS.map((label) => (
                <span key={label} className={styles.monthDow}>{label}</span>
              ))}
              {monthCells.map((cell) => {
                const cellEvents = dayEvents(cell.key);
                return (
                  <button
                    key={cell.key}
                    className={`${styles.monthCell} ${cell.muted ? styles.monthCellMuted : ""} ${cell.today ? styles.monthCellToday : ""}`}
                    onClick={() => {
                      setAnchor(cell.date);
                      setSelectedDay((cell.date.getDay() + 6) % 7);
                      setView("day");
                    }}
                  >
                    <span className={styles.monthDay}>{cell.day}</span>
                    <span className={styles.monthEvents}>
                      {cellEvents.slice(0, 2).map((event) => (
                        <span key={event.id} className={`${styles.monthPill} ${styles[`ev_${typeClass(event.type)}`]}`}>
                          {event.start} {event.deceased.split(" ")[0]}
                        </span>
                      ))}
                      {cellEvents.length > 2 && <span className={styles.monthMore}>+{cellEvents.length - 2}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {view === "list" && (
            <div className={styles.agendaList}>
              {week.map((day) => {
                const list = dayEvents(day.key).slice().sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
                if (!list.length) return null;
                return (
                  <section key={day.key} className={styles.agendaDay}>
                    <header className={`${styles.agendaDayHead} ${day.today ? styles.agendaDayHeadToday : ""}`}>
                      <span className={styles.agendaDayNum}>{day.num}</span>
                      <span className={styles.agendaDayLabel}>{day.label} · {MONTHS[day.date.getMonth()]} de {day.date.getFullYear()} {day.today && "· hoje"}</span>
                    </header>
                    <ul className={styles.agendaItems}>
                      {list.map((event) => (
                        <li key={event.id}>
                          <button className={styles.agendaItem} onClick={() => setDetail(event.id)}>
                            <span className={styles.agendaTime}>{event.start}<em>{event.end}</em></span>
                            <span className={`${styles.agendaBar} ${styles[`ev_${typeClass(event.type)}_dot`]}`} />
                            <span className={styles.agendaBody}>
                              <span className={styles.agendaTitle}>{event.title}</span>
                              <span className={styles.agendaMeta}>{event.place} · {event.responsible}</span>
                            </span>
                            <Badge tone={statusMeta(event.status).tone}>{statusMeta(event.status).label}</Badge>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ---- detalhe do agendamento ---- */}
      <Modal
        open={Boolean(currentEvent)}
        onClose={() => setDetail(null)}
        title={currentEvent ? currentEvent.title : ""}
        subtitle={
          currentEvent
            ? `${fmtDayMonthYear(new Date(currentEvent.startsAt))} · ${currentEvent.start} – ${currentEvent.end}`
            : ""
        }
        footer={
          currentEvent && (
            <>
              {currentEvent.status !== "concluido" && currentEvent.status !== "cancelado" && (
                <Button variant="danger" loading={saving} onClick={() => setStatus(currentEvent.id, "cancelado")}>Cancelar</Button>
              )}
              <span className={styles.footSpacer} />
              <Button variant="ghost" onClick={() => setDetail(null)}>Fechar</Button>
              {currentEvent.status === "agendado" && (
                <Button loading={saving} onClick={() => setStatus(currentEvent.id, "confirmado")}>Confirmar</Button>
              )}
              {(currentEvent.status === "confirmado" || currentEvent.status === "em_andamento") && (
                <Button loading={saving} onClick={() => setStatus(currentEvent.id, "concluido")}>Concluir</Button>
              )}
            </>
          )
        }
      >
        {currentEvent && (
          <div className={styles.detailBody}>
            <div className={styles.detailBadges}>
              <Badge tone={typeMeta(currentEvent.type).tone} dot>{typeMeta(currentEvent.type).label}</Badge>
              <Badge tone={statusMeta(currentEvent.status).tone}>{statusMeta(currentEvent.status).label}</Badge>
            </div>
            <dl className={styles.detailGrid}>
              <div><dt>Sepultado</dt><dd>{currentEvent.deceased}</dd></div>
              <div><dt>Local</dt><dd>{currentEvent.place}</dd></div>
              <div><dt>Responsável</dt><dd>{currentEvent.responsible}</dd></div>
              <div><dt>Horário</dt><dd>{currentEvent.start} – {currentEvent.end}</dd></div>
            </dl>
            {statusMut.error && (
              <Alert tone="danger">{statusMut.error.message}</Alert>
            )}
            <Alert tone="info">
              O responsável recebe as confirmações e lembretes automaticamente por WhatsApp.
            </Alert>
            {currentEvent.graveId && (
              <Link href={`/painel/sepulturas/${currentEvent.graveId}`}>
                <Button variant="secondary" size="sm" full>Abrir jazigo vinculado</Button>
              </Link>
            )}
          </div>
        )}
      </Modal>

      {/* ---- novo agendamento (anticonflito do PDF) ---- */}
      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="Novo agendamento"
        subtitle="Controle de horários e capelas — sem conflitos"
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              loading={saving}
              disabled={!form || conflicts.length > 0 || toMinutes(form?.end || "0:0") <= toMinutes(form?.start || "0:0")}
              onClick={createEvent}
            >
              Agendar
            </Button>
          </>
        }
      >
        {form && (
          <div className={styles.detailBody}>
            <div className={styles.formGrid}>
              <FormField label="Tipo" required>
                <Select value={form.type} onChange={(e) => changeType(e.target.value)}>
                  {["velorio", "sepultamento", "exumacao"].map((key) => (
                    <option key={key} value={key}>{TYPE_META[key].label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Dia" required>
                <Select value={form.dateKey} onChange={(e) => setForm({ ...form, dateKey: e.target.value })}>
                  {week.map((day) => (
                    <option key={day.key} value={day.key}>{day.label}, {day.full}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Início" required>
                <Input type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} />
              </FormField>
              <FormField label="Fim" required>
                <Input type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} />
              </FormField>
              <FormField label={form.type === "velorio" ? "Capela / sala" : "Jazigo / local"} required>
                {form.type === "velorio" ? (
                  <Select value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })}>
                    {chapels.length === 0 && <option value="">Sem capelas cadastradas</option>}
                    {chapels.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </Select>
                ) : (
                  <Input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Ex.: A-R1-L2-003" />
                )}
              </FormField>
              <FormField label="Sepultado">
                <Input value={form.deceased} onChange={(e) => setForm({ ...form, deceased: e.target.value })} placeholder="Nome" />
              </FormField>
              <FormField label="Responsável">
                <Input value={form.responsible} onChange={(e) => setForm({ ...form, responsible: e.target.value })} placeholder="Contato da família" />
              </FormField>
            </div>

            {toMinutes(form.end) <= toMinutes(form.start) && (
              <Alert tone="warning">O horário de fim deve ser depois do início.</Alert>
            )}

            {formError && <Alert tone="danger">{formError}</Alert>}

            {conflicts.length > 0 ? (
              <Alert tone="danger" title="Conflito de horário detectado">
                {conflicts.map((c) => (
                  <span key={c.id} className={styles.conflictLine}>
                    {c.title} · {c.start} – {c.end} · {c.place}
                  </span>
                ))}
              </Alert>
            ) : (
              toMinutes(form.end) > toMinutes(form.start) && form.place && (
                <Alert tone="success">Horário livre em {form.place} — sem conflitos.</Alert>
              )
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
