"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Textarea from "@/components/atoms/Textarea/Textarea";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Tabs from "@/components/molecules/Tabs/Tabs";
import MapCanvas from "@/components/organisms/MapCanvas/MapCanvas";
import MapStudio from "@/components/organisms/MapStudio/MapStudio";
import AttachmentList from "@/components/molecules/AttachmentList/AttachmentList";
import AttachmentUploadModal from "@/components/molecules/AttachmentUploadModal/AttachmentUploadModal";
import FileViewer from "@/components/organisms/FileViewer/FileViewer";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import { isShapeComplete } from "@/components/organisms/MapCanvas/shape-model";
import { DEMO_CERTIDAO_PDF, DEMO_CONTRATO_PDF } from "@/lib/mock-files";

import { useResource } from "@/lib/api/useResource";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  toAttachmentView,
} from "@/lib/api/resources/attachments";
import {
  getGraveSummary,
  getGraveTimeline,
  getGraveConcessions,
  listPeople,
  listDeceased,
  changeGraveStatus,
  blockGrave,
  unblockGrave,
  createGraveMaintenance,
  createBurial,
  transferConcession,
  createExhumation,
  issueDocument,
  reissueDocument,
  updateGrave,
  normalizeStatusSlug,
  frontStatusToApiSlug,
  unitTypeLabel,
  formatDate,
  TOMB_TYPE_OPTIONS,
  UTILIZACAO_OPTIONS,
} from "@/lib/api/resources/graves";

const STATUS_META = {
  livre: { label: "Livre", tone: "success" },
  ocupada: { label: "Ocupada", tone: "navy" },
  reservada: { label: "Reservada", tone: "warning" },
  manutencao: { label: "Em manutenção", tone: "neutral" },
  interditada: { label: "Interditada", tone: "danger" },
  perpetuidade: { label: "Em perpetuidade", tone: "inverse" },
};
const statusMeta = (key, fallbackName) =>
  STATUS_META[key] || { label: fallbackName || key, tone: "neutral" };

const TRANSFER_REASONS = {
  venda: "Venda",
  doacao: "Doação",
  heranca: "Herança",
  decisao_judicial: "Decisão judicial",
  regularizacao: "Regularização",
  outro: "Outro",
};

const ACQUISITION_LABEL = {
  emissao: "Emissão original",
  transferencia: "Transferência",
  heranca: "Herança",
  regularizacao: "Regularização",
  outro: "Outro",
};

function yearsBetween(start = "", end = "") {
  const a = Number(String(start).slice(-4));
  const b = end ? Number(String(end).slice(-4)) : new Date().getFullYear();
  const diff = Math.max(b - a, 0);
  return diff === 1 ? "1 ano" : `${diff} anos`;
}

// financeiro-resumo vem da feature de billings (não integrada nesta tela)
const FINANCE = [];

const TIMELINE_TONE = {
  pagamento: "success",
  sepultamento: "navy",
  documento: "navy",
  cobranca: "warning",
  concessao: "navy",
  status: "navy",
  bloqueio: "danger",
  desbloqueio: "success",
  transferencia: "navy",
  exumacao: "warning",
  reforma: "navy",
};

// eventType (API) → chave de tipo usada pelo TIMELINE_TONE do front
const API_EVENT_TO_FRONT = {
  sepultamento: "sepultamento",
  exumacao: "exumacao",
  reforma: "reforma",
  manutencao: "reforma",
  transferencia_propriedade: "transferencia",
  concessao: "concessao",
  cobranca: "cobranca",
  pagamento: "pagamento",
  bloqueio: "bloqueio",
  desbloqueio: "desbloqueio",
  alteracao_status: "status",
  documento_emitido: "documento",
  deposito_ossario: "documento",
  agendamento: "documento",
  outro: "status",
};

const MAINTENANCE_TYPES = {
  reforma: "Reforma",
  construcao: "Construção",
  limpeza: "Limpeza",
  pintura: "Pintura",
  reparo: "Reparo",
};

const concessionTypeLabel = (t) => (t === "perpetua" ? "Perpétua" : t === "temporaria" ? "Temporária" : "—");
const toInputDate = (br) => {
  // "16/07/2026" ou ISO → yyyy-mm-dd para <input type=date>
  if (!br) return new Date().toISOString().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}/.test(br)) return br.slice(0, 10);
  const [d, m, y] = br.split("/");
  return y ? `${y}-${m}-${d}` : new Date().toISOString().slice(0, 10);
};

export default function GraveDetailPage() {
  const params = useParams();
  const id = params?.id;

  // ---- dados da API ----
  const { data: summary, loading, error, refetch } = useResource(
    ({ signal }) => getGraveSummary(id, { signal }),
    [id]
  );
  const { data: timelineData, refetch: refetchTimeline } = useResource(
    ({ signal }) => getGraveTimeline(id, { perPage: 50 }, { signal }),
    [id]
  );
  const { data: concessionsData, refetch: refetchConcessions } = useResource(
    ({ signal }) => getGraveConcessions(id, { signal }),
    [id]
  );
  const { data: peopleData } = useResource(({ signal }) => listPeople({ perPage: 100 }, { signal }), []);
  const { data: deceasedData } = useResource(({ signal }) => listDeceased({ perPage: 100 }, { signal }), []);

  // anexos reais do jazigo (attachableType = grave) — fetch/loading/erro via API
  const {
    data: attachmentsData,
    loading: attachmentsLoading,
    error: attachmentsError,
    refetch: refetchAttachments,
  } = useResource(({ signal }) => listAttachments({ type: "grave", id, signal }), [id]);
  const attachments = useMemo(
    () => (attachmentsData || []).map(toAttachmentView),
    [attachmentsData]
  );

  const PEOPLE = useMemo(
    () => (peopleData?.data ?? []).map((p) => ({ id: p.id, name: p.fullName, cpf: p.cpf || "" })),
    [peopleData]
  );
  const AVAILABLE_DECEASED = useMemo(
    () =>
      (deceasedData?.data ?? [])
        .filter((d) => d.currentLocationType !== "sepultado")
        .map((d) => ({ id: d.id, name: d.fullName, death: formatDate(d.deathDate) })),
    [deceasedData]
  );

  // ---- view model derivado da API ----
  const view = useMemo(() => {
    const g = summary?.grave;
    if (!g) return null;
    const children = g.childGraves || [];
    let drawers;
    let occupants;
    const mapBurial = (b, drawerCode, graveId) => ({
      name: b.deceased?.fullName || "Sepultado",
      death: formatDate(b.deceased?.deathDate),
      burial: formatDate(b.burialDate),
      drawer: drawerCode,
      deceasedId: b.deceasedId,
      graveId,
      burialId: b.id,
    });
    if (children.length) {
      drawers = children.map((c) => ({
        code: c.code,
        graveId: c.id,
        occupant: c.burials?.[0]?.deceased?.fullName || null,
      }));
      occupants = [];
      children.forEach((c) => (c.burials || []).forEach((b) => occupants.push(mapBurial(b, c.code, c.id))));
      (g.burials || []).forEach((b) => occupants.push(mapBurial(b, "—", g.id)));
    } else {
      const cap = g.capacity || 1;
      const parentBurials = g.burials || [];
      drawers = Array.from({ length: cap }).map((_, i) => ({
        code: `V${i + 1}`,
        graveId: g.id,
        occupant: parentBurials[i]?.deceased?.fullName || null,
      }));
      occupants = parentBurials.map((b, i) => mapBurial(b, drawers[i]?.code || "—", g.id));
    }

    const activeConc = (g.concessions || []).find((c) => c.status === "ativa") || (g.concessions || [])[0] || null;
    const concession = activeConc
      ? {
          id: activeConc.id,
          personId: activeConc.personId,
          owner: activeConc.person?.fullName || "—",
          cpf: activeConc.person?.cpf || "—",
          type: concessionTypeLabel(activeConc.concessionType),
          contract: activeConc.contractNumber || "—",
          start: formatDate(activeConc.startDate),
          phone: activeConc.person?.phonePrimary || "—",
          acquisition: activeConc.acquisitionMethod || "—",
        }
      : null;

    return {
      grave: {
        id: g.id,
        code: g.code,
        type: unitTypeLabel(g.unitType),
        cemetery: g.cemetery?.name || "—",
        block: g.lot?.street?.block ? `Quadra ${g.lot.street.block.name || g.lot.street.block.code}` : "—",
        street: g.lot?.street?.name || g.lot?.street?.code || "—",
        lot: g.lot?.code ? `Lote ${g.lot.code}` : "—",
        capacity: g.capacity || 0,
        areaM2: g.areaM2 ? `${Number(g.areaM2).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} m²` : "—",
        createdAt: formatDate(g.createdAt),
        shape: g.geoPolygon || null,
        // Campos oficiais dos modelos de documento (certidão/autorização).
        tombType: g.tombType || "",
        utilizacao: g.utilizacao || "",
        carneiraPermission: g.carneiraPermission || "",
        notes: g.notes || "",
      },
      status: normalizeStatusSlug(g.status?.slug),
      statusName: g.status?.name,
      blocked: g.isBlocked ? { reason: g.blockedReason || "Bloqueio administrativo" } : null,
      concession,
      drawers,
      occupants,
    };
  }, [summary]);

  // histórico de titulares (concessões encerradas/transferidas + a ativa)
  const ownerHistory = useMemo(() => {
    const list = (concessionsData ?? []).slice().sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
    const closed = list.filter((c) => c.status !== "ativa");
    return closed.map((c, idx) => {
      // titular seguinte (mais recente) = para quem foi transferida
      const newer = list[list.indexOf(c) - 1];
      return {
        owner: c.person?.fullName || "—",
        cpf: c.person?.cpf || "—",
        contract: c.contractNumber || "—",
        type: concessionTypeLabel(c.concessionType),
        acquisition: c.acquisitionMethod || "—",
        start: formatDate(c.startDate),
        end: formatDate(c.endDate),
        transferTo: newer?.person?.fullName || "—",
        transferReason: newer?.acquisitionMethod === "heranca" ? "heranca" : "transferencia",
        kinship: "",
        contractUrl: DEMO_CONTRATO_PDF,
      };
    });
  }, [concessionsData]);

  const timeline = useMemo(
    () =>
      (timelineData?.data ?? []).map((e) => ({
        type: API_EVENT_TO_FRONT[e.eventType] || "status",
        date: formatDate(e.occurredAt),
        text: e.title + (e.description ? ` — ${e.description}` : ""),
      })),
    [timelineData]
  );

  // ---- estado local (modais, formulários, feedback) ----
  const [demarcating, setDemarcating] = useState(false);
  const [statusModal, setStatusModal] = useState(false);
  const [blockModal, setBlockModal] = useState(false);
  const [burialModal, setBurialModal] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [maintModal, setMaintModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  // Modal de edição dos campos oficiais (dados dos modelos de documento).
  const [officialModal, setOfficialModal] = useState(false);
  const [officialForm, setOfficialForm] = useState({
    tombType: "", utilizacao: "", carneiraPermission: "", notes: "",
  });
  const [exhumTarget, setExhumTarget] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [contractPreview, setContractPreview] = useState(null);

  const [certificate, setCertificate] = useState(null);
  const [exhumations, setExhumations] = useState({});
  const [maintForm, setMaintForm] = useState({ type: "reforma", description: "", requester: "" });
  const [exhumForm, setExhumForm] = useState({ reason: "", requester: "" });
  const [statusForm, setStatusForm] = useState({ status: "", reason: "" });
  const [blockReason, setBlockReason] = useState("");
  const [burialForm, setBurialForm] = useState({ deceased: "", date: toInputDate(), time: "10:00", drawer: "", declarant: "", funeral: "" });
  const [transferForm, setTransferForm] = useState({ to: "", reason: "venda", kinship: "", date: toInputDate() });

  // ---- estados de carregamento / erro ----
  if (loading && !view) {
    return (
      <div className={styles.page}>
        <Skeleton variant="line" width={140} />
        <Skeleton variant="card" count={3} />
      </div>
    );
  }
  if (error || !view) {
    return (
      <div className={styles.page}>
        <Link href="/painel/sepulturas" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sepulturas
        </Link>
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const GRAVE = view.grave;
  const status = view.status;
  const blocked = view.blocked;
  const concession = view.concession;
  const drawers = view.drawers;
  const occupants = view.occupants;
  const shape = GRAVE.shape;
  const mapped = isShapeComplete(shape);
  const freeDrawers = drawers.filter((d) => !d.occupant);
  const isFull = freeDrawers.length === 0;

  async function runAction(action, { closeAll } = {}) {
    setSaving(true);
    setActionError(null);
    try {
      await action();
      await Promise.all([refetch(), refetchTimeline(), refetchConcessions()]);
      if (closeAll) closeAll();
      return true;
    } catch (e) {
      setActionError(e?.message || "Não foi possível concluir a operação.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  // ---- ações (endpoints reais) ----
  function saveStatus() {
    runAction(
      () => changeGraveStatus(id, { slug: frontStatusToApiSlug(statusForm.status), reason: statusForm.reason || undefined }),
      { closeAll: () => setStatusModal(false) }
    );
  }

  function saveBlock() {
    runAction(() => (blocked ? unblockGrave(id) : blockGrave(id, blockReason || "Bloqueio administrativo")), {
      closeAll: () => { setBlockReason(""); setBlockModal(false); },
    });
  }

  function saveBurial() {
    const target = drawers.find((d) => d.code === burialForm.drawer) || freeDrawers[0];
    runAction(
      () =>
        createBurial({
          graveId: target?.graveId || id,
          deceasedId: burialForm.deceased,
          burialDate: burialForm.date,
          burialTime: burialForm.time || undefined,
          declarantPersonId: burialForm.declarant || undefined,
          funeralHome: burialForm.funeral || undefined,
        }),
      {
        closeAll: () => {
          setBurialForm({ deceased: "", date: toInputDate(), time: "10:00", drawer: "", declarant: "", funeral: "" });
          setBurialModal(false);
        },
      }
    );
  }

  function saveTransfer() {
    if (!concession?.id) return;
    runAction(
      () =>
        transferConcession(concession.id, {
          toPersonId: transferForm.to,
          transferReason: transferForm.reason,
          familyRelationship: transferForm.reason === "heranca" ? transferForm.kinship || undefined : undefined,
          transferDate: transferForm.date,
        }),
      {
        closeAll: () => {
          setTransferForm({ to: "", reason: "venda", kinship: "", date: toInputDate() });
          setTransferModal(false);
        },
      }
    );
  }

  function saveMaintenance() {
    runAction(
      () =>
        createGraveMaintenance(id, {
          maintenanceType: maintForm.type,
          description: maintForm.description || undefined,
          requestedByPersonId: maintForm.requester || undefined,
        }),
      {
        closeAll: () => {
          setMaintForm({ type: "reforma", description: "", requester: "" });
          setMaintModal(false);
        },
      }
    );
  }

  function saveExhumation() {
    const target = exhumTarget;
    runAction(
      () =>
        createExhumation({
          graveId: target.graveId || id,
          deceasedId: target.deceasedId,
          reason: exhumForm.reason || undefined,
          requestedByPersonId: exhumForm.requester || undefined,
        }),
      {
        closeAll: () => {
          setExhumations((map) => ({ ...map, [target.name]: "processo aberto" }));
          setExhumForm({ reason: "", requester: "" });
          setExhumTarget(null);
        },
      }
    );
  }

  async function issueCertificate() {
    setSaving(true);
    setActionError(null);
    try {
      if (certificate) {
        await reissueDocument(certificate.id);
        setCertificate((c) => ({ ...c, reissues: c.reissues + 1 }));
      } else {
        const doc = await issueDocument({
          documentType: "certidao_perpetuidade",
          graveId: id,
          personId: concession?.personId,
        });
        setCertificate({ id: doc?.id, number: doc?.documentNumber || doc?.number || "—", reissues: 0 });
      }
      await refetchTimeline();
    } catch (e) {
      setActionError(e?.message || "Não foi possível emitir a certidão.");
    } finally {
      setSaving(false);
    }
  }

  function saveDemarcation(nextShape) {
    runAction(() => updateGrave(id, { geoPolygon: nextShape }), { closeAll: () => setDemarcating(false) });
  }

  // Abre o modal dos campos oficiais pré-preenchido com os valores atuais.
  function openOfficialEdit() {
    setOfficialForm({
      tombType: GRAVE.tombType || "",
      utilizacao: GRAVE.utilizacao || "",
      carneiraPermission: GRAVE.carneiraPermission || "",
      notes: GRAVE.notes || "",
    });
    setOfficialModal(true);
  }

  function saveOfficial() {
    runAction(
      () => updateGrave(id, {
        tombType: officialForm.tombType || null,
        utilizacao: officialForm.utilizacao || null,
        carneiraPermission: officialForm.carneiraPermission || null,
        notes: officialForm.notes || null,
      }),
      { closeAll: () => setOfficialModal(false) }
    );
  }

  return (
    <div className={styles.page}>
      <Link href="/painel/sepulturas" className={styles.back}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sepulturas
      </Link>

      <header className={styles.head}>
        <div className={styles.headInfo}>
          <div className={styles.headTitleRow}>
            <h1 className={styles.title}>{GRAVE.code}</h1>
            <Badge tone={statusMeta(status, view.statusName).tone} dot>{statusMeta(status, view.statusName).label}</Badge>
            <Badge tone="neutral">{GRAVE.type}</Badge>
            {blocked && <Badge tone="danger">Bloqueado</Badge>}
          </div>
          <p className={styles.trail}>
            {GRAVE.cemetery} <em>›</em> {GRAVE.block} <em>›</em> {GRAVE.street} <em>›</em> {GRAVE.lot}
          </p>
        </div>
        <div className={styles.headActions}>
          <Button variant="ghost" onClick={() => { setStatusForm({ status, reason: "" }); setStatusModal(true); }}>
            Mudar situação
          </Button>
          <Button variant="ghost" onClick={() => setMaintModal(true)}>Manutenção</Button>
          <Button variant={blocked ? "secondary" : "danger"} onClick={() => setBlockModal(true)}>
            {blocked ? "Desbloquear" : "Bloquear"}
          </Button>
          <Button onClick={() => setBurialModal(true)}>Registrar sepultamento</Button>
        </div>
      </header>

      {actionError && (
        <Alert tone="danger" title="Não foi possível concluir a operação">
          {actionError}
        </Alert>
      )}

      {blocked && (
        <Alert tone="danger" title="Jazigo bloqueado">
          {blocked.reason} — novos sepultamentos e reformas estão suspensos até o desbloqueio.
        </Alert>
      )}

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Localização no mapa</h2>
                <p className={styles.cardSub}>Demarcação sobre a ortofoto do cemitério</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setDemarcating(true)}>
                {mapped ? "Editar demarcação" : "Demarcar no mapa"}
              </Button>
            </header>
            {mapped ? (
              <MapCanvas shape={shape} mode="view" height={300} />
            ) : (
              <div className={styles.mapEmpty}>
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M12 21s6-5.5 6-10a6 6 0 10-12 0c0 4.5 6 10 6 10z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
                  <circle cx="12" cy="10.6" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                <p>Esta sepultura ainda não foi demarcada na ortofoto.</p>
                <Button size="sm" onClick={() => setDemarcating(true)}>Demarcar agora</Button>
              </div>
            )}
          </article>

          <article className={styles.card}>
            <Tabs
              items={[
                {
                  label: "Sepultados",
                  count: occupants.length,
                  content: occupants.length ? (
                    <ul className={styles.list}>
                      {occupants.map((person) => (
                        <li key={person.burialId || person.name + person.drawer} className={styles.listItem}>
                          <Avatar name={person.name} size="md" />
                          <div className={styles.listBody}>
                            <span className={styles.listTitle}>{person.name}</span>
                            <span className={styles.listMeta}>✝ {person.death} · Sepultado em {person.burial}</span>
                          </div>
                          {exhumations[person.name] ? (
                            <Badge tone="warning" dot>Exumação solicitada</Badge>
                          ) : (
                            <>
                              <Badge tone="neutral">Gaveta {person.drawer}</Badge>
                              <Button variant="ghost" size="sm" onClick={() => setExhumTarget(person)}>
                                Exumar
                              </Button>
                            </>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.cardSub}>Nenhum sepultamento registrado nesta unidade.</p>
                  ),
                },
                {
                  label: "Financeiro",
                  count: FINANCE.length,
                  content: FINANCE.length ? (
                    <ul className={styles.list}>
                      {FINANCE.map((item) => (
                        <li key={item.period} className={styles.listItem}>
                          <span className={styles.financeYear}>{item.period}</span>
                          <div className={styles.listBody}>
                            <span className={styles.listTitle}>{item.desc}</span>
                            <span className={styles.listMeta}>Competência {item.period}</span>
                          </div>
                          <span className={styles.financeAmount}>{item.amount}</span>
                          <Badge tone="success">Pago</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.cardSub}>Sem lançamentos financeiros para esta sepultura.</p>
                  ),
                },
                {
                  label: "Linha do tempo",
                  content: timeline.length ? (
                    <ul className={styles.timeline}>
                      {timeline.map((event, index) => (
                        <li key={index} className={styles.timelineItem}>
                          <span className={`${styles.timelineDot} ${styles[`tl_${TIMELINE_TONE[event.type]}`]}`} />
                          <div className={styles.timelineBody}>
                            <span className={styles.timelineText}>{event.text}</span>
                            <span className={styles.timelineDate}>{event.date}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className={styles.cardSub}>Ainda não há eventos registrados nesta sepultura.</p>
                  ),
                },
                {
                  label: "Anexos",
                  count: attachments.length,
                  content: (
                    <div className={styles.attachTab}>
                      <div className={styles.attachActions}>
                        <Button variant="ghost" size="sm" onClick={() => setUploadModal(true)}>
                          Adicionar anexo
                        </Button>
                      </div>
                      <AttachmentList
                        files={attachments}
                        loading={attachmentsLoading}
                        error={attachmentsError}
                        onRetry={refetchAttachments}
                        emptyLabel="Anexe certidões, contratos e fotos deste jazigo."
                        onDelete={async (file) => {
                          await deleteAttachment(file.id);
                          await refetchAttachments();
                        }}
                      />
                    </div>
                  ),
                },
              ]}
            />
          </article>
        </div>

        <div className={styles.sideCol}>
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Concessão</h2>
              {concession && <Badge tone="inverse">{concession.type}</Badge>}
            </header>
            {concession ? (
              <>
                <div className={styles.ownerBox}>
                  <Avatar name={concession.owner} size="lg" />
                  <div>
                    <span className={styles.ownerName}>{concession.owner}</span>
                    <span className={styles.ownerDoc}>{concession.cpf}</span>
                  </div>
                </div>
                <dl className={styles.detailList}>
                  <div className={styles.detailRow}><dt>Contrato</dt><dd>{concession.contract}</dd></div>
                  <div className={styles.detailRow}><dt>Vigência</dt><dd>Desde {concession.start}</dd></div>
                  <div className={styles.detailRow}><dt>Contato</dt><dd>{concession.phone}</dd></div>
                </dl>
                <div className={styles.certBox}>
                  {certificate ? (
                    <>
                      <div className={styles.certInfo}>
                        <span className={styles.certLabel}>Certidão de Perpetuidade</span>
                        <span className={styles.certNumber}>
                          nº {certificate.number}
                          {certificate.reissues > 0 && ` · ${certificate.reissues}ª via emitida`}
                        </span>
                      </div>
                      <div className={styles.certActions}>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setContractPreview({ name: `certidao-perpetuidade-${String(certificate.number).replace("/", "-")}.pdf`, category: "Certidão de Perpetuidade", url: DEMO_CERTIDAO_PDF })}
                        >
                          Ver
                        </Button>
                        <Button variant="ghost" size="sm" loading={saving} onClick={issueCertificate}>
                          2ª via
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" full loading={saving} onClick={issueCertificate}>
                      Emitir Certidão de Perpetuidade
                    </Button>
                  )}
                </div>
                <div className={styles.cardFootActions}>
                  <Button variant="secondary" size="sm" full onClick={() => setHistoryModal(true)}>
                    Histórico de proprietários
                  </Button>
                  <Button variant="ghost" size="sm" full onClick={() => setTransferModal(true)}>
                    Transferir concessão
                  </Button>
                </div>
              </>
            ) : (
              <p className={styles.cardSub}>Esta sepultura ainda não possui concessão ativa.</p>
            )}
          </article>

          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Ocupação</h2>
              <span className={styles.occupancyBig}>{occupants.length}/{GRAVE.capacity}</span>
            </header>
            <div className={styles.drawerGrid}>
              {drawers.map((drawer) => (
                <div key={drawer.code} className={`${styles.drawer} ${drawer.occupant ? styles.drawerBusy : styles.drawerFree}`}>
                  <span className={styles.drawerCode}>{drawer.code}</span>
                  <span className={styles.drawerName}>{drawer.occupant || "Disponível"}</span>
                </div>
              ))}
            </div>
          </article>

          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Detalhes</h2>
              <Button variant="ghost" size="sm" onClick={openOfficialEdit}>Editar</Button>
            </header>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}><dt>Área</dt><dd>{GRAVE.areaM2}</dd></div>
              <div className={styles.detailRow}><dt>Tipo do túmulo</dt><dd>{GRAVE.tombType || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Utilização</dt><dd>{GRAVE.utilizacao || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Permissão de carneira</dt><dd>{GRAVE.carneiraPermission || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Observação</dt><dd>{GRAVE.notes || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Cadastrada em</dt><dd>{GRAVE.createdAt}</dd></div>
              <div className={styles.detailRow}>
                <dt>Demarcação</dt>
                <dd>{mapped ? <Badge tone="success">No mapa</Badge> : <Badge tone="warning">Pendente</Badge>}</dd>
              </div>
            </dl>
          </article>
        </div>
      </div>

      {/* ---- estúdio de demarcação (tela cheia) ---- */}
      <MapStudio
        open={demarcating}
        onClose={() => setDemarcating(false)}
        title="Demarcação no mapa"
        subtitle={`${GRAVE.code} · aproxime até o lote e ajuste a forma da unidade`}
        initial={shape}
        onSave={saveDemarcation}
        saving={saving}
      />

      {/* ---- mudar situação ---- */}
      <Modal
        open={statusModal}
        onClose={() => setStatusModal(false)}
        title="Mudar situação"
        subtitle={`${GRAVE.code} · situação atual: ${statusMeta(status, view.statusName).label}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusModal(false)}>Cancelar</Button>
            <Button loading={saving} disabled={statusForm.status === status} onClick={saveStatus}>Salvar situação</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <FormField label="Nova situação" required>
            <Select value={statusForm.status} onChange={(e) => setStatusForm({ ...statusForm, status: e.target.value })}>
              {Object.entries(STATUS_META).map(([key, meta]) => (
                <option key={key} value={key}>{meta.label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Motivo" hint="Registrado na linha do tempo do jazigo">
            <Textarea rows={3} value={statusForm.reason} onChange={(e) => setStatusForm({ ...statusForm, reason: e.target.value })} placeholder="Ex.: reforma concluída, reserva a pedido do concessionário…" />
          </FormField>
        </div>
      </Modal>

      {/* ---- editar dados oficiais (campos dos modelos de documento) ---- */}
      <Modal
        open={officialModal}
        onClose={() => setOfficialModal(false)}
        title="Editar dados da sepultura"
        subtitle={`${GRAVE.code} · campos usados na certidão e na autorização`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOfficialModal(false)}>Cancelar</Button>
            <Button loading={saving} onClick={saveOfficial}>Salvar dados</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <FormField label="Tipo do túmulo">
            <Select
              value={TOMB_TYPE_OPTIONS.includes(officialForm.tombType) || !officialForm.tombType ? officialForm.tombType : "__free"}
              onChange={(e) => setOfficialForm({ ...officialForm, tombType: e.target.value === "__free" ? " " : e.target.value })}
            >
              <option value="">Não informado</option>
              {TOMB_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="__free">Outro (digitar)…</option>
            </Select>
          </FormField>
          {officialForm.tombType !== "" && !TOMB_TYPE_OPTIONS.includes(officialForm.tombType) && (
            <FormField label="Tipo do túmulo (livre)">
              <Input
                value={officialForm.tombType.trim()}
                onChange={(e) => setOfficialForm({ ...officialForm, tombType: e.target.value })}
                placeholder="Descreva o tipo do túmulo"
              />
            </FormField>
          )}
          <FormField label="Utilização">
            <Select value={officialForm.utilizacao} onChange={(e) => setOfficialForm({ ...officialForm, utilizacao: e.target.value })}>
              <option value="">Não informado</option>
              {UTILIZACAO_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Permissão de carneira">
            <Select value={officialForm.carneiraPermission} onChange={(e) => setOfficialForm({ ...officialForm, carneiraPermission: e.target.value })}>
              <option value="">Não informado</option>
              <option value="Sim">Sim</option>
              <option value="Não">Não</option>
            </Select>
          </FormField>
          <FormField label="Observação">
            <Textarea rows={3} value={officialForm.notes} onChange={(e) => setOfficialForm({ ...officialForm, notes: e.target.value })} placeholder="Observações da sepultura (aparecem no documento)" />
          </FormField>
        </div>
      </Modal>

      {/* ---- bloquear / desbloquear ---- */}
      <Modal
        open={blockModal}
        onClose={() => setBlockModal(false)}
        title={blocked ? "Desbloquear jazigo" : "Bloquear jazigo"}
        subtitle={GRAVE.code}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBlockModal(false)}>Cancelar</Button>
            <Button variant={blocked ? "primary" : "danger"} loading={saving} onClick={saveBlock}>
              {blocked ? "Confirmar desbloqueio" : "Confirmar bloqueio"}
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          {blocked ? (
            <Alert tone="info" title="Liberar operações">
              O jazigo voltará a aceitar sepultamentos, reformas e demais movimentações.
            </Alert>
          ) : (
            <>
              <Alert tone="warning" title="O bloqueio suspende as operações">
                Novos sepultamentos e reformas ficam impedidos enquanto o jazigo estiver bloqueado
                — usado no controle de inadimplência e em interdições administrativas.
              </Alert>
              <FormField label="Motivo do bloqueio" required>
                <Textarea rows={3} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Ex.: débitos em atraso desde 03/2026…" />
              </FormField>
            </>
          )}
        </div>
      </Modal>

      {/* ---- registrar sepultamento ---- */}
      <Modal
        open={burialModal}
        onClose={() => setBurialModal(false)}
        title="Registrar sepultamento"
        subtitle={`${GRAVE.code} · ${freeDrawers.length} gaveta(s) disponível(is)`}
        width={620}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBurialModal(false)}>Cancelar</Button>
            <Button loading={saving} disabled={Boolean(blocked) || isFull || !burialForm.deceased} onClick={saveBurial}>
              Confirmar sepultamento
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          {blocked && (
            <Alert tone="danger" title="Jazigo bloqueado">
              Desbloqueie o jazigo para registrar novos sepultamentos.
            </Alert>
          )}
          {!blocked && isFull && (
            <Alert tone="warning" title="Capacidade esgotada">
              Todas as gavetas estão ocupadas — realize uma exumação ou escolha outra unidade.
            </Alert>
          )}
          <div className={styles.formGrid}>
            <FormField label="Sepultado" required>
              <Select value={burialForm.deceased} onChange={(e) => setBurialForm({ ...burialForm, deceased: e.target.value })}>
                <option value="" disabled>Selecione…</option>
                {AVAILABLE_DECEASED.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} · ✝ {d.death}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Gaveta" required>
              <Select value={burialForm.drawer} onChange={(e) => setBurialForm({ ...burialForm, drawer: e.target.value })}>
                <option value="">Automática ({freeDrawers[0]?.code || "—"})</option>
                {freeDrawers.map((d) => (
                  <option key={d.code} value={d.code}>Gaveta {d.code}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Data do sepultamento" required>
              <Input type="date" value={burialForm.date} onChange={(e) => setBurialForm({ ...burialForm, date: e.target.value })} />
            </FormField>
            <FormField label="Horário">
              <Input type="time" value={burialForm.time} onChange={(e) => setBurialForm({ ...burialForm, time: e.target.value })} />
            </FormField>
            <FormField label="Declarante / responsável">
              <Select value={burialForm.declarant} onChange={(e) => setBurialForm({ ...burialForm, declarant: e.target.value })}>
                <option value="">Selecione…</option>
                {PEOPLE.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Funerária">
              <Input value={burialForm.funeral} onChange={(e) => setBurialForm({ ...burialForm, funeral: e.target.value })} placeholder="Nome da funerária" />
            </FormField>
          </div>
          <Alert tone="info">
            A <strong>Autorização de Sepultamento</strong> será emitida automaticamente com numeração
            sequencial, e a situação do jazigo será atualizada.
          </Alert>
        </div>
      </Modal>

      {/* ---- transferir concessão ---- */}
      <Modal
        open={transferModal}
        onClose={() => setTransferModal(false)}
        title="Transferir concessão"
        subtitle={`Titular atual: ${concession?.owner || "—"}`}
        width={560}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransferModal(false)}>Cancelar</Button>
            <Button loading={saving} disabled={!transferForm.to} onClick={saveTransfer}>Confirmar transferência</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <FormField label="Novo titular" required>
            <Select value={transferForm.to} onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })}>
              <option value="" disabled>Selecione a pessoa…</option>
              {PEOPLE.filter((p) => p.name !== concession?.owner).map((p) => (
                <option key={p.id} value={p.id}>{p.name} · {p.cpf}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Motivo" required>
            <Select value={transferForm.reason} onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}>
              {Object.entries(TRANSFER_REASONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </FormField>
          {transferForm.reason === "heranca" && (
            <FormField label="Vínculo familiar" required hint="Parentesco com o titular atual">
              <Input value={transferForm.kinship} onChange={(e) => setTransferForm({ ...transferForm, kinship: e.target.value })} placeholder="Ex.: filho, cônjuge…" />
            </FormField>
          )}
          <FormField label="Data da transferência" required>
            <Input type="date" value={transferForm.date} onChange={(e) => setTransferForm({ ...transferForm, date: e.target.value })} />
          </FormField>
          <Alert tone="info">
            A concessão atual será encerrada e uma nova será emitida para o novo titular.
            Todo o histórico permanece registrado na linha do tempo.
          </Alert>
        </div>
      </Modal>

      {/* ---- histórico de proprietários (auditoria completa) ---- */}
      <Modal
        open={historyModal}
        onClose={() => setHistoryModal(false)}
        title="Histórico de proprietários"
        subtitle={`${GRAVE.code} · ${GRAVE.cemetery}`}
        width={780}
        footer={<Button variant="ghost" onClick={() => setHistoryModal(false)}>Fechar</Button>}
      >
        <div className={styles.histStats}>
          <span className={styles.histStat}>
            <strong>{ownerHistory.length + (concession ? 1 : 0)}</strong> titulares
          </span>
          <span className={styles.histStat}>
            Concessão desde <strong>{ownerHistory[ownerHistory.length - 1]?.start || concession?.start || "—"}</strong>
          </span>
          <span className={styles.histStat}>
            <strong>{ownerHistory.length}</strong> transferência(s)
          </span>
        </div>

        <ul className={styles.histTimeline}>
          {concession && (
            <li className={styles.histEntry}>
              <span className={`${styles.histDot} ${styles.histDotCurrent}`} />
              <div className={`${styles.histCard} ${styles.histCardCurrent}`}>
                <header className={styles.histCardHead}>
                  <Avatar name={concession.owner} size="md" />
                  <div className={styles.histOwner}>
                    <span className={styles.histOwnerName}>{concession.owner}</span>
                    <span className={styles.histOwnerDoc}>CPF {concession.cpf}</span>
                  </div>
                  <Badge tone="success" dot>Titular atual</Badge>
                </header>
                <dl className={styles.histGrid}>
                  <div><dt>Contrato</dt><dd>{concession.contract}</dd></div>
                  <div><dt>Tipo</dt><dd>{concession.type}</dd></div>
                  <div><dt>Vigência</dt><dd>Desde {concession.start} · {yearsBetween(concession.start)}</dd></div>
                  <div><dt>Forma de aquisição</dt><dd>{ACQUISITION_LABEL[concession.acquisition] || "—"}</dd></div>
                </dl>
                <footer className={styles.histCardFoot}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setContractPreview({ name: `${concession.contract}.pdf`, category: "Contrato de concessão", url: DEMO_CONTRATO_PDF })}
                  >
                    Ver contrato
                  </Button>
                </footer>
              </div>
            </li>
          )}

          {ownerHistory.map((entry, index) => (
            <li key={index} className={styles.histEntry}>
              <span className={styles.histDot} />
              <div className={styles.histCard}>
                <header className={styles.histCardHead}>
                  <Avatar name={entry.owner} size="md" />
                  <div className={styles.histOwner}>
                    <span className={styles.histOwnerName}>{entry.owner}</span>
                    <span className={styles.histOwnerDoc}>CPF {entry.cpf}</span>
                  </div>
                  <Badge tone="neutral">Encerrada</Badge>
                </header>
                <dl className={styles.histGrid}>
                  <div><dt>Contrato</dt><dd>{entry.contract}</dd></div>
                  <div><dt>Tipo</dt><dd>{entry.type}</dd></div>
                  <div><dt>Vigência</dt><dd>{entry.start} — {entry.end} · {yearsBetween(entry.start, entry.end)}</dd></div>
                  <div><dt>Forma de aquisição</dt><dd>{ACQUISITION_LABEL[entry.acquisition] || "—"}</dd></div>
                </dl>
                <div className={styles.histTransfer}>
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span>
                    Transferida em <strong>{entry.end}</strong> para <strong>{entry.transferTo}</strong> por{" "}
                    <strong>{TRANSFER_REASONS[entry.transferReason]}</strong>
                    {entry.transferReason === "heranca" && entry.kinship ? ` (vínculo: ${entry.kinship})` : ""}
                  </span>
                </div>
                {entry.contractUrl && (
                  <footer className={styles.histCardFoot}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setContractPreview({ name: `${entry.contract}.pdf`, category: "Contrato de concessão", url: entry.contractUrl })}
                    >
                      Ver contrato
                    </Button>
                  </footer>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Modal>

      {/* ---- solicitar manutenção/reforma ---- */}
      <Modal
        open={maintModal}
        onClose={() => setMaintModal(false)}
        title="Solicitar manutenção"
        subtitle={GRAVE.code}
        footer={
          <>
            <Button variant="ghost" onClick={() => setMaintModal(false)}>Cancelar</Button>
            <Button loading={saving} disabled={Boolean(blocked)} onClick={saveMaintenance}>
              Registrar solicitação
            </Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          {blocked && (
            <Alert tone="danger" title="Jazigo bloqueado">
              Reformas e manutenções ficam impedidas enquanto houver bloqueio —
              regularize a situação para prosseguir.
            </Alert>
          )}
          <FormField label="Tipo de serviço" required>
            <Select value={maintForm.type} onChange={(e) => setMaintForm({ ...maintForm, type: e.target.value })}>
              {Object.entries(MAINTENANCE_TYPES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Solicitante">
            <Select value={maintForm.requester} onChange={(e) => setMaintForm({ ...maintForm, requester: e.target.value })}>
              <option value="">Administração do cemitério</option>
              {PEOPLE.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Descrição" hint="Registrada na linha do tempo do jazigo">
            <Textarea rows={3} value={maintForm.description} onChange={(e) => setMaintForm({ ...maintForm, description: e.target.value })} placeholder="Ex.: troca do revestimento, recuperação da lápide…" />
          </FormField>
        </div>
      </Modal>

      {/* ---- solicitar exumação ---- */}
      <Modal
        open={Boolean(exhumTarget)}
        onClose={() => setExhumTarget(null)}
        title="Solicitar exumação"
        subtitle={exhumTarget ? `${exhumTarget.name} · gaveta ${exhumTarget.drawer} · ${GRAVE.code}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setExhumTarget(null)}>Cancelar</Button>
            <Button loading={saving} onClick={saveExhumation}>Abrir processo de exumação</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <Alert tone="warning" title="Processo com etapas de autorização">
            A solicitação abre um processo numerado que segue para autorização,
            agendamento e realização — com documentação obrigatória e destino dos
            restos mortais (ossário, outro jazigo, translado ou cremação).
          </Alert>
          <FormField label="Responsável solicitante" required>
            <Select value={exhumForm.requester} onChange={(e) => setExhumForm({ ...exhumForm, requester: e.target.value })}>
              <option value="" disabled>Selecione…</option>
              {PEOPLE.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="Motivo" required>
            <Textarea rows={3} value={exhumForm.reason} onChange={(e) => setExhumForm({ ...exhumForm, reason: e.target.value })} placeholder="Ex.: transferência para jazigo da família em outro cemitério…" />
          </FormField>
        </div>
      </Modal>

      <AttachmentUploadModal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title={`Anexos do jazigo ${GRAVE.code}`}
        onUpload={async (files) => {
          for (const f of files) {
            await uploadAttachment({ type: "grave", id, file: f.file, category: f.category, fileName: f.name });
          }
          await refetchAttachments();
        }}
      />

      <FileViewer open={Boolean(contractPreview)} file={contractPreview} onClose={() => setContractPreview(null)} />
    </div>
  );
}
