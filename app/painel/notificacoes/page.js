"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Tabs from "@/components/molecules/Tabs/Tabs";
import StatCard from "@/components/molecules/StatCard/StatCard";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listNotifications,
  sendNotification,
  retryNotification,
  normalizeNotification,
  getNotificationAutomations,
  normalizeAutomation,
} from "@/lib/api/resources/notifications";

const NOTIF_TYPES = {
  vencimento_proximo: { label: "Vencimento próximo", tone: "warning" },
  cobranca_vencida: { label: "Cobrança vencida", tone: "danger" },
  pagamento_confirmado: { label: "Pagamento confirmado", tone: "success" },
  autorizacao_emitida: { label: "Autorização emitida", tone: "navy" },
  lembrete_agendamento: { label: "Lembrete de agendamento", tone: "info" },
  avulsa: { label: "Mensagem avulsa", tone: "neutral" },
};

const NOTIF_STATUS = {
  pendente: { label: "Pendente", tone: "warning" },
  enviada: { label: "Enviada", tone: "info" },
  entregue: { label: "Entregue", tone: "navy" },
  lida: { label: "Lida", tone: "success" },
  erro: { label: "Erro", tone: "danger" },
};

const FILTERS = [
  { key: "todas", label: "Todas" },
  { key: "enviada", label: "Enviadas" },
  { key: "entregue", label: "Entregues" },
  { key: "lida", label: "Lidas" },
  { key: "pendente", label: "Pendentes" },
  { key: "erro", label: "Erro" },
];

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <path d="M8 1.9a6.1 6.1 0 0 0-5.2 9.3L1.9 14l2.9-.8A6.1 6.1 0 1 0 8 1.9Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.9 5.2c-.4.1-.8.6-.8 1.2 0 1.7 2.3 4.2 4.1 4.6.6.1 1.2-.1 1.4-.6l.2-.5c.1-.2 0-.5-.2-.6l-1.1-.6a.45.45 0 0 0-.55.1l-.3.35c-.65-.35-1.5-1.15-1.85-1.85l.35-.3c.15-.15.2-.4.1-.55l-.6-1.1c-.1-.2-.4-.3-.6-.25l-.15.05Z" fill="currentColor" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none">
      <rect x="2" y="3.5" width="12" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="m2.5 5.2 5.5 4 5.5-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Ticks({ read, single }) {
  return (
    <svg viewBox="0 0 22 12" fill="none" className={`${styles.ticks} ${read ? styles.ticksRead : ""}`}>
      <path d="m1.5 6.5 3 3L10 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {!single && (
        <path d="m9.5 6.5 3 3L18 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function ChannelCell({ channel }) {
  const isWa = channel === "whatsapp";
  return (
    <span className={styles.channelCell}>
      <span className={`${styles.channelIcon} ${isWa ? styles.channelWhatsapp : styles.channelEmail}`}>
        {isWa ? <WhatsAppIcon /> : <MailIcon />}
      </span>
      {isWa ? "WhatsApp" : "E-mail"}
    </span>
  );
}

const TIMELINE_STEPS = [
  { key: "criada", label: "Criada" },
  { key: "enviada", label: "Enviada" },
  { key: "entregue", label: "Entregue" },
  { key: "lida", label: "Lida" },
];

const EMPTY_AVULSA = { to: "", channel: "whatsapp", message: "" };

export default function NotificationsPage() {
  const [filter, setFilter] = useState("todas");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(null);
  const [avulsaOpen, setAvulsaOpen] = useState(false);
  const [avulsa, setAvulsa] = useState(EMPTY_AVULSA);
  const [exportOpen, setExportOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  // Lista real (a página não tem paginação visual — carrega o lote recente e
  // filtra/conta no client, exatamente como o layout foi desenhado).
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listNotifications({ perPage: 100 }, { signal }),
    []
  );
  const notifs = useMemo(
    () => (data?.data ?? []).map(normalizeNotification).filter(Boolean),
    [data]
  );

  // Estado REAL do agendador — GET /notifications/automations (somente leitura).
  const {
    data: autoData,
    loading: autoLoading,
    error: autoError,
    refetch: refetchAuto,
  } = useResource(({ signal }) => getNotificationAutomations({ signal }), []);

  const scheduler = autoData?.scheduler || null;
  const automations = useMemo(
    () => (autoData?.automations ?? []).map(normalizeAutomation).filter(Boolean),
    [autoData]
  );

  const { mutate: doSend, loading: sending } = useMutation(sendNotification);
  const { mutate: doRetry, loading: resending } = useMutation(retryNotification);

  const detail = notifs.find((n) => n.id === detailId);

  const counts = useMemo(() => ({
    todas: notifs.length,
    enviada: notifs.filter((n) => n.status === "enviada").length,
    entregue: notifs.filter((n) => n.status === "entregue").length,
    lida: notifs.filter((n) => n.status === "lida").length,
    pendente: notifs.filter((n) => n.status === "pendente").length,
    erro: notifs.filter((n) => n.status === "erro").length,
  }), [notifs]);

  const sentCount = counts.enviada + counts.entregue + counts.lida;
  const attempts = sentCount + counts.erro;
  const deliveryRate = attempts ? Math.round(((counts.entregue + counts.lida) / attempts) * 100) : 0;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notifs.filter((n) => {
      if (filter !== "todas" && n.status !== filter) return false;
      if (q && !n.name.toLowerCase().includes(q) && !n.contact.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [notifs, filter, query]);

  function flash(message, tone = "success") {
    setFeedback({ message, tone });
    setTimeout(() => setFeedback(null), 4500);
  }

  // Enviar avulsa → POST /notifications (a API enfileira o dispatch).
  async function sendAvulsa() {
    const to = avulsa.to.trim();
    const channel = avulsa.channel;
    try {
      await doSend({ contact: to, channel, message: avulsa.message.trim() });
      setAvulsaOpen(false);
      setAvulsa(EMPTY_AVULSA);
      flash(`Mensagem avulsa enviada para ${to} por ${channel === "whatsapp" ? "WhatsApp" : "e-mail"}.`);
      refetch();
    } catch (e) {
      flash(e.message || "Não foi possível enviar a mensagem avulsa.", "danger");
    }
  }

  // Reenviar → POST /notifications/:id/retry (reenfileira a linha em falha).
  async function resend(n) {
    try {
      await doRetry(n.id);
      setDetailId(null);
      flash(`Notificação reenviada para ${n.name}.`);
      refetch();
    } catch (e) {
      flash(e.message || "Não foi possível reenviar a notificação.", "danger");
    }
  }

  const columns = [
    {
      key: "person", label: "Destinatário",
      render: (n) => (
        <div className={styles.personCell}>
          <Avatar name={n.name} size="sm" />
          <div className={styles.personInfo}>
            <span className={styles.personName}>{n.name}</span>
            <span className={styles.personCpf}>{n.contact}</span>
          </div>
        </div>
      ),
    },
    {
      key: "type", label: "Tipo",
      render: (n) => <Badge tone={NOTIF_TYPES[n.type].tone}>{NOTIF_TYPES[n.type].label}</Badge>,
    },
    { key: "channel", label: "Canal", render: (n) => <ChannelCell channel={n.channel} /> },
    {
      key: "sent", label: "Enviada em",
      render: (n) => n.status === "pendente" ? (
        <div className={styles.dates}>
          <span>Na fila</span>
          <span className={styles.datesSub}>envio automático</span>
        </div>
      ) : (
        <div className={styles.dates}>
          <span>{n.date}</span>
          <span className={styles.datesSub}>às {n.time}</span>
        </div>
      ),
    },
    {
      key: "status", label: "Situação",
      render: (n) => <Badge tone={NOTIF_STATUS[n.status].tone} dot={n.status === "pendente"}>{NOTIF_STATUS[n.status].label}</Badge>,
    },
    {
      key: "action", label: "",
      render: (n) => <button className={styles.detailLink} onClick={() => setDetailId(n.id)}>Detalhes</button>,
    },
  ];

  const sentTabContent = (
    <div className={styles.tabContent}>
      <div className={styles.stats}>
        <StatCard label="Enviadas no mês" value={String(sentCount)} caption="julho de 2026 · WhatsApp e e-mail" />
        <StatCard label="Taxa de entrega" value={`${deliveryRate}%`} caption="entregues e lidas sobre os envios" />
        <StatCard label="Pendentes na fila" value={String(counts.pendente)} caption="aguardando envio automático" />
        <StatCard label="Com erro" value={String(counts.erro)} caption="precisam de reenvio" />
      </div>

      <div className={styles.statusChips}>
        {FILTERS.map((f) => (
          <button key={f.key} className={`${styles.chip} ${filter === f.key ? styles.chipActive : ""}`} onClick={() => setFilter(f.key)}>
            {f.label}
            <span className={styles.chipCount}>{counts[f.key]}</span>
          </button>
        ))}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <svg viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.4" stroke="currentColor" strokeWidth="1.5" />
            <path d="m13.5 13.5-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <input placeholder="Buscar por destinatário…" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      </div>

      <div className={styles.desktopTable}>
        <DataTable columns={columns} rows={filtered} rowKey={(n) => n.id} emptyMessage="Nenhuma notificação encontrada." />
      </div>

      <div className={styles.mobileList}>
        <span className={styles.mobileCount}>{filtered.length} notificação(ões)</span>
        {filtered.map((n) => (
          <button key={n.id} className={styles.mobileCard} onClick={() => setDetailId(n.id)}>
            <div className={styles.mobileCardTop}>
              <span className={styles.mobileCardName}>{n.name}</span>
              <Badge tone={NOTIF_STATUS[n.status].tone}>{NOTIF_STATUS[n.status].label}</Badge>
            </div>
            <div className={styles.mobileCardBody}>
              <span className={styles.mobileCardMeta}>{NOTIF_TYPES[n.type].label} · {n.channel === "whatsapp" ? "WhatsApp" : "E-mail"}</span>
              <span className={styles.mobileCardMeta}>{n.status === "pendente" ? "na fila de envio" : `${n.date} às ${n.time}`}</span>
            </div>
            <span className={styles.mobileCardChevron}>
              <svg viewBox="0 0 16 16" fill="none">
                <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  const sentTab = loading ? (
    <div className={styles.tabContent}>
      <Skeleton variant="row" count={6} />
    </div>
  ) : error ? (
    <div className={styles.tabContent}>
      <ErrorState onRetry={refetch} />
    </div>
  ) : !notifs.length ? (
    <div className={styles.tabContent}>
      <EmptyState
        title="Nenhuma notificação enviada ainda"
        message="Assim que uma cobrança, autorização ou lembrete for disparado — ou você enviar uma mensagem avulsa — ela aparece aqui com o acompanhamento de entrega."
        action={<Button onClick={() => setAvulsaOpen(true)}>Enviar avulsa</Button>}
      />
    </div>
  ) : (
    sentTabContent
  );

  // Aba Automações — RETRATO do que a API realmente agenda. Somente leitura:
  // não existe endpoint para ligar/desligar nem para editar template, então a
  // tela não oferece esses controles.
  const scheduledCount = automations.filter((a) => a.scheduled).length;
  const anyScheduled = scheduledCount > 0;

  const rulesTabContent = (
    <div className={styles.tabContent}>
      {scheduler && !scheduler.enabled && (
        <Alert tone="danger" title="Avisos automáticos NÃO estão sendo enviados">
          O agendador está desligado{scheduler.reason ? ` — ${scheduler.reason}` : ""}. Nenhuma
          das rotinas abaixo dispara: cobranças vencidas e taxas a vencer não geram aviso
          nenhum ao cidadão. Apenas os envios manuais (aba <strong>Enviadas</strong>)
          funcionam.
          {scheduler.howToEnable && <> {scheduler.howToEnable}</>}
        </Alert>
      )}

      {/* Agendador no ar, mas sem rotina registrada: o worker nunca subiu. */}
      {scheduler && scheduler.enabled && !anyScheduled && (
        <Alert tone="warning" title="Nenhuma rotina está agendada">
          O agendador está no ar, mas nenhuma das rotinas abaixo está registrada — ou seja,
          nenhum aviso automático será disparado.
          {scheduler.howToEnable && <> {scheduler.howToEnable}</>}
        </Alert>
      )}

      {scheduler && scheduler.enabled && anyScheduled && (
        <Alert tone="success" title="Agendador ativo">
          O serviço de agendamento está no ar e dispara as rotinas abaixo nos horários
          indicados.
        </Alert>
      )}

      <div className={styles.stats}>
        <StatCard
          label="Rotinas automáticas"
          value={String(automations.length)}
          caption="rotinas existentes no sistema"
        />
        <StatCard
          label="Agendadas agora"
          value={String(scheduledCount)}
          caption={scheduler?.enabled ? "registradas na fila" : "agendador desligado"}
        />
        <StatCard
          label="Agendador"
          value={scheduler?.enabled ? "Ativo" : "Desligado"}
          caption={scheduler?.enabled ? "fila de execução no ar" : scheduler?.reason || "sem fila"}
        />
      </div>

      <div className={styles.typesHead}>
        <p className={styles.typesHint}>
          Rotinas que o sistema executa sozinho, no horário indicado. Este é o estado real:
          o que não estiver agendado simplesmente não dispara. Não há edição de mensagem
          nem chave de liga/desliga — as rotinas são definidas na configuração do serviço.
        </p>
      </div>

      <div className={styles.ruleList}>
        {automations.map((rule) => (
          <article
            key={rule.key}
            className={`${styles.ruleCard} ${!rule.scheduled ? styles.ruleCardInactive : ""}`}
          >
            <div className={styles.ruleMain}>
              <span className={styles.ruleName}>{rule.name}</span>
              <p className={styles.ruleDesc}>{rule.description}</p>
              <div className={styles.ruleMeta}>
                {rule.schedule && (
                  <span className={styles.ruleMetaItem}>Horário: {rule.schedule}</span>
                )}
                {rule.channelsLabel && (
                  <span className={styles.ruleMetaItem}>
                    <span className={rule.hasWhatsapp ? styles.channelWhatsapp : styles.channelEmail}>
                      {rule.hasWhatsapp ? <WhatsAppIcon /> : <MailIcon />}
                    </span>
                    {rule.channelsLabel}
                  </span>
                )}
                {rule.nextRun && (
                  <span className={styles.ruleMetaItem}>Próxima execução: {rule.nextRun}</span>
                )}
                {/* Sem carimbo confiável, a tela DIZ que não há registro — nunca inventa. */}
                <span className={styles.ruleMetaItem}>
                  {rule.lastRun
                    ? `Última execução: ${rule.lastRun}${
                        rule.lastRunNotified !== null ? ` · ${rule.lastRunNotified} aviso(s)` : ""
                      }`
                    : "Sem registro de execução"}
                </span>
                {rule.scheduled ? (
                  <Badge tone="success" dot>Agendada</Badge>
                ) : (
                  <Badge tone="danger">Não agendada</Badge>
                )}
              </div>
              {rule.lastRunError && (
                <p className={styles.ruleDesc}>Último erro: {rule.lastRunError}</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );

  const rulesTab = autoLoading ? (
    <div className={styles.tabContent}>
      <Skeleton variant="row" count={3} />
    </div>
  ) : autoError ? (
    <div className={styles.tabContent}>
      <ErrorState onRetry={refetchAuto} />
    </div>
  ) : !automations.length ? (
    <div className={styles.tabContent}>
      <EmptyState
        title="Nenhuma rotina automática configurada"
        message="Este sistema não tem nenhuma automação de aviso registrada. Os envios continuam disponíveis manualmente, pela aba Enviadas."
      />
    </div>
  ) : (
    rulesTabContent
  );

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Notificações</h1>
          <p className={styles.subtitle}>Avisos por WhatsApp e e-mail — vencimentos, autorizações e lembretes automáticos</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Exportar
          </Button>
          <Button onClick={() => setAvulsaOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M14 2 7.3 8.7M14 2 9.7 14l-2.4-5.3L2 6.3 14 2Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Enviar avulsa
          </Button>
        </div>
      </header>

      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

      <Tabs
        items={[
          { label: "Enviadas", count: notifs.length, content: sentTab },
          { label: "Automações", count: automations.length, content: rulesTab },
        ]}
      />

      {/* ---------- detalhe da notificação ---------- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail?.name || ""}
        subtitle={detail ? `${NOTIF_TYPES[detail.type].label} · ${detail.channel === "whatsapp" ? "WhatsApp" : "E-mail"} · ${detail.contact}` : ""}
        width={560}
        footer={
          detail && (
            <>
              {detail.status === "erro" && (
                <Button loading={resending} onClick={() => resend(detail)}>Reenviar</Button>
              )}
              <Button variant="ghost" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            {detail.status === "erro" && (
              <Alert tone="danger" title="Falha no envio">
                {detail.error}. Use o botão <strong>Reenviar</strong> para colocar a mensagem de volta na fila.
              </Alert>
            )}

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Prévia da mensagem</span>
              <div className={styles.chatPreview}>
                <div className={`${styles.waBubble} ${detail.channel === "email" ? styles.bubbleEmail : ""}`}>
                  <p className={styles.waText}>{detail.message}</p>
                  <div className={styles.waMeta}>
                    <span className={styles.waTime}>{detail.status === "pendente" ? "na fila" : detail.time}</span>
                    {detail.channel === "whatsapp" && (detail.status === "entregue" || detail.status === "lida") && (
                      <Ticks read={detail.status === "lida"} />
                    )}
                    {detail.channel === "whatsapp" && detail.status === "enviada" && <Ticks single />}
                  </div>
                </div>
              </div>
            </section>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Linha do tempo</span>
              <ol className={styles.timeline}>
                {TIMELINE_STEPS.map((step) => {
                  const at = detail.timeline[step.key];
                  return (
                    <li key={step.key} className={`${styles.timelineItem} ${!at ? styles.timelinePending : ""}`}>
                      <span className={styles.timelineDot} />
                      <span className={styles.timelineLabel}>{step.label}</span>
                      <span className={styles.timelineTime}>
                        {at || (detail.status === "erro" && step.key === "enviada" ? "falhou" : "—")}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </section>
          </div>
        )}
      </Modal>

      {/* ---------- enviar avulsa ---------- */}
      <Modal
        open={avulsaOpen}
        onClose={() => setAvulsaOpen(false)}
        title="Enviar notificação avulsa"
        subtitle="Mensagem manual, fora das automações"
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAvulsaOpen(false)}>Cancelar</Button>
            <Button loading={sending} disabled={!avulsa.to.trim() || !avulsa.message.trim()} onClick={sendAvulsa}>
              Enviar agora
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <FormField label="Destinatário" required>
              <Input placeholder="Nome da pessoa" value={avulsa.to} onChange={(e) => setAvulsa({ ...avulsa, to: e.target.value })} />
            </FormField>
            <FormField label="Canal" required>
              <Select value={avulsa.channel} onChange={(e) => setAvulsa({ ...avulsa, channel: e.target.value })}>
                <option value="whatsapp">WhatsApp</option>
                <option value="email">E-mail</option>
              </Select>
            </FormField>
            <FormField label="Mensagem" required className={styles.spanTwo}>
              <Textarea
                rows={4}
                placeholder="Olá! Escreva aqui a mensagem…"
                value={avulsa.message}
                onChange={(e) => setAvulsa({ ...avulsa, message: e.target.value })}
              />
            </FormField>
          </div>
          <Alert tone="info">
            A mensagem entra na fila e aparece na aba <strong>Enviadas</strong> com o
            acompanhamento de entrega e leitura.
          </Alert>
        </div>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="notificações"
        totalCount={notifs.length}
        filteredCount={filtered.length}
      />
    </div>
  );
}
