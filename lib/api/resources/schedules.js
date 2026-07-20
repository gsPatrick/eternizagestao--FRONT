import { api } from "@/lib/api/client";

/* ============================================================================
 * Agenda (schedules) — resource fino sobre o client da API.
 * Uma função por endpoint real de src/features/schedules/schedules.routes.js.
 * Sem estado, sem React. O front é a fonte da verdade do shape consumido pela
 * página; os adapters ao final mapeiam o payload da API para o modelo de evento
 * que a app/painel/agenda já renderiza.
 * ==========================================================================*/

// LISTA por período (calendário). NÃO é paginada (findAll no back) → array direto.
// params: { from, to, cemeteryId?, chapelId?, scheduleType?, status? }
// from/to são obrigatórios na prática (sem eles o back limita aos próximos 30 dias).
export const listSchedules = (params, opts) =>
  api.get("/schedules", { params, ...opts });

// StatCard "Agendados hoje" → { total, byType }. Consumido por OUTRA tela
// (dashboard) — mantido no resource; o endpoint NÃO deve ser removido no back.
export const getSchedulesTodayCount = (opts) =>
  api.get("/schedules/today-count", opts);

export const getSchedule = (id, opts) => api.get(`/schedules/${id}`, opts);

// criar. body: { scheduleType, cemeteryId, startsAt, endsAt, chapelId?, graveId?,
//   deceasedId?, exhumationId?, responsiblePersonId?, title?, notes? }
export const createSchedule = (body) => api.post("/schedules", body);

// reagendar/editar. body: { startsAt?, endsAt?, chapelId?, title?, notes?, responsiblePersonId? }
export const updateSchedule = (id, body) => api.patch(`/schedules/${id}`, body);

// transição de status: agendado→confirmado→em_andamento→concluido | cancelado.
export const changeScheduleStatus = (id, status) =>
  api.patch(`/schedules/${id}/status`, { status });

/* ============================================================================
 * Adapters de apresentação — payload da API → modelo de evento do front.
 * ==========================================================================*/

// tipos que a API entende × os 3 que a página desenha. visita_tecnica/outro
// caem em "outro" (rótulo genérico) para nunca quebrar o render.
export const SCHEDULE_TYPES = ["velorio", "sepultamento", "exumacao"];

// status da API × o que os botões do detalhe oferecem (inclui em_andamento).
export const SCHEDULE_STATUSES = ["agendado", "confirmado", "em_andamento", "concluido", "cancelado"];

// Data local (YYYY-MM-DD) a partir de um ISO/Date — chave de dia das views.
export function toDateKey(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// "HH:MM" local a partir de um ISO/Date.
export function toClock(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// A página coleta sepultado/responsável/local como texto livre (o design usa
// inputs, não pickers). Guardamos isso em `notes` de forma legível+parseável,
// para não perder informação e reexibir no detalhe quando não há associação.
const NOTE_KEYS = { place: "Local", responsible: "Responsável", deceased: "Sepultado" };

export function composeNotes({ place, responsible, deceased } = {}) {
  const lines = [];
  if (deceased) lines.push(`${NOTE_KEYS.deceased}: ${deceased}`);
  if (responsible) lines.push(`${NOTE_KEYS.responsible}: ${responsible}`);
  if (place) lines.push(`${NOTE_KEYS.place}: ${place}`);
  return lines.join("\n");
}

function parseNote(notes, key) {
  if (!notes) return "";
  const re = new RegExp(`^${NOTE_KEYS[key]}:\\s*(.+)$`, "mi");
  const m = notes.match(re);
  return m ? m[1].trim() : "";
}

// Schedule da API → evento do front (o shape que as 4 views já consomem).
export function adaptSchedule(s) {
  const rawType = s.scheduleType;
  const type = SCHEDULE_TYPES.includes(rawType) ? rawType : "outro";
  const deceasedName = s.deceased?.fullName || parseNote(s.notes, "deceased") || s.title || "—";
  const responsibleName = s.responsible?.fullName || parseNote(s.notes, "responsible") || "—";
  const place = s.chapel?.name || s.grave?.code || parseNote(s.notes, "place") || "—";
  return {
    id: s.id,
    type,
    scheduleType: rawType,
    title: s.title || `${deceasedName}`,
    deceased: deceasedName,
    responsible: responsibleName,
    place,
    chapelId: s.chapelId || s.chapel?.id || null,
    graveId: s.graveId || s.grave?.id || null,
    status: s.status,
    startsAt: s.startsAt,
    endsAt: s.endsAt,
    dateKey: toDateKey(s.startsAt),
    start: toClock(s.startsAt),
    end: toClock(s.endsAt),
  };
}
