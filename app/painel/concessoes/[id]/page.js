"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import AttachmentList from "@/components/molecules/AttachmentList/AttachmentList";
import AttachmentUploadModal from "@/components/molecules/AttachmentUploadModal/AttachmentUploadModal";

import { api } from "@/lib/api/client";
import { useResource, useMutation } from "@/lib/api/useResource";
import {
  getConcession, renewConcession, transferConcession, terminateConcession,
} from "@/lib/api/resources/concessions";
import { listDocuments, fileHref, fetchDocumentPdf } from "@/lib/api/resources/documents";
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  toAttachmentView,
} from "@/lib/api/resources/attachments";

const TODAY = new Date("2026-07-16");

const TRANSFER_REASONS = {
  venda: "Venda",
  doacao: "Doação",
  heranca: "Herança",
  decisao_judicial: "Decisão judicial",
  regularizacao: "Regularização",
  outro: "Outro",
};

// rótulos amigáveis dos documentos oficiais (tipo cru → texto)
const DOC_TYPE_LABELS = {
  certidao_perpetuidade: "Certidão de perpetuidade",
  autorizacao_sepultamento: "Autorização de sepultamento",
  contrato_concessao: "Contrato de concessão",
  titulo_perpetuidade: "Título de perpetuidade",
};

const ACQUISITION_LABEL = {
  emissao: "Emissão original",
  transferencia: "Transferência",
  heranca: "Herança",
  regularizacao: "Regularização",
  outro: "Outro",
};

const UNIT_TYPE_LABEL = {
  cova: "Cova", jazigo: "Jazigo", gaveta: "Gaveta", tumulo: "Túmulo", outro: "Outro",
};

const FEE_STATUS_META = {
  ativa: { label: "Ativa", tone: "success" },
  suspensa: { label: "Suspensa", tone: "warning" },
  encerrada: { label: "Encerrada", tone: "neutral" },
};

function isoToBr(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

function parseIso(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatBRL(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (Number.isNaN(n)) return "—";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// endDate atual + N anos, em ISO — sugestão para o campo de renovação
function isoPlusYears(iso, years) {
  const base = parseIso(iso) || new Date(TODAY);
  base.setFullYear(base.getFullYear() + years);
  return base.toISOString().slice(0, 10);
}

export default function ConcessionDetailPage() {
  const { id } = useParams();

  const { data: concession, loading, error, refetch } = useResource(
    ({ signal }) => getConcession(id, { signal }),
    [id]
  );

  const [transferModal, setTransferModal] = useState(false);
  const [renewModal, setRenewModal] = useState(false);
  const [endModal, setEndModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);

  // documentos/anexos reais da concessão (attachableType = concession)
  const {
    data: attachmentsData,
    loading: attachmentsLoading,
    error: attachmentsError,
    refetch: refetchAttachments,
  } = useResource(({ signal }) => listAttachments({ type: "concession", id, signal }), [id]);
  // DOCUMENTOS OFICIAIS emitidos para esta sepultura (ex.: Certidão de
  // Perpetuidade) — gerados automaticamente pelo sistema, separados dos anexos.
  const graveId = concession?.grave?.id || null;
  const { data: officialData, loading: officialLoading, error: officialError } = useResource(
    ({ signal }) => (graveId ? listDocuments({ graveId, perPage: 50 }, { signal }) : Promise.resolve({ data: [] })),
    [graveId]
  );
  const officialDocs = officialData?.data ?? [];

  async function downloadOfficial(doc) {
    const direct = fileHref(doc.pdfUrl || doc.fileUrl);
    if (doc.pdfUrl && direct) { window.open(direct, "_blank", "noopener"); return; }
    try {
      const url = await fetchDocumentPdf(doc.id);
      window.open(url, "_blank", "noopener");
    } catch {
      if (direct) window.open(direct, "_blank", "noopener");
    }
  }

  const attachments = useMemo(
    () => (attachmentsData || []).map(toAttachmentView),
    [attachmentsData]
  );

  // transferência: busca de pessoa (endpoint compartilhado /people)
  const [personSearch, setPersonSearch] = useState("");
  const [personResults, setPersonResults] = useState([]);
  const [transferForm, setTransferForm] = useState({ to: "", reason: "venda", kinship: "" });
  const [renewDate, setRenewDate] = useState("");
  const [endReason, setEndReason] = useState("");

  const renew = useMutation((body) => renewConcession(id, body));
  const transfer = useMutation((body) => transferConcession(id, body));
  const terminate = useMutation(() => terminateConcession(id));

  useEffect(() => {
    if (!transferModal) return undefined;
    const term = personSearch.trim();
    if (!term) { setPersonResults([]); return undefined; }
    const t = setTimeout(async () => {
      try {
        const res = await api.get("/people", { params: { search: term, perPage: 8 }, meta: true });
        setPersonResults(res?.data ?? []);
      } catch {
        setPersonResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [personSearch, transferModal]);

  const view = useMemo(() => {
    if (!concession) return null;
    const c = concession;
    const isTemporary = c.concessionType === "temporaria";
    const startIso = c.startDate;
    const endIso = c.endDate;
    const start = parseIso(startIso);
    const end = isTemporary ? parseIso(endIso) : null;
    const progress = end && start
      ? Math.min(Math.max((TODAY - start) / (end - start), 0), 1)
      : 0;
    const monthsLeft = end
      ? Math.max(Math.round((end - TODAY) / (1000 * 60 * 60 * 24 * 30.44)), 0)
      : null;

    const grave = c.grave || {};
    const lot = grave.lot || {};
    const street = lot.street || {};
    const block = street.block || {};
    const trail = [block.name, street.name, lot.name || lot.code].filter(Boolean).join(" › ");
    const fee = (c.maintenanceFees || [])[0] || null;

    // linha do tempo a partir do histórico real (emissão + transferências)
    const events = [];
    events.push({
      type: "concessao",
      iso: startIso,
      text: `Concessão ${isTemporary ? "temporária" : "perpétua"} emitida${
        endIso ? ` — vigência até ${isoToBr(endIso)}` : ""
      }`,
    });
    (c.transfers || []).forEach((t) => {
      const reason = TRANSFER_REASONS[t.transferReason] || t.transferReason;
      events.push({
        type: "transferencia",
        iso: t.transferDate,
        text: `Transferência para ${t.toPerson?.fullName || "novo titular"} (${reason})`,
      });
    });
    if (c.status === "encerrada") {
      events.push({ type: "encerramento", iso: c.updatedAt, text: "Concessão encerrada" });
    }
    events.sort((a, b) => String(b.iso).localeCompare(String(a.iso)));

    return {
      isTemporary, startIso, endIso, start, end, progress, monthsLeft,
      startBr: isoToBr(startIso), endBr: isoToBr(endIso),
      grave, trail, fee, events,
      contract: c.contractNumber || `#${String(c.id).slice(0, 8)}`,
      status: c.status,
      owner: c.person?.fullName || "—",
      cpf: c.person?.cpf || "—",
      phone: c.person?.phonePrimary || c.person?.whatsapp || "—",
      email: c.person?.email || "—",
      responsible: c.responsible?.fullName || null,
      responsibleId: c.responsible?.id || null,
      value: formatBRL(c.value),
      acquisition: ACQUISITION_LABEL[c.acquisitionMethod] || "—",
    };
  }, [concession]);

  const STATUS_BADGE = {
    ativa: <Badge tone="success" dot>Ativa</Badge>,
    vencida: <Badge tone="danger" dot>Vencida</Badge>,
    transferida: <Badge tone="neutral" dot>Transferida</Badge>,
    encerrada: <Badge tone="neutral" dot>Encerrada</Badge>,
    cancelada: <Badge tone="danger" dot>Cancelada</Badge>,
  };

  async function onRenew() {
    try {
      await renew.mutate({ endDate: renewDate });
      setRenewModal(false);
      refetch();
    } catch { /* erro exibido no modal */ }
  }

  async function onTransfer() {
    try {
      await transfer.mutate({
        toPersonId: transferForm.to,
        transferReason: transferForm.reason,
        ...(transferForm.reason === "heranca" && transferForm.kinship
          ? { familyRelationship: transferForm.kinship }
          : {}),
      });
      setTransferModal(false);
      refetch();
    } catch { /* erro exibido no modal */ }
  }

  async function onTerminate() {
    try {
      await terminate.mutate();
      setEndModal(false);
      refetch();
    } catch { /* erro exibido no modal */ }
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Link href="/painel/concessoes" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Concessões
        </Link>
        <Skeleton variant="block" height={120} />
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className={styles.page}>
        <Link href="/painel/concessoes" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Concessões
        </Link>
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const { isTemporary, status, monthsLeft, progress, grave, trail, fee } = view;

  return (
    <div className={styles.page}>
      <Link href="/painel/concessoes" className={styles.back}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Concessões
      </Link>

      <header className={styles.head}>
        <div className={styles.headInfo}>
          <div className={styles.headTitleRow}>
            <h1 className={styles.title}>{view.contract}</h1>
            <Badge tone={isTemporary ? "navy" : "inverse"}>{isTemporary ? "Temporária" : "Perpétua"}</Badge>
            {STATUS_BADGE[status]}
          </div>
          <p className={styles.trail}>
            {view.owner} · Jazigo {grave.code} · {view.acquisition}
          </p>
        </div>
        <div className={styles.headActions}>
          {isTemporary && status === "ativa" && (
            <Button variant="secondary" onClick={() => { setRenewDate(isoPlusYears(view.endIso, 5)); setRenewModal(true); }}>Renovar</Button>
          )}
          <Button variant="danger" disabled={status !== "ativa"} onClick={() => setEndModal(true)}>Encerrar</Button>
          <Button disabled={status !== "ativa"} onClick={() => { setPersonSearch(""); setPersonResults([]); setTransferForm({ to: "", reason: "venda", kinship: "" }); setTransferModal(true); }}>Transferir</Button>
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          {/* vigência (PDF: tipo + vigência/validade) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Vigência</h2>
                <p className={styles.cardSub}>
                  {isTemporary ? `Concessão temporária · ${view.startBr} — ${view.endBr}` : "Concessão perpétua — sem vencimento"}
                </p>
              </div>
              {isTemporary && monthsLeft !== null && status === "ativa" && (
                <Badge tone={monthsLeft <= 12 ? "warning" : "navy"}>
                  {monthsLeft <= 0 ? "Vencida" : `${monthsLeft} meses restantes`}
                </Badge>
              )}
            </header>
            {isTemporary ? (
              <>
                <div className={styles.progressTrack}>
                  <div className={styles.progressFill} style={{ width: `${progress * 100}%` }} />
                </div>
                <div className={styles.progressLabels}>
                  <span>{view.startBr}</span>
                  <span>{view.endBr}</span>
                </div>
                {monthsLeft !== null && monthsLeft <= 12 && status === "ativa" && (
                  <Alert tone="warning">
                    O titular será notificado por WhatsApp sobre o vencimento. Renove para
                    manter os direitos sobre a unidade.
                  </Alert>
                )}
              </>
            ) : (
              <div className={styles.perpetualBox}>
                <svg viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.5" />
                  <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                </svg>
                Direito de uso permanente, transmissível por herança.
              </div>
            )}
          </article>

          {/* linha do tempo do contrato (histórico real: emissão + transferências) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Linha do tempo</h2>
            </header>
            <ul className={styles.timeline}>
              {view.events.map((event, index) => (
                <li key={index} className={styles.timelineItem}>
                  <span className={`${styles.timelineDot} ${styles[`tl_${event.type}`] || styles.tl_navy}`} />
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineText}>{event.text}</span>
                    <span className={styles.timelineDate}>{isoToBr(event.iso)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          {/* documentos oficiais emitidos pelo sistema (ex.: certidão de perpetuidade) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Documentos oficiais</h2>
            </header>
            {officialLoading ? (
              <Skeleton variant="row" count={2} />
            ) : officialError ? (
              <ErrorState onRetry={() => {}} />
            ) : officialDocs.length === 0 ? (
              <p className={styles.emptyNote}>
                A certidão de perpetuidade é gerada automaticamente ao emitir uma concessão perpétua e aparece aqui para download.
              </p>
            ) : (
              <ul className={styles.officialDocs}>
                {officialDocs.map((doc) => (
                  <li key={doc.id} className={styles.officialDocRow}>
                    <span className={styles.officialDocName}>
                      {DOC_TYPE_LABELS[doc.documentType] || doc.documentType}
                      {doc.number ? ` · ${doc.number}` : ""}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => downloadOfficial(doc)}>
                      Baixar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </article>

          {/* anexos manuais (contrato, etc.) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Anexos</h2>
              <Button variant="ghost" size="sm" onClick={() => setUploadModal(true)}>Adicionar</Button>
            </header>
            <AttachmentList
              files={attachments}
              loading={attachmentsLoading}
              error={attachmentsError}
              onRetry={refetchAttachments}
              emptyLabel="Anexe o contrato e demais documentos desta concessão."
              onDelete={async (file) => {
                await deleteAttachment(file.id);
                await refetchAttachments();
              }}
            />
          </article>
        </div>

        <div className={styles.sideCol}>
          {/* titular (responsável legal) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Titular</h2>
            </header>
            <div className={styles.ownerBox}>
              <Avatar name={view.owner} size="lg" />
              <div>
                <span className={styles.ownerName}>{view.owner}</span>
                <span className={styles.ownerDoc}>{view.cpf}</span>
              </div>
            </div>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}><dt>Telefone</dt><dd>{view.phone}</dd></div>
              <div className={styles.detailRow}><dt>E-mail</dt><dd className={styles.small}>{view.email}</dd></div>
              <div className={styles.detailRow}>
                <dt>Responsável legal</dt>
                <dd>{view.responsible || "— (mesmo que o titular)"}</dd>
              </div>
              <div className={styles.detailRow}><dt>Valor pago</dt><dd>{view.value}</dd></div>
            </dl>
          </article>

          {/* jazigo vinculado */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Jazigo vinculado</h2>
              {grave.status?.name && <Badge tone="navy" dot>{grave.status.name}</Badge>}
            </header>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}><dt>Unidade</dt><dd><code className={styles.code}>{grave.code}</code></dd></div>
              <div className={styles.detailRow}><dt>Tipo</dt><dd>{UNIT_TYPE_LABEL[grave.unitType] || grave.unitType || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Localização</dt><dd className={styles.small}>{trail || "—"}</dd></div>
            </dl>
            <Link href={`/painel/sepulturas/${grave.id}`}>
              <Button variant="secondary" size="sm" full>Abrir jazigo</Button>
            </Link>
          </article>

          {/* taxa vinculada ao proprietário (PDF 3.10) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Taxa vinculada</h2>
              {fee && (
                <Badge tone={FEE_STATUS_META[fee.status]?.tone || "neutral"}>
                  {FEE_STATUS_META[fee.status]?.label || fee.status}
                </Badge>
              )}
            </header>
            {fee ? (
              <>
                <dl className={styles.detailList}>
                  <div className={styles.detailRow}><dt>Taxa</dt><dd className={styles.small}>{fee.feeType?.name || "Taxa de manutenção"}</dd></div>
                  <div className={styles.detailRow}><dt>Valor</dt><dd>{formatBRL(fee.amount)}</dd></div>
                  <div className={styles.detailRow}><dt>Próx. vencimento</dt><dd>{isoToBr(fee.nextDueDate) || "—"}</dd></div>
                </dl>
                <Link href="/painel/cobrancas">
                  <Button variant="ghost" size="sm" full>Ver cobranças do titular</Button>
                </Link>
              </>
            ) : (
              <p className={styles.cardSub}>Nenhuma taxa de manutenção vinculada a este contrato.</p>
            )}
          </article>
        </div>
      </div>

      {/* ---- transferir ---- */}
      <Modal
        open={transferModal}
        onClose={() => setTransferModal(false)}
        title="Transferir concessão"
        subtitle={`Titular atual: ${view.owner}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setTransferModal(false)}>Cancelar</Button>
            <Button loading={transfer.loading} disabled={!transferForm.to} onClick={onTransfer}>Confirmar transferência</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <FormField label="Buscar novo titular" hint="Busque por nome ou CPF" required>
            <Input
              value={personSearch}
              onChange={(e) => { setPersonSearch(e.target.value); setTransferForm((f) => ({ ...f, to: "" })); }}
              placeholder="Nome ou CPF…"
            />
          </FormField>
          {personResults.length > 0 && (
            <FormField label="Selecione a pessoa" required>
              <Select value={transferForm.to} onChange={(e) => setTransferForm({ ...transferForm, to: e.target.value })}>
                <option value="" disabled>Selecione…</option>
                {personResults.map((p) => (
                  <option key={p.id} value={p.id}>{p.fullName}{p.cpf ? ` · ${p.cpf}` : ""}</option>
                ))}
              </Select>
            </FormField>
          )}
          <FormField label="Motivo" required>
            <Select value={transferForm.reason} onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}>
              {Object.entries(TRANSFER_REASONS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </Select>
          </FormField>
          {transferForm.reason === "heranca" && (
            <FormField label="Vínculo familiar" required>
              <Input value={transferForm.kinship} onChange={(e) => setTransferForm({ ...transferForm, kinship: e.target.value })} placeholder="Ex.: filho, cônjuge…" />
            </FormField>
          )}
          {transfer.error && <Alert tone="danger">{transfer.error.message}</Alert>}
          <Alert tone="info">
            Este contrato será encerrado como “Transferida” e um novo contrato será
            emitido para o novo titular — preservando o histórico de proprietários.
          </Alert>
        </div>
      </Modal>

      {/* ---- renovar ---- */}
      <Modal
        open={renewModal}
        onClose={() => setRenewModal(false)}
        title="Renovar concessão"
        subtitle={`${view.contract} · vigência atual até ${view.endBr}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenewModal(false)}>Cancelar</Button>
            <Button loading={renew.loading} onClick={onRenew}>Confirmar renovação</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <FormField label="Nova data de vencimento" required>
            <Input type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
          </FormField>
          {renew.error && <Alert tone="danger">{renew.error.message}</Alert>}
          <Alert tone="info">
            A renovação é registrada na linha do tempo e o titular recebe a
            confirmação por WhatsApp.
          </Alert>
        </div>
      </Modal>

      {/* ---- encerrar ---- */}
      <Modal
        open={endModal}
        onClose={() => setEndModal(false)}
        title="Encerrar concessão"
        subtitle={view.contract}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEndModal(false)}>Cancelar</Button>
            <Button variant="danger" loading={terminate.loading} onClick={onTerminate}>Confirmar encerramento</Button>
          </>
        }
      >
        <div className={styles.modalForm}>
          <Alert tone="warning" title="Ação com efeitos operacionais">
            O jazigo ficará sem concessão ativa — novos sepultamentos exigirão a
            emissão de uma nova concessão.
          </Alert>
          <FormField label="Motivo do encerramento">
            <Textarea rows={3} value={endReason} onChange={(e) => setEndReason(e.target.value)} placeholder="Ex.: solicitação do titular, abandono da unidade…" />
          </FormField>
          {terminate.error && <Alert tone="danger">{terminate.error.message}</Alert>}
        </div>
      </Modal>

      <AttachmentUploadModal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title={`Documentos · ${view.contract}`}
        onUpload={async (files) => {
          for (const f of files) {
            await uploadAttachment({ type: "concession", id, file: f.file, category: f.category, fileName: f.name });
          }
          await refetchAttachments();
        }}
      />
    </div>
  );
}
