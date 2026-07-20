"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Tabs from "@/components/molecules/Tabs/Tabs";
import StatCard from "@/components/molecules/StatCard/StatCard";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import AttachmentList from "@/components/molecules/AttachmentList/AttachmentList";
import AttachmentUploadModal from "@/components/molecules/AttachmentUploadModal/AttachmentUploadModal";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { DEMO_CERTIDAO_PDF, DEMO_CONTRATO_PDF } from "@/lib/mock-files";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listExhumations,
  getExhumationStats,
  createExhumation,
  authorizeExhumation,
  scheduleExhumation,
  performExhumation,
  cancelExhumation,
  adaptProcess,
} from "@/lib/api/resources/exhumations";
import {
  listOssuaries,
  listNiches,
  removeDeposit,
  adaptNiche,
} from "@/lib/api/resources/ossuaries";
import { listCemeteries } from "@/lib/api/resources/graves";
import { listDeceased } from "@/lib/api/resources/deceased";
import { listPeople } from "@/lib/api/resources/people";

// Resolve o nome digitado (solicitante) para o id de uma Pessoa real: tenta a
// lista já carregada (match exato, case-insensitive) e, se não achar, busca na
// API. Sem correspondência retorna null — nesse caso o id não é enviado.
async function resolvePersonId(name, options = []) {
  const lower = name.trim().toLowerCase();
  if (!lower) return null;
  const local = options.find((p) => p.name.trim().toLowerCase() === lower);
  if (local) return local.id;
  try {
    const res = await listPeople({ search: name, perPage: 5 });
    const list = res?.data ?? [];
    const match = list.find((p) => (p.fullName || "").trim().toLowerCase() === lower) || list[0];
    return match?.id || null;
  } catch {
    return null;
  }
}

const STAGES = ["solicitada", "autorizada", "agendada", "realizada"];

const STAGE_META = {
  solicitada: { label: "Solicitada", tone: "neutral" },
  autorizada: { label: "Autorizada", tone: "navy" },
  agendada: { label: "Agendada", tone: "warning" },
  realizada: { label: "Realizada", tone: "success" },
  cancelada: { label: "Cancelada", tone: "danger" },
};

const DESTINATION_META = {
  ossario: "Ossário",
  outro_jazigo: "Outro jazigo",
  cremacao: "Cremação",
  translado_externo: "Translado externo",
};
const destLabel = (t) => DESTINATION_META[t] || "Outro";

const PROCESS_DOCS = [
  { name: "autorizacao-familia.pdf", category: "Autorização", size: "180 KB", url: DEMO_CONTRATO_PDF },
  { name: "documento-solicitante.pdf", category: "Documento pessoal", size: "320 KB", url: DEMO_CERTIDAO_PDF },
];

const NICHE_META = {
  livre: { label: "Livre", tone: "success" },
  ocupado: { label: "Ocupado", tone: "navy" },
  reservado: { label: "Reservado", tone: "warning" },
  manutencao: { label: "Manutenção", tone: "neutral" },
};

export default function ExhumationsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [exportOpen, setExportOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState(null); // id do processo aberto
  const [niche, setNiche] = useState(null); // nicho aberto
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docs, setDocs] = useState(PROCESS_DOCS);
  const [scheduleDate, setScheduleDate] = useState("2026-08-14");
  const [destForm, setDestForm] = useState({ type: "ossario", niche: "", detail: "" });
  const [selectedOssuary, setSelectedOssuary] = useState("");
  const [newForm, setNewForm] = useState({ deceasedId: "", requester: "", reason: "" });
  const [actionError, setActionError] = useState(null);

  // cemitério ativo — convenção do painel: primeiro cemitério do tenant
  const { data: cemsData } = useResource(({ signal }) => listCemeteries({ signal }), []);
  const cemetery = cemsData?.data?.[0];

  // indicadores da tela (GET /exhumations/stats)
  const { data: statsData, refetch: refetchStats } = useResource(
    ({ signal }) => getExhumationStats({}, { signal }),
    []
  );
  const stats = statsData || {};
  const byStatus = stats.byStatus || {};

  // lista de processos (tenant-wide — a tela não tem seletor de cemitério)
  const {
    data: listData,
    loading: listLoading,
    error: listError,
    refetch: refetchList,
  } = useResource(({ signal }) => listExhumations({ perPage: 100 }, { signal }), []);
  const processes = useMemo(() => (listData?.data ?? []).map(adaptProcess), [listData]);

  // ossários do cemitério ativo
  const { data: ossuariesData } = useResource(
    ({ signal }) => (cemetery ? listOssuaries(cemetery.id, { signal }) : Promise.resolve([])),
    [cemetery?.id]
  );
  const ossuaries = ossuariesData ?? [];
  const activeOssuaryId = selectedOssuary || ossuaries[0]?.id || "";

  // nichos do ossário selecionado (grade + rastreabilidade dos depósitos)
  const {
    data: nichesData,
    loading: nichesLoading,
    error: nichesError,
    refetch: refetchNiches,
  } = useResource(
    ({ signal }) => (activeOssuaryId ? listNiches(activeOssuaryId, {}, { signal }) : Promise.resolve([])),
    [activeOssuaryId]
  );
  const niches = useMemo(() => (nichesData ?? []).map(adaptNiche), [nichesData]);

  // sepultados com sepultamento ativo — candidatos a nova exumação
  const { data: deceasedData } = useResource(
    ({ signal }) => listDeceased({ currentLocationType: "sepultado", perPage: 100 }, { signal }),
    []
  );
  const buriable = deceasedData?.data ?? [];

  // sugestões de pessoas para o campo Responsável solicitante (resolve FK real)
  const { data: peopleData } = useResource(
    ({ signal }) => (newOpen ? listPeople({ perPage: 100 }, { signal }) : Promise.resolve(null)),
    [newOpen]
  );
  const peopleOptions = useMemo(
    () => (peopleData?.data ?? []).map((p) => ({ id: p.id, name: p.fullName })),
    [peopleData]
  );

  // ---- mutations (mantêm auditoria/concorrência na API) ----
  const { mutate: doAuthorize, loading: authorizing } = useMutation(authorizeExhumation);
  const { mutate: doSchedule, loading: scheduling } = useMutation(scheduleExhumation);
  const { mutate: doPerform, loading: performing } = useMutation(performExhumation);
  const { mutate: doCancel, loading: cancelling } = useMutation(cancelExhumation);
  const { mutate: doCreate, loading: creating } = useMutation(createExhumation);
  const { mutate: doRemove, loading: removing } = useMutation(removeDeposit);
  const saving = authorizing || scheduling || performing || cancelling;

  const current = detail ? processes.find((p) => p.id === detail) : null;
  const freeNiches = niches.filter((n) => n.status === "livre");

  const filtered = useMemo(() => {
    return processes.filter((row) => {
      const term = search.trim().toLowerCase();
      if (term && !row.deceased.toLowerCase().includes(term) && !row.grave.toLowerCase().includes(term) && !row.number.includes(term)) return false;
      if (statusFilter && row.status !== statusFilter) return false;
      return true;
    });
  }, [processes, search, statusFilter]);

  async function advance() {
    if (!current) return;
    setActionError(null);
    try {
      if (current.status === "solicitada") {
        await doAuthorize(current.id, {});
      } else if (current.status === "autorizada") {
        await doSchedule(current.id, { scheduledDate: scheduleDate });
      } else if (current.status === "agendada") {
        const body =
          destForm.type === "ossario"
            ? { destinationType: "ossario", destinationOssuaryNicheId: destForm.niche || freeNiches[0]?.id }
            : { destinationType: destForm.type, destinationDetails: destForm.detail || undefined };
        await doPerform(current.id, body);
      }
      await Promise.all([refetchList(), refetchStats(), refetchNiches()]);
      setDestForm({ type: "ossario", niche: "", detail: "" });
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function cancelProcess() {
    if (!current) return;
    setActionError(null);
    try {
      await doCancel(current.id, {});
      await Promise.all([refetchList(), refetchStats()]);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function releaseNiche() {
    if (!niche?.depositId) return;
    setActionError(null);
    try {
      await doRemove(niche.depositId, { removalReason: "Retirada registrada no painel" });
      await Promise.all([refetchNiches(), refetchStats()]);
      setNiche(null);
    } catch (e) {
      setActionError(e.message);
    }
  }

  async function createProcess() {
    setActionError(null);
    const dec = buriable.find((d) => d.id === newForm.deceasedId);
    if (!dec) {
      setActionError("Selecione um sepultado para abrir o processo.");
      return;
    }
    try {
      // Solicitante com match no cadastro → vínculo real (requestedByPersonId);
      // sem match, o id não é enviado (comportamento atual preservado).
      const requester = newForm.requester.trim();
      const requestedByPersonId = requester ? await resolvePersonId(requester, peopleOptions) : null;
      await doCreate({
        graveId: dec.currentGraveId,
        deceasedId: dec.id,
        reason: newForm.reason || undefined,
        ...(requestedByPersonId ? { requestedByPersonId } : {}),
      });
      await Promise.all([refetchList(), refetchStats()]);
      setNewForm({ deceasedId: "", requester: "", reason: "" });
      setNewOpen(false);
    } catch (e) {
      setActionError(e.message);
    }
  }

  const inProgress = stats.inProgress ?? 0;
  const awaiting = stats.awaitingAuthorization ?? 0;
  const totalProcesses = stats.total ?? processes.length;

  const stageIndex = current && current.status !== "cancelada" ? STAGES.indexOf(current.status) : -1;

  // ---- área da lista de processos: loading → error → vazio → conteúdo ----
  let processList;
  if (listLoading && !listData) {
    processList = <Skeleton variant="row" count={6} />;
  } else if (listError) {
    processList = <ErrorState onRetry={refetchList} />;
  } else if (!processes.length) {
    processList = (
      <EmptyState
        title="Nenhum processo de exumação"
        message="Abra o primeiro processo para registrar autorização, agendamento e destino dos restos mortais com auditoria permanente."
        action={<Button onClick={() => setNewOpen(true)}>Nova exumação</Button>}
      />
    );
  } else {
    processList = (
      <>
        <div className={styles.desktopTable}>
          <DataTable
            columns={[
              { key: "number", label: "Processo", render: (row) => <code className={styles.code}>{row.number}</code> },
              {
                key: "deceased",
                label: "Sepultado",
                render: (row) => (
                  <span className={styles.personCell}>
                    <Avatar name={row.deceased} size="sm" />
                    <span className={styles.personName}>{row.deceased}</span>
                  </span>
                ),
              },
              { key: "grave", label: "Origem", render: (row) => <Link href={`/painel/sepulturas/${row.graveId}`} className={styles.graveLink}>{row.grave}</Link> },
              { key: "requester", label: "Solicitante" },
              {
                key: "destination",
                label: "Destino",
                render: (row) => row.destination
                  ? <span className={styles.destCell}>{destLabel(row.destination)}<em>{row.destinationDetail}</em></span>
                  : <span className={styles.noDest}>—</span>,
              },
              { key: "status", label: "Etapa", render: (row) => <Badge tone={STAGE_META[row.status].tone} dot>{STAGE_META[row.status].label}</Badge> },
              {
                key: "actions",
                label: "",
                align: "right",
                render: (row) => <button className={styles.detailLink} onClick={() => setDetail(row.id)}>Detalhes</button>,
              },
            ]}
            rows={filtered}
          />
        </div>

        <div className={styles.mobileList}>
          {filtered.map((row) => (
            <button key={row.id} className={styles.mobileCard} onClick={() => setDetail(row.id)}>
              <div className={styles.mobileCardTop}>
                <code className={styles.code}>{row.number}</code>
                <Badge tone={STAGE_META[row.status].tone} dot>{STAGE_META[row.status].label}</Badge>
              </div>
              <div className={styles.mobileCardBody}>
                <span className={styles.mobileCardName}>{row.deceased}</span>
                <span className={styles.mobileCardMeta}>{row.grave}{row.destinationDetail ? ` → ${row.destinationDetail}` : ""}</span>
              </div>
              <svg viewBox="0 0 16 16" fill="none" className={styles.mobileCardChevron}>
                <path d="M6 3.5L10.5 8 6 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      </>
    );
  }

  // ---- área do ossário: loading → error → vazio → conteúdo ----
  let ossuaryPanel;
  if ((nichesLoading && !nichesData) || (cemetery && !ossuariesData)) {
    ossuaryPanel = <Skeleton variant="block" count={4} />;
  } else if (nichesError) {
    ossuaryPanel = <ErrorState onRetry={refetchNiches} />;
  } else if (!ossuaries.length || !niches.length) {
    ossuaryPanel = (
      <EmptyState
        title="Ossário sem nichos ocupados"
        message="Cadastre nichos no ossário para receber e rastrear os restos mortais das exumações."
      />
    );
  } else {
    ossuaryPanel = (
      <>
        <div className={styles.ossuaryHead}>
          <div className={styles.ossuarySelect}>
            <Select value={activeOssuaryId} onChange={(e) => setSelectedOssuary(e.target.value)}>
              {ossuaries.map((o) => (
                <option key={o.id} value={o.id}>{o.name}{cemetery ? ` · ${cemetery.name}` : ""}</option>
              ))}
            </Select>
          </div>
          <div className={styles.legend}>
            {Object.entries(NICHE_META).map(([key, meta]) => (
              <span key={key} className={styles.legendItem}>
                <span className={`${styles.legendDot} ${styles[`niche_${key}`]}`} />
                {meta.label} ({niches.filter((n) => n.status === key).length})
              </span>
            ))}
          </div>
        </div>

        <div className={styles.nicheGrid}>
          {niches.map((n) => (
            <button
              key={n.code}
              className={`${styles.niche} ${styles[`niche_${n.status}`]}`}
              onClick={() => setNiche(n)}
              title={n.occupant ? `${n.code} · ${n.occupant}` : `${n.code} · ${NICHE_META[n.status].label}`}
            >
              <span className={styles.nicheCode}>{n.code}</span>
              {n.occupant && <span className={styles.nicheName}>{n.occupant.split(" ")[0]}</span>}
            </button>
          ))}
        </div>
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Exumações & Ossário</h1>
          <p className={styles.subtitle}>Processos com auditoria permanente e rastreabilidade dos restos mortais</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={() => setExportOpen(true)}>Exportar</Button>
          <Button
            onClick={() => setNewOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Nova exumação
          </Button>
        </div>
      </header>

      <Tabs
        items={[
          {
            label: "Exumações",
            count: inProgress,
            content: (
              <div className={styles.tabContent}>
                <section className={styles.stats}>
                  <StatCard label="Em andamento" value={String(inProgress)} caption="solicitada → agendada" />
                  <StatCard label="Aguardando autorização" value={String(awaiting)} deltaTone="danger" caption="exigem análise" />
                  <StatCard label="Realizadas no ano" value={String(stats.performedThisYear ?? 0)} caption="2026" />
                  <StatCard label="Nichos livres" value={String(freeNiches.length)} caption={cemetery?.name || "Ossário"} />
                </section>

                <div className={styles.statusChips}>
                  <button className={`${styles.chip} ${statusFilter === "" ? styles.chipActive : ""}`} onClick={() => setStatusFilter("")}>
                    Todas <span className={styles.chipCount}>{totalProcesses}</span>
                  </button>
                  {Object.entries(STAGE_META).map(([key, meta]) => (
                    <button
                      key={key}
                      className={`${styles.chip} ${statusFilter === key ? styles.chipActive : ""}`}
                      onClick={() => setStatusFilter(statusFilter === key ? "" : key)}
                    >
                      <span className={`${styles.chipDot} ${styles[`dot_${key}`]}`} />
                      {meta.label}
                      <span className={styles.chipCount}>{byStatus[key] ?? 0}</span>
                    </button>
                  ))}
                </div>

                <div className={styles.searchBox}>
                  <Input
                    placeholder="Buscar por sepultado, jazigo ou nº do processo…"
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

                {processList}
              </div>
            ),
          },
          {
            label: "Ossário",
            count: niches.filter((n) => n.status === "ocupado").length,
            content: <div className={styles.tabContent}>{ossuaryPanel}</div>,
          },
        ]}
      />

      {/* ---- detalhe do processo (stepper + docs obrigatórios + ações) ---- */}
      <Modal
        open={Boolean(current)}
        onClose={() => { setDetail(null); setActionError(null); }}
        title={current ? `Processo nº ${current.number}` : ""}
        subtitle={current ? `Exumação de ${current.deceased} · origem ${current.grave}` : ""}
        width={700}
        footer={
          current && (
            <>
              {["solicitada", "autorizada", "agendada"].includes(current.status) && (
                <Button variant="danger" loading={cancelling} onClick={cancelProcess}>Cancelar processo</Button>
              )}
              <span className={styles.footSpacer} />
              <Button variant="ghost" onClick={() => { setDetail(null); setActionError(null); }}>Fechar</Button>
              {current.status === "solicitada" && <Button loading={saving} onClick={advance}>Autorizar</Button>}
              {current.status === "autorizada" && <Button loading={saving} onClick={advance}>Agendar</Button>}
              {current.status === "agendada" && <Button loading={saving} onClick={advance}>Registrar realização</Button>}
            </>
          )
        }
      >
        {current && (
          <div className={styles.detailBody}>
            {actionError && <Alert tone="danger" title="Não foi possível concluir a ação">{actionError}</Alert>}
            {current.status === "cancelada" ? (
              <Alert tone="danger" title="Processo cancelado">
                O procedimento permanece registrado para auditoria e histórico permanente.
              </Alert>
            ) : (
              <ol className={styles.stepper}>
                {STAGES.map((stage, index) => (
                  <li
                    key={stage}
                    className={`${styles.step} ${index < stageIndex ? styles.stepDone : ""} ${index === stageIndex ? styles.stepCurrent : ""}`}
                  >
                    <span className={styles.stepDot}>
                      {index < stageIndex ? (
                        <svg viewBox="0 0 12 12" fill="none"><path d="M2.5 6.2L5 8.7l4.5-5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className={styles.stepLabel}>{STAGE_META[stage].label}</span>
                    <span className={styles.stepDate}>
                      {stage === "solicitada" && current.requestDate}
                      {stage === "autorizada" && current.authorizedAt}
                      {stage === "agendada" && current.scheduledDate}
                      {stage === "realizada" && current.performedAt}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            <dl className={styles.detailGrid}>
              <div><dt>Solicitante</dt><dd>{current.requester}</dd></div>
              <div><dt>Motivo</dt><dd>{current.reason}</dd></div>
              {current.destinationDetail && (
                <div><dt>Destino dos restos mortais</dt><dd>{destLabel(current.destination)} — {current.destinationDetail}</dd></div>
              )}
            </dl>

            {current.status === "autorizada" && (
              <FormField label="Data do agendamento" required>
                <Input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} />
              </FormField>
            )}

            {current.status === "agendada" && (
              <div className={styles.destGrid}>
                <FormField label="Destino dos restos mortais" required>
                  <Select value={destForm.type} onChange={(e) => setDestForm({ ...destForm, type: e.target.value })}>
                    {Object.entries(DESTINATION_META).map(([key, label]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </Select>
                </FormField>
                {destForm.type === "ossario" ? (
                  <FormField label="Nicho" required hint={`${freeNiches.length} livres`}>
                    <Select value={destForm.niche} onChange={(e) => setDestForm({ ...destForm, niche: e.target.value })}>
                      <option value="">Automático ({freeNiches[0]?.code || "—"})</option>
                      {freeNiches.map((n) => <option key={n.id} value={n.id}>{n.code}</option>)}
                    </Select>
                  </FormField>
                ) : (
                  <FormField label="Detalhe do destino" required>
                    <Input value={destForm.detail} onChange={(e) => setDestForm({ ...destForm, detail: e.target.value })} placeholder="Jazigo, cemitério ou crematório…" />
                  </FormField>
                )}
              </div>
            )}

            <div className={styles.docsBlock}>
              <div className={styles.docsHead}>
                <span className={styles.docsTitle}>Documentação obrigatória</span>
                <Button variant="ghost" size="sm" onClick={() => setUploadOpen(true)}>Adicionar</Button>
              </div>
              <AttachmentList files={docs} />
            </div>
          </div>
        )}
      </Modal>

      {/* ---- nicho do ossário (rastreabilidade) ---- */}
      <Modal
        open={Boolean(niche)}
        onClose={() => { setNiche(null); setActionError(null); }}
        title={niche ? `Nicho ${niche.code}` : ""}
        subtitle={cemetery ? `${ossuaries.find((o) => o.id === activeOssuaryId)?.name || "Ossário"} · ${cemetery.name}` : "Ossário"}
        footer={
          niche && (
            <>
              <Button variant="ghost" onClick={() => { setNiche(null); setActionError(null); }}>Fechar</Button>
              {niche.status === "ocupado" && (
                <Button variant="danger" loading={removing} onClick={releaseNiche}>Registrar retirada</Button>
              )}
            </>
          )
        }
      >
        {niche && (
          <div className={styles.detailBody}>
            {actionError && <Alert tone="danger" title="Não foi possível concluir a ação">{actionError}</Alert>}
            <div className={styles.nicheStatusRow}>
              <Badge tone={NICHE_META[niche.status].tone} dot>{NICHE_META[niche.status].label}</Badge>
            </div>
            {niche.status === "ocupado" ? (
              <>
                <dl className={styles.detailGrid}>
                  <div><dt>Restos mortais de</dt><dd>{niche.occupant}</dd></div>
                  <div><dt>Veio do jazigo</dt><dd>{niche.origin}</dd></div>
                  <div><dt>Depositado em</dt><dd>{niche.since}</dd></div>
                  <div><dt>Processo de exumação</dt><dd>{niche.process}</dd></div>
                </dl>
                <Alert tone="info">
                  Rastreabilidade completa: a retirada registra o destino e mantém o
                  histórico permanente deste nicho.
                </Alert>
              </>
            ) : (
              <Alert tone={niche.status === "livre" ? "success" : "warning"}>
                {niche.status === "livre" && "Nicho disponível para receber depósitos de exumações."}
                {niche.status === "reservado" && "Nicho reservado — aguardando depósito agendado."}
                {niche.status === "manutencao" && "Nicho em manutenção — indisponível temporariamente."}
              </Alert>
            )}
          </div>
        )}
      </Modal>

      {/* ---- nova exumação ---- */}
      <Modal
        open={newOpen}
        onClose={() => { setNewOpen(false); setActionError(null); }}
        title="Nova exumação"
        subtitle="Numeração automática do processo"
        footer={
          <>
            <Button variant="ghost" onClick={() => { setNewOpen(false); setActionError(null); }}>Cancelar</Button>
            <Button loading={creating} onClick={createProcess}>Abrir processo</Button>
          </>
        }
      >
        <div className={styles.detailBody}>
          {actionError && <Alert tone="danger" title="Não foi possível abrir o processo">{actionError}</Alert>}
          <FormField label="Sepultado" required>
            <Select value={newForm.deceasedId} onChange={(e) => setNewForm({ ...newForm, deceasedId: e.target.value })}>
              <option value="" disabled>Selecione…</option>
              {buriable.map((d) => (
                <option key={d.id} value={d.id}>{d.fullName}{d.currentGrave?.code ? ` · ${d.currentGrave.code}` : ""}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Responsável solicitante">
            <Input
              value={newForm.requester}
              onChange={(e) => setNewForm({ ...newForm, requester: e.target.value })}
              placeholder="Nome do responsável legal"
              list="requester-people-options"
            />
            <datalist id="requester-people-options">
              {peopleOptions.map((p) => <option key={p.id} value={p.name} />)}
            </datalist>
          </FormField>
          <FormField label="Motivo" required>
            <Textarea rows={3} value={newForm.reason} onChange={(e) => setNewForm({ ...newForm, reason: e.target.value })} placeholder="Ex.: transferência para jazigo da família…" />
          </FormField>
          <Alert tone="warning" title="Documentação obrigatória">
            Anexe as autorizações e documentos exigidos no detalhe do processo —
            a realização só é liberada após a etapa de autorização.
          </Alert>
        </div>
      </Modal>

      <AttachmentUploadModal
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        title="Documentos do processo"
        onUpload={(files) => setDocs((list) => [...files, ...list])}
      />

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="exumações"
        totalCount={totalProcesses}
        filteredCount={filtered.length}
      />
    </div>
  );
}
