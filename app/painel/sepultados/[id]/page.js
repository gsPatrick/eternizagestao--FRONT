"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Badge from "@/components/atoms/Badge/Badge";
import Avatar from "@/components/atoms/Avatar/Avatar";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import AttachmentList from "@/components/molecules/AttachmentList/AttachmentList";
import AttachmentUploadModal from "@/components/molecules/AttachmentUploadModal/AttachmentUploadModal";
import FileViewer from "@/components/organisms/FileViewer/FileViewer";
import GraveMap from "@/components/organisms/GraveMap/GraveMap";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import { maskCpf } from "@/lib/masks";
import { useResource, useMutation } from "@/lib/api/useResource";
import { getDeceased, updateDeceased, uploadDeceasedPhoto, deleteDeceased, getDeceasedDeleteImpact } from "@/lib/api/resources/deceased";
import { getUser } from "@/lib/api/session";
import { listCartorios } from "@/lib/api/resources/cartorios";
import { listFunerarias } from "@/lib/api/resources/funerarias";
import ConfirmDelete from "@/components/molecules/ConfirmDelete/ConfirmDelete";
import { listDocuments, fileHref, fetchDocumentPdf, reissueDocument } from "@/lib/api/resources/documents";

// Ícone de documento reutilizado nos botões de download (padrão do sistema).
function DocIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" width="14" height="14" aria-hidden="true" style={{ flexShrink: 0 }}>
      <path d="M4 1.5h5L13 5.5V14a.5.5 0 0 1-.5.5h-8A.5.5 0 0 1 4 14V1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9 1.5V5h4M6.5 8.5h3M6.5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

const DOC_TYPE_LABEL = {
  autorizacao_sepultamento: "Autorização de Sepultamento",
  certidao_perpetuidade: "Certidão de Perpetuidade",
  autorizacao_exumacao: "Autorização de Exumação",
};
import {
  listAttachments,
  uploadAttachment,
  deleteAttachment,
  toAttachmentView,
} from "@/lib/api/resources/attachments";

const LOCATION_META = {
  sepultado: { label: "Sepultado", tone: "navy" },
  ossario: { label: "No ossário", tone: "warning" },
  transladado: { label: "Transladado", tone: "neutral" },
  cremado: { label: "Cremado", tone: "inverse" },
};
const locationMeta = (key) => LOCATION_META[key] || { label: "Desconhecido", tone: "neutral" };

const GENDER_TO_CODE = { Feminino: "f", Masculino: "m", Outro: "o" };
const CODE_TO_GENDER = { f: "Feminino", m: "Masculino", o: "Outro" };

const DEST_LABEL = {
  ossario: "ossário", outro_jazigo: "outro jazigo", cremacao: "cremação",
  translado_externo: "translado externo", outro: "outro destino",
};

function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : "—";
}
function fmtTime(t) {
  return t ? String(t).slice(0, 5) : null;
}
function age(birthIso, deathIso) {
  if (!birthIso || !deathIso) return null;
  const by = Number(String(birthIso).slice(0, 4));
  const dy = Number(String(deathIso).slice(0, 4));
  if (!by || !dy) return null;
  return `${dy - by} anos`;
}
function graveTrail(g) {
  const block = g?.lot?.street?.block;
  const street = g?.lot?.street;
  const lot = g?.lot;
  const parts = [];
  if (block) parts.push(`Quadra ${block.name || block.code}`);
  if (street) parts.push(`Rua ${street.name || street.code}`);
  if (lot) parts.push(`Lote ${lot.name || lot.code}`);
  return parts.join(" › ");
}

// burials + exhumations + remainsDeposits + registro → timeline (recente primeiro)
function buildMovements(d) {
  const events = [];
  (d.burials || []).forEach((b) => {
    events.push({
      ts: b.burialDate,
      tone: "navy",
      date: fmtDate(b.burialDate),
      text: `Sepultamento${b.grave?.code ? ` no jazigo ${b.grave.code}` : ""}${b.authorizationNumber ? ` — autorização nº ${b.authorizationNumber}` : ""}`,
    });
  });
  (d.exhumations || []).forEach((e) => {
    const when = e.performedAt || e.scheduledDate || e.requestDate;
    events.push({
      ts: when,
      tone: "warning",
      date: fmtDate(when),
      text: `Exumação${e.processNumber ? ` nº ${e.processNumber}` : ""}${e.destinationType ? ` — destino: ${DEST_LABEL[e.destinationType] || e.destinationType}` : ""}`,
    });
  });
  (d.remainsDeposits || []).forEach((r) => {
    events.push({
      ts: r.depositedAt,
      tone: "warning",
      date: fmtDate(r.depositedAt),
      text: `Restos depositados${r.niche?.ossuary?.name ? ` no ${r.niche.ossuary.name}` : " no ossário"}${r.niche?.code ? ` · nicho ${r.niche.code}` : ""}`,
    });
  });
  events.push({ ts: d.createdAt, tone: "neutral", date: fmtDate(d.createdAt), text: "Registro do sepultado criado" });
  return events
    .filter((e) => e.ts)
    .sort((a, b) => new Date(b.ts) - new Date(a.ts));
}

const EMPTY_EDIT = {
  fullName: "", cpf: "", rg: "", gender: "", birthplace: "", motherName: "",
  fatherName: "", birthDate: "", deathDate: "", causeOfDeath: "",
  deathCertificateNumber: "", deathCertificateRegistry: "", registryNumber: "", funeralHome: "",
};

export default function DeceasedDetailPage() {
  const { id } = useParams();

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => getDeceased(id, { signal }),
    [id]
  );

  const [editModal, setEditModal] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);
  const [preview, setPreview] = useState(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT);
  const [editError, setEditError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const photoInputRef = useRef(null);

  // anexos reais do sepultado (attachableType = deceased) — fetch/loading/erro
  // documentos oficiais deste sepultado (autorização de sepultamento etc.)
  // Cartórios e funerárias cadastrados (Básico) → listas da edição.
  const { data: cartoriosData } = useResource(
    ({ signal }) => listCartorios({ perPage: 300 }, { signal }),
    []
  );
  const cartorios = cartoriosData?.data ?? [];
  const { data: funerariasData } = useResource(
    ({ signal }) => listFunerarias({ perPage: 300 }, { signal }),
    []
  );
  const funerarias = funerariasData?.data ?? [];

  const { data: docsData, refetch: refetchDocs } = useResource(
    ({ signal }) => listDocuments({ deceasedId: id, perPage: 50 }, { signal }),
    [id]
  );
  const officialDocs = useMemo(() => docsData?.data ?? [], [docsData]);

  async function downloadDoc(doc) {
    // pdfUrl assinado quando existir; senão gera/baixa via endpoint autenticado.
    if (doc.pdfUrl) {
      window.open(fileHref(doc.pdfUrl), "_blank", "noopener");
      return;
    }
    try {
      const url = await fetchDocumentPdf(doc.id);
      window.open(url, "_blank", "noopener");
    } catch (_) {
      /* silencioso — o botão pode ser tentado de novo */
    }
  }

  const {
    data: attachmentsData,
    loading: attachmentsLoading,
    error: attachmentsError,
    refetch: refetchAttachments,
  } = useResource(({ signal }) => listAttachments({ type: "deceased", id, signal }), [id]);
  const attachments = useMemo(
    () => (attachmentsData || []).map(toAttachmentView),
    [attachmentsData]
  );

  // upload/troca da FOTO do sepultado (endpoint dedicado → photoUrl assinado)
  const { mutate: submitPhoto, loading: photoSaving } = useMutation((file) => uploadDeceasedPhoto(id, file));
  async function handlePhotoPick(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    try {
      await submitPhoto(file);
      refetch();
    } catch (err) {
      setPhotoError(err.message || "Não foi possível enviar a foto.");
    }
  }

  function openEdit() {
    setEditError("");
    setEditForm({
      fullName: data.fullName || "",
      cpf: data.cpf ? maskCpf(data.cpf) : "",
      rg: data.rg || "",
      gender: GENDER_TO_CODE[data.gender] || "",
      birthplace: data.birthplace || "",
      motherName: data.motherName || "",
      fatherName: data.fatherName || "",
      birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : "",
      deathDate: data.deathDate ? String(data.deathDate).slice(0, 10) : "",
      causeOfDeath: data.causeOfDeath || "",
      deathCertificateNumber: data.deathCertificateNumber || "",
      deathCertificateRegistry: data.deathCertificateRegistry || "",
      registryNumber: data.registryNumber || "",
      funeralHome: data.funeralHome || "",
    });
    setEditModal(true);
  }

  const { mutate: submitUpdate, loading: saving } = useMutation((body) => updateDeceased(id, body));

  // ---- 2ª via de documento oficial ----
  // Veio da tela de Sepultamentos (removida): a reemissão da autorização agora
  // vive junto do sepultado, que é onde o operador procura o documento.
  const [reissuing, setReissuing] = useState(null); // id do documento
  const [docError, setDocError] = useState("");

  async function reissueDoc(doc) {
    setDocError("");
    setReissuing(doc.id);
    try {
      await reissueDocument(doc.id);
      refetchDocs();
    } catch (e) {
      setDocError(e?.message || "Não foi possível emitir a 2ª via.");
    } finally {
      setReissuing(null);
    }
  }

  // ---- exclusão do sepultado (RBAC + confirmação) ----
  const router = useRouter();
  const currentUser = getUser();
  const canDelete = ["admin", "super_admin"].includes(currentUser?.role);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteImpact, setDeleteImpact] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Abre a confirmação já sabendo o que a exclusão arrasta junto.
  async function askDelete() {
    setDeleteError("");
    setDeleteImpact(null);
    setConfirmDelete(true);
    try {
      setDeleteImpact(await getDeceasedDeleteImpact(id));
    } catch (_) {
      /* sem o impacto o modal segue no modo simples */
    }
  }

  async function doDelete(force = false) {
    setDeleteError("");
    setDeleting(true);
    try {
      await deleteDeceased(id, { force });
      router.push("/painel/sepultados");
    } catch (e) {
      setDeleteError(e?.message || "Não foi possível excluir o sepultado.");
    } finally {
      setDeleting(false);
    }
  }

  async function handleSave() {
    setEditError("");
    if (!editForm.fullName.trim()) { setEditError("Informe o nome completo."); return; }
    try {
      await submitUpdate({
        fullName: editForm.fullName.trim(),
        cpf: editForm.cpf || null,
        rg: editForm.rg || null,
        gender: CODE_TO_GENDER[editForm.gender] || null,
        birthplace: editForm.birthplace || null,
        motherName: editForm.motherName || null,
        fatherName: editForm.fatherName || null,
        birthDate: editForm.birthDate || null,
        deathDate: editForm.deathDate || null,
        causeOfDeath: editForm.causeOfDeath || null,
        deathCertificateNumber: editForm.deathCertificateNumber || null,
        deathCertificateRegistry: editForm.deathCertificateRegistry || null,
        registryNumber: editForm.registryNumber || null,
        funeralHome: editForm.funeralHome || null,
      });
      setEditModal(false);
      refetch();
    } catch (e) {
      setEditError(e.message || "Não foi possível salvar as alterações.");
    }
  }

  function setField(field) {
    return (e) => setEditForm((f) => ({ ...f, [field]: e.target.value }));
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <Link href="/painel/sepultados" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sepultados
        </Link>
        <Skeleton variant="block" height={96} />
        <div style={{ height: 16 }} />
        <Skeleton variant="card" count={3} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <Link href="/painel/sepultados" className={styles.back}>
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Sepultados
        </Link>
        <ErrorState
          title="Não foi possível carregar o sepultado"
          onRetry={refetch}
        />
      </div>
    );
  }

  const person = data;
  const g = person.currentGrave;
  const grave = g
    ? {
        id: g.id,
        code: g.parentGrave?.code || g.code,
        drawer: g.parentGrave ? g.code : g.unitType === "gaveta" ? g.code : null,
        trail: graveTrail(g),
        cemeteryId: g.cemeteryId || g.parentGrave?.cemeteryId || null,
        statusSlug: g.status?.slug || null,
        geoPolygon: g.geoPolygon || g.parentGrave?.geoPolygon || null,
        latitude: g.latitude ?? g.parentGrave?.latitude ?? null,
        longitude: g.longitude ?? g.parentGrave?.longitude ?? null,
      }
    : null;

  const birth = fmtDate(person.birthDate);
  const death = fmtDate(person.deathDate);
  const deathTime = fmtTime(person.deathTime);
  const lastBurial = fmtDate(person.burials?.[0]?.burialDate);
  const responsibleName = person.responsible?.name || "—";
  const personAge = age(person.birthDate, person.deathDate);
  const movements = buildMovements(person);
  const situ = locationMeta(person.currentLocationType);

  return (
    <div className={styles.page}>
      <Link href="/painel/sepultados" className={styles.back}>
        <svg viewBox="0 0 16 16" fill="none">
          <path d="M10 3.5L5.5 8 10 12.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sepultados
      </Link>

      <header className={styles.head}>
        <div className={styles.headInfo}>
          <div className={styles.headTitleRow}>
            <h1 className={styles.title}>{person.fullName}</h1>
            <Badge tone={situ.tone} dot>{situ.label}</Badge>
          </div>
          <p className={styles.trail}>
            ✦ {birth} — ✝ {death}{personAge ? ` · ${personAge}` : ""} · Responsável: {responsibleName}
          </p>
        </div>
        <div className={styles.headActions}>
          <Button variant="secondary" onClick={openEdit}>Editar cadastro</Button>
          {canDelete && (
            <Button variant="ghost" onClick={askDelete}>
              Excluir
            </Button>
          )}
          {grave && (
            <Link href={`/painel/sepulturas/${grave.id}`}>
              <Button>Ver sepultura</Button>
            </Link>
          )}
        </div>
      </header>

      <div className={styles.grid}>
        <div className={styles.mainCol}>
          {/* localização exata (PDF 3.3) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Localização exata</h2>
                <p className={styles.cardSub}>{grave ? grave.trail : situ.label}</p>
              </div>
              {grave && (
                <code className={styles.code}>
                  {grave.code}{grave.drawer ? ` · ${grave.drawer}` : ""}
                </code>
              )}
            </header>
            <GraveMap
              cemeteryId={grave?.cemeteryId}
              grave={
                grave
                  ? {
                      id: grave.id,
                      code: grave.code,
                      status: grave.statusSlug,
                      geoPolygon: grave.geoPolygon,
                      latitude: grave.latitude,
                      longitude: grave.longitude,
                    }
                  : null
              }
              height={240}
            />
            <div className={styles.locationFoot}>
              <span>
                Sepultado em <strong>{lastBurial}</strong>
                {grave?.drawer ? <> · gaveta <strong>{grave.drawer}</strong></> : null}
              </span>
              {grave && (
                <Link href={`/painel/sepulturas/${grave.id}`} className={styles.cardLink}>
                  Abrir jazigo
                </Link>
              )}
            </div>
          </article>

          {/* rastreabilidade completa (PDF 3.2/3.3) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <div>
                <h2 className={styles.cardTitle}>Histórico de movimentações</h2>
                <p className={styles.cardSub}>Rastreabilidade completa — de onde veio, onde está</p>
              </div>
            </header>
            <ul className={styles.timeline}>
              {movements.map((event, index) => (
                <li key={index} className={styles.timelineItem}>
                  <span className={`${styles.timelineDot} ${styles[`tl_${event.tone}`]}`} />
                  <div className={styles.timelineBody}>
                    <span className={styles.timelineText}>{event.text}</span>
                    <span className={styles.timelineDate}>{event.date}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          {/* anexos (foto + documentos digitalizados) */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Fotos e documentos</h2>
              <Button variant="ghost" size="sm" onClick={() => setUploadModal(true)}>Adicionar anexo</Button>
            </header>
            <AttachmentList
              files={attachments}
              loading={attachmentsLoading}
              error={attachmentsError}
              onRetry={refetchAttachments}
              emptyLabel="Anexe fotos e documentos digitalizados deste sepultado."
              onDelete={async (file) => {
                await deleteAttachment(file.id);
                await refetchAttachments();
              }}
            />
          </article>
        </div>

        <div className={styles.sideCol}>
          {/* foto do sepultado */}
          <article className={`${styles.card} ${styles.photoCard}`}>
            {person.photoUrl ? (
              <button
                className={styles.photoFrame}
                onClick={() => setPreview({ name: "foto-sepultado", category: "Foto do sepultado", url: person.photoUrl })}
                title="Ampliar foto"
              >
                <img src={person.photoUrl} alt={`Foto de ${person.fullName}`} className={styles.photo} />
              </button>
            ) : (
              <div className={styles.photoFrame}>
                <Avatar name={person.fullName} size="lg" />
              </div>
            )}
            <span className={styles.photoCaption}>
              {person.photoUrl ? "Foto do sepultado · clique para ampliar" : "Sem foto cadastrada"}
            </span>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handlePhotoPick}
            />
            <Button
              variant="secondary"
              size="sm"
              full
              loading={photoSaving}
              onClick={() => photoInputRef.current?.click()}
            >
              {person.photoUrl ? "Trocar foto" : "Enviar foto"}
            </Button>
            {photoError && <Alert tone="danger">{photoError}</Alert>}
          </article>

          {/* dados civis */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Dados civis</h2>
            </header>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}><dt>CPF</dt><dd>{person.cpf ? maskCpf(person.cpf) : "—"}</dd></div>
              <div className={styles.detailRow}><dt>RG</dt><dd>{person.rg || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Sexo</dt><dd>{person.gender || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Nascimento</dt><dd>{birth}</dd></div>
              <div className={styles.detailRow}><dt>Naturalidade</dt><dd>{person.birthplace || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Mãe</dt><dd>{person.motherName || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Pai</dt><dd>{person.fatherName || "—"}</dd></div>
            </dl>
          </article>

          {/* óbito e certidão */}
          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Documentos oficiais</h2>
            </header>
            {officialDocs.length ? (
              <ul className={styles.docList}>
                {officialDocs.map((doc) => (
                  <li key={doc.id} className={styles.docRow}>
                    <span className={styles.docInfo}>
                      <DocIcon />
                      <span>
                        <strong>{DOC_TYPE_LABEL[doc.documentType] || doc.documentType}</strong>
                        <span className={styles.docMeta}>
                          {doc.formattedNumber ? `nº ${doc.formattedNumber}` : ""}
                        </span>
                      </span>
                    </span>
                    <span style={{ display: "inline-flex", gap: 4 }}>
                      <button type="button" className={styles.docLink} onClick={() => downloadDoc(doc)}>
                        <DocIcon /> Baixar
                      </button>
                      <button
                        type="button"
                        className={styles.docLink}
                        disabled={reissuing === doc.id}
                        onClick={() => reissueDoc(doc)}
                      >
                        {reissuing === doc.id ? "Emitindo…" : "2ª via"}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.small} style={{ color: "var(--color-slate)" }}>
                A autorização de sepultamento é gerada automaticamente ao cadastrar o
                sepultado e aparece aqui para download.
              </p>
            )}
            {docError && <Alert tone="danger">{docError}</Alert>}
          </article>

          <article className={styles.card}>
            <header className={styles.cardHead}>
              <h2 className={styles.cardTitle}>Óbito</h2>
            </header>
            <dl className={styles.detailList}>
              <div className={styles.detailRow}><dt>Falecimento</dt><dd>{death}{deathTime ? ` · ${deathTime}` : ""}</dd></div>
              <div className={styles.detailRow}><dt>Causa</dt><dd>{person.causeOfDeath || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Médico</dt><dd>{person.attendingPhysician || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Certidão</dt><dd>{person.deathCertificateNumber || "—"}</dd></div>
              <div className={styles.detailRow}><dt>Cartório</dt><dd className={styles.small}>{person.deathCertificateRegistry || "—"}</dd></div>
              <div className={styles.detailRow}>
                <dt>Declaração de óbito</dt>
                <dd>
                  {person.deathCertificateFileUrl ? (
                    <a href={fileHref(person.deathCertificateFileUrl)} target="_blank" rel="noreferrer" className={styles.docLink}>
                      <DocIcon /> Baixar PDF
                    </a>
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            </dl>
          </article>
        </div>
      </div>

      {/* ---- editar cadastro ---- */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="Editar cadastro"
        subtitle={person.fullName}
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditModal(false)}>Cancelar</Button>
            <Button loading={saving} onClick={handleSave}>Salvar alterações</Button>
          </>
        }
      >
        <form className={styles.form} onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
          <div className={styles.formGrid}>
            <FormField label="Nome completo" required className={styles.spanTwo}>
              <Input value={editForm.fullName} onChange={setField("fullName")} />
            </FormField>
            <FormField label="CPF">
              <Input value={editForm.cpf} onChange={(e) => setEditForm((f) => ({ ...f, cpf: maskCpf(e.target.value) }))} inputMode="numeric" />
            </FormField>
            <FormField label="RG">
              <Input value={editForm.rg} onChange={setField("rg")} />
            </FormField>
            <FormField label="Sexo">
              <Select value={editForm.gender} onChange={setField("gender")}>
                <option value="">Não informado</option>
                <option value="f">Feminino</option>
                <option value="m">Masculino</option>
                <option value="o">Outro</option>
              </Select>
            </FormField>
            <FormField label="Naturalidade">
              <Input value={editForm.birthplace} onChange={setField("birthplace")} />
            </FormField>
            <FormField label="Nome da mãe">
              <Input value={editForm.motherName} onChange={setField("motherName")} />
            </FormField>
            <FormField label="Nome do pai">
              <Input value={editForm.fatherName} onChange={setField("fatherName")} />
            </FormField>
            <FormField label="Data de nascimento">
              <Input type="date" value={editForm.birthDate} onChange={setField("birthDate")} />
            </FormField>
            <FormField label="Data do falecimento">
              <Input type="date" value={editForm.deathDate} onChange={setField("deathDate")} />
            </FormField>
            <FormField label="Causa do óbito">
              <Input value={editForm.causeOfDeath} onChange={setField("causeOfDeath")} />
            </FormField>
            <FormField label="Nº da certidão">
              <Input value={editForm.deathCertificateNumber} onChange={setField("deathCertificateNumber")} />
            </FormField>
            <FormField label="Cartório" hint="Cadastrados em Básico › Cartórios">
              <Select value={editForm.deathCertificateRegistry} onChange={setField("deathCertificateRegistry")}>
                <option value="">Selecione uma opção</option>
                {cartorios.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                {/* preserva valor legado fora da lista */}
                {editForm.deathCertificateRegistry
                  && !cartorios.some((c) => c.name === editForm.deathCertificateRegistry) && (
                  <option value={editForm.deathCertificateRegistry}>{editForm.deathCertificateRegistry}</option>
                )}
              </Select>
            </FormField>
            <FormField label="Registro" hint="Nº do registro no cartório">
              <Input value={editForm.registryNumber} onChange={setField("registryNumber")} />
            </FormField>
            <FormField label="Funerária" hint="Cadastradas em Básico › Funerárias">
              <Select value={editForm.funeralHome} onChange={setField("funeralHome")}>
                <option value="">Selecione uma opção</option>
                {funerarias.map((f) => (<option key={f.id} value={f.name}>{f.name}</option>))}
                {editForm.funeralHome
                  && !funerarias.some((f) => f.name === editForm.funeralHome) && (
                  <option value={editForm.funeralHome}>{editForm.funeralHome}</option>
                )}
              </Select>
            </FormField>
          </div>
          {editError && <Alert tone="danger">{editError}</Alert>}
          <Alert tone="info">
            A alteração fica registrada na auditoria. A localização é alterada apenas
            pelos fluxos de sepultamento e exumação — garantindo a rastreabilidade.
          </Alert>
        </form>
      </Modal>

      <AttachmentUploadModal
        open={uploadModal}
        onClose={() => setUploadModal(false)}
        title={`Anexos de ${person.fullName}`}
        onUpload={async (files) => {
          for (const f of files) {
            await uploadAttachment({ type: "deceased", id, file: f.file, category: f.category, fileName: f.name });
          }
          await refetchAttachments();
        }}
      />

      <FileViewer open={Boolean(preview)} file={preview} onClose={() => setPreview(null)} />

      <ConfirmDelete
        open={confirmDelete}
        onClose={() => { setConfirmDelete(false); setDeleteImpact(null); }}
        onConfirm={doDelete}
        loading={deleting}
        title="Excluir sepultado"
        name={person?.name}
        impact={deleteImpact}
        error={deleteError}
        description="O sepultado sai das listagens. O registro fica arquivado no histórico."
      />
    </div>
  );
}
