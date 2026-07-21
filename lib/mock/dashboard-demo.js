/* -------------------------------------------------------------------------
 * Mock do dashboard — dados FALSOS (receita, inadimplência, devedores, agenda),
 * usados APENAS na vitrine da landing (PanelShowcase). MESMO shape que
 * getDashboard() retorna. Nenhuma chamada de API é feita: é 100% estático.
 *
 * REGRA: este mock só pode ser renderizado sob marcas ILUSTRATIVAS e com o
 * aviso de demonstração visível. Nunca combine-o com o nome/cor de um município
 * real (vindo de `GET /public/tenants`) — o visitante leria estes números como
 * se fossem daquela prefeitura.
 * ------------------------------------------------------------------------- */

const REVENUE_SERIES = [
  { month: "2025-08", total: 28400 },
  { month: "2025-09", total: 30100 },
  { month: "2025-10", total: 29600 },
  { month: "2025-11", total: 32800 },
  { month: "2025-12", total: 35200 },
  { month: "2026-01", total: 34100 },
  { month: "2026-02", total: 37500 },
  { month: "2026-03", total: 39900 },
  { month: "2026-04", total: 41200 },
  { month: "2026-05", total: 43600 },
  { month: "2026-06", total: 45300 },
  { month: "2026-07", total: 47200 },
];

const OCCUPANCY = {
  total: 1240,
  byStatus: [
    { slug: "ocupada", statusName: "Ocupada", count: 842, color: "#3f6fb0" },
    { slug: "reservada", statusName: "Reservada", count: 210, color: "#e0a63c" },
    { slug: "disponivel", statusName: "Disponível", count: 188, color: "#7bbf8f" },
  ],
};

const FINANCE = { receivedThisMonth: 47200, overdueTotal: 18450, overdueCount: 23 };

const TOP_DEBTORS = [
  { personId: "d1", personName: "Maria das Graças Oliveira", graveCode: "Q-12 · L-045", overdueTotal: 3120, overdueCount: 4 },
  { personId: "d2", personName: "Antônio Carlos Ferreira", graveCode: "Q-07 · L-118", overdueTotal: 2480, overdueCount: 3 },
  { personId: "d3", personName: "Benedita Souza Lima", graveCode: "Q-15 · L-203", overdueTotal: 1890, overdueCount: 3 },
  { personId: "d4", personName: "José Ribeiro dos Santos", graveCode: "Q-03 · L-072", overdueTotal: 1540, overdueCount: 2 },
];

// Constrói um ISO de HOJE no horário informado (mantém "hoje" na agenda).
function todayAt(hour, minute) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Constrói um ISO recente (mantém "há X min/h" na atividade).
function minutesAgo(mins) {
  return new Date(Date.now() - mins * 60000).toISOString();
}

/**
 * Gera o mock com timestamps relativos a AGORA — chamar no cliente
 * (PanelShowcase é 'use client') mantém a agenda em "hoje" e a atividade
 * recente com tempos relativos corretos.
 */
export function makeDashboardDemo() {
  return {
    occupancy: OCCUPANCY,
    revenueSeries: REVENUE_SERIES,
    finance: FINANCE,
    delinquencyRate: 6.8,
    burialsThisMonth: 34,
    todaySchedule: [
      {
        id: "s1",
        startsAt: todayAt(9, 0),
        scheduleType: "velorio",
        title: "Velório — Capela 2",
        deceasedName: "Sebastião Alves Moreira",
        place: "Capela 2 · Ala Norte",
      },
      {
        id: "s2",
        startsAt: todayAt(11, 30),
        scheduleType: "sepultamento",
        title: "Sepultamento",
        deceasedName: "Sebastião Alves Moreira",
        place: "Quadra 12 · Lote 045",
      },
      {
        id: "s3",
        startsAt: todayAt(14, 15),
        scheduleType: "visita_tecnica",
        title: "Visita técnica — vistoria de jazigo",
        deceasedName: "",
        place: "Quadra 07 · Lote 118",
      },
      {
        id: "s4",
        startsAt: todayAt(16, 0),
        scheduleType: "exumacao",
        title: "Exumação programada",
        deceasedName: "Rosa Maria Campos",
        place: "Quadra 03 · Lote 072",
      },
    ],
    topDebtors: TOP_DEBTORS,
    recentActivity: [
      {
        id: "a1",
        entityType: "Cobrança",
        action: "atualizacao",
        description: "Pagamento confirmado — R$ 320,00 (Maria das Graças)",
        createdAt: minutesAgo(4),
      },
      {
        id: "a2",
        entityType: "Sepultamento",
        action: "criacao",
        description: "Sepultamento registrado — Quadra 12, Lote 045",
        createdAt: minutesAgo(38),
      },
      {
        id: "a3",
        entityType: "Documento",
        action: "criacao",
        description: "Certidão de sepultamento emitida",
        createdAt: minutesAgo(95),
      },
      {
        id: "a4",
        entityType: "Exumação",
        action: "atualizacao",
        description: "Exumação reagendada para hoje às 16h",
        createdAt: minutesAgo(180),
      },
      {
        id: "a5",
        entityType: "Cobrança",
        action: "exclusao",
        description: "Cobrança cancelada — duplicidade (Lote 118)",
        createdAt: minutesAgo(320),
      },
    ],
  };
}

// Snapshot estático pronto pra uso (timestamps do momento do import).
export const DASHBOARD_DEMO = makeDashboardDemo();
