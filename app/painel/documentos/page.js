"use client";

import { useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import Select from "@/components/atoms/Select/Select";
import Textarea from "@/components/atoms/Textarea/Textarea";
import Badge from "@/components/atoms/Badge/Badge";
import Switch from "@/components/atoms/Switch/Switch";
import FormField from "@/components/molecules/FormField/FormField";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import Tabs from "@/components/molecules/Tabs/Tabs";
import StatCard from "@/components/molecules/StatCard/StatCard";
import DataTable from "@/components/organisms/DataTable/DataTable";
import ExportModal from "@/components/molecules/ExportModal/ExportModal";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import FileViewer from "@/components/organisms/FileViewer/FileViewer";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listDocuments, issueDocument, reissueDocument, cancelDocument,
  listTemplates, createTemplate, updateTemplate,
  listSignatures, createSignature, simulateSignature,
  adaptDocument, adaptTemplate, adaptSignature, fetchDocumentPdf,
  getDocumentSettings, updateDocumentSettings,
} from "@/lib/api/resources/documents";

const YEAR = 2026;

const DOC_TYPES = {
  certidao_perpetuidade: { label: "Certidão de Perpetuidade", short: "CP", tone: "navy" },
  autorizacao_sepultamento: { label: "Autorização de Sepultamento", short: "AS", tone: "info" },
  autorizacao_exumacao: { label: "Autorização de Exumação", short: "AE", tone: "warning" },
  recibo: { label: "Recibo", short: "RC", tone: "success" },
  declaracao: { label: "Declaração", short: "DC", tone: "neutral" },
  outro: { label: "Documento", short: "DOC", tone: "neutral" },
};

const DOC_STATUS = {
  emitido: { label: "Emitido", tone: "navy" },
  aguardando_assinatura: { label: "Aguardando assinatura", tone: "warning" },
  assinado: { label: "Assinado", tone: "success" },
  cancelado: { label: "Cancelado", tone: "neutral" },
};

// Tipos oferecidos na emissão quando ainda não há modelos cadastrados (o "outro"
// genérico fica fora da seleção manual).
const EMIT_TYPES = Object.entries(DOC_TYPES).filter(([key]) => key !== "outro");

const VARIABLES_HELP = [
  "{{cemiterio_nome}}", "{{jazigo_codigo}}", "{{jazigo_localizacao}}", "{{concessionario_nome}}",
  "{{concessionario_cpf}}", "{{sepultado_nome}}", "{{data_falecimento}}", "{{data_sepultamento}}",
  "{{contrato_numero}}", "{{valor}}", "{{data_emissao}}", "{{orgao_nome}}",
];

const FILTERS = [
  { key: "todos", label: "Todos" },
  { key: "emitido", label: "Emitidos" },
  { key: "aguardando_assinatura", label: "Aguardando assinatura" },
  { key: "assinado", label: "Assinados" },
  { key: "cancelado", label: "Cancelados" },
];

function safeType(type) {
  return DOC_TYPES[type] || DOC_TYPES.outro;
}

// A URL do arquivo emitido vem absoluta na origem da API (:3333/files/...), que
// responde com X-Frame-Options SAMEORIGIN e por isso não pode ser embutida no
// iframe do FileViewer (cross-origin). O rewrite do next.config proxia /files/*,
// então reduzimos a URL ao caminho relativo /files/... para carregar SAME-ORIGIN.
// URLs data: (mocks) e externas passam intactas.
function sameOriginFile(url) {
  if (!url || url.startsWith("data:")) return url;
  const i = url.indexOf("/files/");
  return i >= 0 ? url.slice(i) : url;
}

// Monta o objeto consumido pelo FileViewer a partir do documento adaptado.
// Prefere o PDF oficial (pdfUrl); cai no HTML quando o PDF ainda não existe.
function docFile(d) {
  const src = d?.pdfUrl || d?.url;
  if (!src) return null;
  const url = sameOriginFile(src);
  const ext = url.startsWith("data:")
    ? "pdf"
    : (url.split("?")[0].split("#")[0].split(".").pop() || "html").toLowerCase();
  return {
    name: `${docLabel(d).replace(/[\s/]+/g, "-")}.${ext}`,
    category: safeType(d.type).label,
    url,
  };
}

// Número formatado com o prefixo do tipo (ex.: "CP 0007/2026"), a partir do
// formattedNumber ("0007/2026") que a API já devolve com o ano correto.
function docLabel(d) {
  return `${safeType(d.type).short} ${d.formattedNumber}`;
}

// Rótulo do documento original de uma 2ª via, quando a associação está disponível.
function originalLabel(d) {
  if (d.originalType != null && d.originalNumber != null) {
    return `${safeType(d.originalType).short} ${String(d.originalNumber).padStart(4, "0")}/${YEAR}`;
  }
  return null;
}

export default function DocumentsPage() {
  // Feature flag: assinatura eletrônica temporariamente desabilitada a pedido do
  // cliente (fluxo ainda em definição). Toda a UI de assinatura fica guardada por
  // este flag. Para REATIVAR a assinatura no futuro, basta trocar para `true` —
  // o backend e as chamadas de API continuam intactos.
  const SIGNATURE_ENABLED = false;

  const [filter, setFilter] = useState("todos");
  const [query, setQuery] = useState("");
  const [detailId, setDetailId] = useState(null);

  const [issueOpen, setIssueOpen] = useState(false);
  const [issueType, setIssueType] = useState("certidao_perpetuidade");
  const [issueTemplateId, setIssueTemplateId] = useState(null);
  const [issueForm, setIssueForm] = useState({ graveCode: "", personName: "", obs: "" });

  const [signTarget, setSignTarget] = useState(null);
  const [signer, setSigner] = useState({ name: "Dra. Regina Fontes", role: "Diretora do órgão gestor", email: "regina@prefeitura.gov.br" });

  const [tplEditing, setTplEditing] = useState(null);
  const [tplOpen, setTplOpen] = useState(false);

  const [exportOpen, setExportOpen] = useState(false);
  const [legalOpen, setLegalOpen] = useState(false);
  const [legalForm, setLegalForm] = useState({ legalCertidao: "", legalAutorizacao: "" });
  const [cancelTarget, setCancelTarget] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [preview, setPreview] = useState(null); // arquivo aberto no FileViewer (modal)

  // ---- dados ----
  const docsRes = useResource(({ signal }) => listDocuments({ perPage: 200, year: YEAR }, { signal }), []);
  const tplRes = useResource(({ signal }) => listTemplates({ perPage: 200 }, { signal }), []);
  // Texto legal por cidade (injetado nos modelos oficiais como {{texto_legal}}).
  const legalRes = useResource(({ signal }) => getDocumentSettings({ signal }), []);
  const sigRes = useResource(
    ({ signal }) => (SIGNATURE_ENABLED && detailId ? listSignatures(detailId, { signal }) : Promise.resolve([])),
    [detailId]
  );

  const docs = useMemo(() => (docsRes.data?.data ?? []).map(adaptDocument), [docsRes.data]);

  const usesByType = useMemo(() => {
    const acc = {};
    for (const d of docs) acc[d.type] = (acc[d.type] || 0) + 1;
    return acc;
  }, [docs]);

  const templates = useMemo(
    () => (tplRes.data?.data ?? []).map(adaptTemplate).map((t) => ({ ...t, uses: usesByType[t.type] || 0 })),
    [tplRes.data, usesByType]
  );
  const activeTemplates = useMemo(() => templates.filter((t) => t.active), [templates]);

  const detail = docs.find((d) => d.id === detailId) || null;

  // Assinatura corrente do detalhe — buscada por documento (fonte confiável,
  // independente dos includes da listagem): a assinada, senão a mais recente.
  const detailSignature = useMemo(() => {
    const sigs = sigRes.data || [];
    if (!sigs.length) return null;
    const chosen = sigs.find((s) => s.status === "assinado") || sigs[sigs.length - 1];
    return adaptSignature(chosen);
  }, [sigRes.data]);

  // ---- mutations ----
  const issueM = useMutation(issueDocument);
  const reissueM = useMutation(reissueDocument);
  const cancelM = useMutation(cancelDocument);
  const signM = useMutation(createSignature);
  const simulateM = useMutation(simulateSignature);
  const tplM = useMutation((tpl) => {
    const payload = { name: tpl.name, bodyHtml: tpl.content, active: tpl.active };
    return tpl.id ? updateTemplate(tpl.id, payload) : createTemplate({ documentType: tpl.type, ...payload });
  });
  const legalM = useMutation(updateDocumentSettings);

  const counts = useMemo(() => ({
    todos: docs.length,
    emitido: docs.filter((d) => d.status === "emitido").length,
    aguardando_assinatura: docs.filter((d) => d.status === "aguardando_assinatura").length,
    assinado: docs.filter((d) => d.status === "assinado").length,
    cancelado: docs.filter((d) => d.status === "cancelado").length,
  }), [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((d) => {
      if (filter !== "todos" && d.status !== filter) return false;
      if (q && !docLabel(d).toLowerCase().includes(q) && !d.ref.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, filter, query]);

  // próximo número da sequência (preview otimista; o back é a fonte da verdade).
  function nextNumber(type) {
    const max = docs.filter((d) => d.type === type).reduce((m, d) => Math.max(m, d.number), 0);
    return max + 1;
  }

  function previewNumber(type) {
    return `${safeType(type).short} ${String(nextNumber(type)).padStart(4, "0")}/${YEAR}`;
  }

  function flash(message, tone = "success") {
    setFeedback({ tone, message });
    setTimeout(() => setFeedback(null), 4500);
  }

  async function runAction(promise, onSuccess) {
    try {
      const res = await promise;
      if (onSuccess) onSuccess(res);
    } catch (e) {
      flash(e?.message || "Não foi possível concluir a ação.", "danger");
    }
  }

  function openDoc(d) {
    const file = docFile(d);
    if (file) setPreview(file);
  }

  // Baixa o PDF oficial. Usa o pdfUrl assinado quando presente (same-origin via
  // proxy /files, download direto); senão gera pelo endpoint autenticado.
  async function downloadPdf(d) {
    try {
      const objectUrl = d.pdfUrl ? null : await fetchDocumentPdf(d.id);
      const href = objectUrl || sameOriginFile(d.pdfUrl);
      const a = document.createElement("a");
      a.href = href;
      a.download = `${docLabel(d).replace(/[\s/]+/g, "-")}.pdf`;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch (e) {
      flash(e?.message || "Não foi possível baixar o PDF.", "danger");
    }
  }

  function openIssue() {
    const first = activeTemplates[0];
    if (first) {
      setIssueTemplateId(first.id);
      setIssueType(first.type);
    } else {
      setIssueTemplateId(null);
      setIssueType("certidao_perpetuidade");
    }
    setIssueForm({ graveCode: "", personName: "", obs: "" });
    setIssueOpen(true);
  }

  function onModeloChange(e) {
    const v = e.target.value;
    if (v.startsWith("tpl:")) {
      const id = v.slice(4);
      const t = activeTemplates.find((x) => x.id === id);
      setIssueTemplateId(id);
      if (t) setIssueType(t.type);
    } else {
      setIssueType(v.slice(5));
      setIssueTemplateId(null);
    }
  }

  function submitIssue() {
    const { graveCode, personName, obs } = issueForm;
    const displayRef = [graveCode && `Jazigo ${graveCode}`, personName].filter(Boolean).join(" · ");
    const data = {};
    if (graveCode) data.jazigo_codigo = graveCode;
    if (personName) { data.sepultado_nome = personName; data.pessoa_nome = personName; }
    if (obs) data.observacoes = obs;

    const body = {
      documentType: issueType,
      templateId: issueTemplateId || undefined,
      graveCode: graveCode || undefined,
      notes: displayRef || undefined,
      data,
    };

    runAction(issueM.mutate(body), (doc) => {
      setIssueOpen(false);
      flash(`${safeType(doc.documentType).short} ${doc.formattedNumber} emitido com numeração sequencial automática.`);
      docsRes.refetch();
      tplRes.refetch();
    });
  }

  function reissue(doc) {
    runAction(reissueM.mutate(doc.id), (copy) => {
      setDetailId(null);
      flash(`2ª via emitida: ${safeType(copy.documentType).short} ${copy.formattedNumber} (original ${docLabel(doc)}).`);
      docsRes.refetch();
    });
  }

  function sendToSignature() {
    runAction(
      signM.mutate(signTarget.id, { signerName: signer.name, signerEmail: signer.email, signerRole: signer.role }),
      () => {
        setSignTarget(null);
        flash(`Documento enviado para assinatura eletrônica de ${signer.name}.`);
        docsRes.refetch();
        sigRes.refetch();
      }
    );
  }

  function runSimulate(doc) {
    runAction(simulateM.mutate(doc.id), () => {
      flash("Retorno do provedor recebido — documento assinado e validado.");
      docsRes.refetch();
      sigRes.refetch();
    });
  }

  function confirmCancel() {
    runAction(cancelM.mutate(cancelTarget.id, cancelTarget.reason), () => {
      setCancelTarget(null);
      setDetailId(null);
      flash("Documento cancelado — a numeração não é reaproveitada.");
      docsRes.refetch();
    });
  }

  function saveTemplate() {
    runAction(tplM.mutate(tplEditing), () => {
      setTplOpen(false);
      setTplEditing(null);
      flash("Modelo salvo.");
      tplRes.refetch();
    });
  }

  function openLegal() {
    const cur = legalRes.data || {};
    setLegalForm({
      legalCertidao: cur.legalCertidao || "",
      legalAutorizacao: cur.legalAutorizacao || "",
    });
    setLegalOpen(true);
  }

  function saveLegal() {
    runAction(legalM.mutate(legalForm), () => {
      setLegalOpen(false);
      flash("Textos legais atualizados — refletem nos próximos documentos emitidos.");
      legalRes.refetch();
    });
  }

  const columns = [
    {
      key: "doc", label: "Documento",
      render: (d) => (
        <div className={styles.docCell}>
          <button className={styles.docNumber} onClick={(e) => { e.stopPropagation(); openDoc(d); }}>
            {docLabel(d)}
          </button>
          <span className={styles.docType}>{safeType(d.type).label}{d.isReissue ? " · 2ª via" : ""}</span>
        </div>
      ),
    },
    { key: "ref", label: "Vinculado a", render: (d) => <span className={styles.refCell}>{d.ref}</span> },
    {
      key: "issued", label: "Emissão",
      render: (d) => (
        <div className={styles.dates}>
          <span>{d.issuedAt}</span>
          <span className={styles.datesSub}>{d.issuedBy}</span>
        </div>
      ),
    },
    {
      key: "status", label: "Situação",
      render: (d) => <Badge tone={DOC_STATUS[d.status].tone} dot={d.status === "aguardando_assinatura"}>{DOC_STATUS[d.status].label}</Badge>,
    },
    // Coluna "Assinatura" guardada pelo feature flag de assinatura eletrônica.
    ...(SIGNATURE_ENABLED ? [{
      key: "signature", label: "Assinatura",
      render: (d) => d.signature ? (
        <div className={styles.dates}>
          <span>{d.signature.signer}</span>
          <span className={styles.datesSub}>
            {d.signature.signedAt ? `assinado em ${d.signature.signedAt}` : `enviado em ${d.signature.sentAt}`}
          </span>
        </div>
      ) : (
        <span className={styles.noSig}>—</span>
      ),
    }] : []),
    {
      key: "action", label: "",
      render: (d) => <button className={styles.detailLink} onClick={() => setDetailId(d.id)}>Detalhes</button>,
    },
  ];

  let documentsTab;
  if (docsRes.loading) {
    documentsTab = <div className={styles.tabContent}><Skeleton variant="row" count={6} /></div>;
  } else if (docsRes.error) {
    documentsTab = <div className={styles.tabContent}><ErrorState onRetry={docsRes.refetch} /></div>;
  } else if (docs.length === 0) {
    documentsTab = (
      <div className={styles.tabContent}>
        <EmptyState
          title="Nenhum documento emitido"
          message="Emita certidões, autorizações e recibos com numeração sequencial automática."
          action={<Button onClick={openIssue}>Emitir documento</Button>}
        />
      </div>
    );
  } else {
    documentsTab = (
      <div className={styles.tabContent}>
        <div className={styles.statusChips}>
          {/* Filtro "Aguardando assinatura" guardado pelo feature flag de assinatura. */}
          {FILTERS.filter((f) => SIGNATURE_ENABLED || f.key !== "aguardando_assinatura").map((f) => (
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
            <input placeholder="Buscar por número ou vínculo…" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>

        <div className={styles.desktopTable}>
          <DataTable columns={columns} rows={filtered} rowKey={(d) => d.id} emptyMessage="Nenhum documento encontrado." />
        </div>

        <div className={styles.mobileList}>
          <span className={styles.mobileCount}>{filtered.length} documento(s)</span>
          {filtered.map((d) => (
            <button key={d.id} className={styles.mobileCard} onClick={() => setDetailId(d.id)}>
              <div className={styles.mobileCardTop}>
                <span className={styles.docNumberStatic}>{docLabel(d)}</span>
                <Badge tone={DOC_STATUS[d.status].tone}>{DOC_STATUS[d.status].label}</Badge>
              </div>
              <div className={styles.mobileCardBody}>
                <span className={styles.mobileCardName}>{safeType(d.type).label}{d.isReissue ? " · 2ª via" : ""}</span>
                <span className={styles.mobileCardMeta}>{d.ref} · {d.issuedAt}</span>
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
  }

  let templatesTab;
  if (tplRes.loading) {
    templatesTab = <div className={styles.tabContent}><Skeleton variant="card" count={3} /></div>;
  } else if (tplRes.error) {
    templatesTab = <div className={styles.tabContent}><ErrorState onRetry={tplRes.refetch} /></div>;
  } else {
    templatesTab = (
      <div className={styles.tabContent}>
        <div className={styles.typesHead}>
          <p className={styles.typesHint}>
            Modelos em nome do órgão gestor — logotipo, cores e cabeçalho vêm das
            configurações do cemitério. Variáveis entre <code>{"{{ }}"}</code> são
            substituídas na emissão.
          </p>
          <Button variant="secondary" size="sm" onClick={() => { setTplEditing({ name: "", type: "declaracao", active: true, content: "" }); setTplOpen(true); }}>
            + Novo modelo
          </Button>
        </div>
        {templates.length === 0 ? (
          <EmptyState
            title="Nenhum modelo cadastrado"
            message="Cadastre modelos oficiais com variáveis para padronizar a emissão de documentos do órgão gestor."
            action={<Button variant="secondary" onClick={() => { setTplEditing({ name: "", type: "declaracao", active: true, content: "" }); setTplOpen(true); }}>Cadastrar modelo</Button>}
          />
        ) : (
          <div className={styles.typeGrid}>
            {templates.map((tpl) => (
              <article key={tpl.id} className={`${styles.typeCard} ${!tpl.active ? styles.typeCardInactive : ""}`}>
                <div className={styles.typeCardHead}>
                  <Badge tone={safeType(tpl.type).tone}>{safeType(tpl.type).short}</Badge>
                  {tpl.active ? <Badge tone="success" dot>Ativo</Badge> : <Badge tone="neutral">Inativo</Badge>}
                </div>
                <span className={styles.typeName}>{tpl.name}</span>
                <p className={styles.typeDesc}>{tpl.content.slice(0, 90)}…</p>
                <div className={styles.typeMeta}>
                  <span className={styles.typeUse}>{tpl.uses} emissões · numeração {safeType(tpl.type).short}-####/{YEAR}</span>
                  <span className={styles.typeUse}>atualizado {tpl.updated}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => { setTplEditing({ ...tpl }); setTplOpen(true); }}>
                  Editar modelo
                </Button>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Documentos</h1>
          <p className={styles.subtitle}>Certidões, autorizações e recibos com numeração sequencial</p>
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={openLegal}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M4 2.5h6l2.5 2.5v8.5a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                <path d="M6 7h4M6 9.5h4M6 12h2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            }
          >
            Textos legais
          </Button>
          <Button variant="secondary" onClick={() => setExportOpen(true)}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 2v8m0 0 3-3m-3 3L5 7M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
          >
            Exportar
          </Button>
          <Button onClick={openIssue}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Emitir documento
          </Button>
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Emitidos em 2026" value={String(docs.length)} caption="todos os tipos" />
        {/* StatCards de assinatura guardados pelo feature flag de assinatura eletrônica. */}
        {SIGNATURE_ENABLED && (
          <StatCard label="Aguardando assinatura" value={String(counts.aguardando_assinatura)} caption="no provedor eletrônico" />
        )}
        {SIGNATURE_ENABLED && (
          <StatCard label="Assinados" value={String(counts.assinado)} caption="com hash de validação" />
        )}
        <StatCard label="Segundas vias" value={String(docs.filter((d) => d.isReissue).length)} caption="reemissões vinculadas" />
      </div>

      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

      <Tabs
        items={[
          { label: "Documentos emitidos", count: docs.length, content: documentsTab },
          { label: "Modelos", count: templates.length, content: templatesTab },
        ]}
      />

      {/* ---------- detalhe do documento ---------- */}
      <Modal
        open={Boolean(detail)}
        onClose={() => setDetailId(null)}
        title={detail ? docLabel(detail) : ""}
        subtitle={detail ? safeType(detail.type).label : ""}
        width={640}
        footer={
          detail && (
            <>
              {SIGNATURE_ENABLED && detail.status === "emitido" && (
                <Button variant="secondary" onClick={() => setSignTarget(detail)}>
                  Enviar para assinatura
                </Button>
              )}
              {detail.status !== "cancelado" && (
                <Button variant="secondary" loading={reissueM.loading} onClick={() => reissue(detail)}>
                  Emitir 2ª via
                </Button>
              )}
              {detail.status !== "cancelado" && (
                <Button variant="danger" onClick={() => setCancelTarget({ id: detail.id, reason: "" })}>
                  Cancelar
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detail && (
          <div className={styles.detailBody}>
            <div className={styles.docHero}>
              <span className={styles.docHeroIcon}>
                <svg viewBox="0 0 20 20" fill="none">
                  <path d="M5 2.5h7l3.5 3.5v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-13.5a1 1 0 0 1 1-1Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                  <path d="M12 2.5V6h3.5M7 10h6M7 13h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                </svg>
              </span>
              <div className={styles.docHeroInfo}>
                <Badge tone={DOC_STATUS[detail.status].tone} dot={detail.status === "aguardando_assinatura"}>
                  {DOC_STATUS[detail.status].label}
                </Badge>
                <span className={styles.docHeroMeta}>
                  Emitido em {detail.issuedAt} por {detail.issuedBy}
                </span>
                {detail.isReissue && (
                  <span className={styles.docHeroMeta}>
                    {originalLabel(detail) ? `2ª via do documento ${originalLabel(detail)}` : "2ª via"}
                  </span>
                )}
                {detail.cancelReason && (
                  <span className={styles.cancelReason}>Motivo do cancelamento: {detail.cancelReason}</span>
                )}
              </div>
              <div className={styles.docHeroActions}>
                <Button variant="secondary" size="sm" onClick={() => openDoc(detail)}>Ver PDF</Button>
                <Button variant="ghost" size="sm" onClick={() => downloadPdf(detail)}>Baixar PDF</Button>
              </div>
            </div>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Vinculado a</span>
              <p className={styles.refText}>{detail.ref}</p>
            </section>

            {/* Seção de assinatura eletrônica guardada pelo feature flag. */}
            {SIGNATURE_ENABLED && (
            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Assinatura eletrônica</span>
              {detailSignature ? (
                <div className={styles.sigBox}>
                  <div className={styles.sigRow}>
                    <span className={styles.sigLabel}>Signatário</span>
                    <span className={styles.sigValue}>{detailSignature.signer}{detailSignature.role ? ` · ${detailSignature.role}` : ""}</span>
                  </div>
                  <div className={styles.sigRow}>
                    <span className={styles.sigLabel}>Enviado em</span>
                    <span className={styles.sigValue}>{detailSignature.sentAt}</span>
                  </div>
                  {detailSignature.signedAt ? (
                    <>
                      <div className={styles.sigRow}>
                        <span className={styles.sigLabel}>Assinado em</span>
                        <span className={styles.sigValue}>{detailSignature.signedAt}</span>
                      </div>
                      <div className={styles.sigRow}>
                        <span className={styles.sigLabel}>Hash de validação</span>
                        <span className={styles.sigHash}>{detailSignature.hash || "—"}</span>
                      </div>
                      <div className={styles.sigRow}>
                        <span className={styles.sigLabel}>IP do signatário</span>
                        <span className={styles.sigHash}>{detailSignature.ip || "—"}</span>
                      </div>
                    </>
                  ) : (
                    <div className={styles.simulate}>
                      <span>Aguardando retorno do provedor de assinatura…</span>
                      <Button variant="secondary" size="sm" loading={simulateM.loading} onClick={() => runSimulate(detail)}>
                        Simular retorno do provedor
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className={styles.noSigText}>
                  {detail.status === "cancelado"
                    ? "Documento cancelado — sem fluxo de assinatura."
                    : "Ainda não enviado para assinatura eletrônica."}
                </p>
              )}
            </section>
            )}
          </div>
        )}
      </Modal>

      {/* ---------- emitir documento ---------- */}
      <Modal
        open={issueOpen}
        onClose={() => setIssueOpen(false)}
        title="Emitir documento"
        subtitle="A numeração sequencial é gerada automaticamente por tipo e ano"
        width={600}
        footer={
          <>
            <Button variant="ghost" onClick={() => setIssueOpen(false)}>Cancelar</Button>
            <Button loading={issueM.loading} onClick={submitIssue}>Emitir {previewNumber(issueType)}</Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <FormField label="Modelo" required className={styles.spanTwo}>
              <Select value={issueTemplateId ? `tpl:${issueTemplateId}` : `type:${issueType}`} onChange={onModeloChange}>
                {activeTemplates.length > 0
                  ? activeTemplates.map((t) => (
                    <option key={t.id} value={`tpl:${t.id}`}>{t.name}</option>
                  ))
                  : EMIT_TYPES.map(([key, meta]) => (
                    <option key={key} value={`type:${key}`}>{meta.label}</option>
                  ))}
              </Select>
            </FormField>
            <FormField label="Sepultura vinculada" hint="código do jazigo">
              <Input placeholder="A-12" value={issueForm.graveCode} onChange={(e) => setIssueForm({ ...issueForm, graveCode: e.target.value })} />
            </FormField>
            <FormField label="Pessoa / sepultado">
              <Input placeholder="Nome" value={issueForm.personName} onChange={(e) => setIssueForm({ ...issueForm, personName: e.target.value })} />
            </FormField>
            <FormField label="Observações" className={styles.spanTwo}>
              <Textarea rows={2} placeholder="Contexto da emissão (opcional)" value={issueForm.obs} onChange={(e) => setIssueForm({ ...issueForm, obs: e.target.value })} />
            </FormField>
          </div>
          <Alert tone="info">
            Próximo número da sequência: <strong>{previewNumber(issueType)}</strong> —
            o PDF sai com o cabeçalho do órgão gestor (logotipo e dados do cemitério).
          </Alert>
        </div>
      </Modal>

      {/* ---------- enviar para assinatura (guardado pelo feature flag) ---------- */}
      {SIGNATURE_ENABLED && (
      <Modal
        open={Boolean(signTarget)}
        onClose={() => setSignTarget(null)}
        title="Enviar para assinatura eletrônica"
        subtitle={signTarget ? docLabel(signTarget) : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSignTarget(null)}>Cancelar</Button>
            <Button loading={signM.loading} disabled={!signer.name || !signer.email} onClick={sendToSignature}>
              Enviar para assinatura
            </Button>
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.formGrid}>
            <FormField label="Signatário" required>
              <Input value={signer.name} onChange={(e) => setSigner({ ...signer, name: e.target.value })} />
            </FormField>
            <FormField label="Cargo">
              <Input value={signer.role} onChange={(e) => setSigner({ ...signer, role: e.target.value })} />
            </FormField>
            <FormField label="E-mail do signatário" required className={styles.spanTwo}>
              <Input type="email" value={signer.email} onChange={(e) => setSigner({ ...signer, email: e.target.value })} />
            </FormField>
          </div>
          <Alert tone="info">
            O signatário recebe o link por e-mail. Quando assinar, o <strong>webhook do
            provedor</strong> atualiza o documento para <strong>Assinado</strong> com hash
            de validação e IP — sem ação manual.
          </Alert>
        </div>
      </Modal>
      )}

      {/* ---------- cancelar documento ---------- */}
      <Modal
        open={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        title="Cancelar documento"
        subtitle="A numeração não é reaproveitada — o cancelamento fica registrado"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCancelTarget(null)}>Voltar</Button>
            <Button variant="danger" loading={cancelM.loading} onClick={confirmCancel}>Confirmar cancelamento</Button>
          </>
        }
      >
        <div className={styles.form}>
          <FormField label="Motivo do cancelamento" required>
            <Textarea
              rows={3}
              placeholder="Descreva o motivo — vai para a auditoria"
              value={cancelTarget?.reason || ""}
              onChange={(e) => setCancelTarget({ ...cancelTarget, reason: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>

      {/* ---------- editar/criar modelo ---------- */}
      <Modal
        open={tplOpen}
        onClose={() => { setTplOpen(false); setTplEditing(null); }}
        title={tplEditing?.id ? `Editar modelo` : "Novo modelo"}
        subtitle={tplEditing?.name || "Documento oficial do órgão gestor"}
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => { setTplOpen(false); setTplEditing(null); }}>Cancelar</Button>
            <Button loading={tplM.loading} disabled={!tplEditing?.name} onClick={saveTemplate}>Salvar modelo</Button>
          </>
        }
      >
        {tplEditing && (
          <div className={styles.form}>
            <div className={styles.formGrid}>
              <FormField label="Nome do modelo" required className={styles.spanTwo}>
                <Input value={tplEditing.name} onChange={(e) => setTplEditing({ ...tplEditing, name: e.target.value })} placeholder="Ex.: Certidão de Perpetuidade — padrão" />
              </FormField>
              <FormField label="Tipo de documento" required>
                <Select value={tplEditing.type} onChange={(e) => setTplEditing({ ...tplEditing, type: e.target.value })} disabled={Boolean(tplEditing.id)}>
                  {Object.entries(DOC_TYPES).map(([key, meta]) => (
                    <option key={key} value={key}>{meta.label}</option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Situação">
                <div className={styles.switchRow}>
                  <Switch
                    checked={tplEditing.active}
                    onChange={() => setTplEditing({ ...tplEditing, active: !tplEditing.active })}
                    label={tplEditing.active ? "Ativo" : "Inativo"}
                  />
                </div>
              </FormField>
              <FormField label="Conteúdo do documento" required className={styles.spanTwo} hint="use as variáveis abaixo — substituídas na emissão">
                <Textarea
                  rows={6}
                  value={tplEditing.content}
                  onChange={(e) => setTplEditing({ ...tplEditing, content: e.target.value })}
                  placeholder="Certificamos, para os devidos fins, que o jazigo {{jazigo_codigo}}…"
                />
              </FormField>
            </div>
            <div className={styles.varsBox}>
              <span className={styles.sectionLabel}>Variáveis disponíveis</span>
              <div className={styles.varsList}>
                {VARIABLES_HELP.map((v) => (
                  <button
                    key={v}
                    className={styles.varChip}
                    onClick={() => setTplEditing({ ...tplEditing, content: `${tplEditing.content} ${v}`.trim() })}
                    type="button"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------- textos legais por cidade ---------- */}
      <Modal
        open={legalOpen}
        onClose={() => setLegalOpen(false)}
        title="Textos legais dos documentos"
        subtitle="Fundamentação legal injetada nos modelos oficiais como {{texto_legal}}"
        width={680}
        footer={
          <>
            <Button variant="ghost" onClick={() => setLegalOpen(false)}>Cancelar</Button>
            <Button loading={legalM.loading} onClick={saveLegal}>Salvar textos</Button>
          </>
        }
      >
        <div className={styles.form}>
          <Alert tone="info">
            Estes textos aparecem na seção <strong>Fundamentação legal</strong> da
            Certidão de Perpetuidade e da Autorização de Sepultamento. A alteração
            reflete nos <strong>próximos documentos</strong> emitidos.
          </Alert>
          <div className={styles.formGrid}>
            <FormField label="Texto legal — Certidão de Perpetuidade" className={styles.spanTwo}>
              <Textarea
                rows={7}
                value={legalForm.legalCertidao}
                onChange={(e) => setLegalForm({ ...legalForm, legalCertidao: e.target.value })}
                placeholder="Artigos e fundamentação da certidão de perpetuidade…"
              />
            </FormField>
            <FormField label="Texto legal — Autorização de Sepultamento" className={styles.spanTwo}>
              <Textarea
                rows={7}
                value={legalForm.legalAutorizacao}
                onChange={(e) => setLegalForm({ ...legalForm, legalAutorizacao: e.target.value })}
                placeholder="Artigos e fundamentação da autorização de sepultamento…"
              />
            </FormField>
          </div>
        </div>
      </Modal>

      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        entity="documentos"
        totalCount={docs.length}
        filteredCount={filtered.length}
      />

      <FileViewer open={Boolean(preview)} file={preview} onClose={() => setPreview(null)} />
    </div>
  );
}
