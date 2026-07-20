"use client";

import { Fragment, useMemo, useState } from "react";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Badge from "@/components/atoms/Badge/Badge";
import Select from "@/components/atoms/Select/Select";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import Modal from "@/components/molecules/Modal/Modal";
import Alert from "@/components/molecules/Alert/Alert";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import DataTable from "@/components/organisms/DataTable/DataTable";

import { useResource, useMutation } from "@/lib/api/useResource";
import {
  listBatches,
  getBatch,
  listBatchRecords,
  createBatch,
  validateBatch,
  commitBatch,
  cancelBatch,
  ENTITY_FIELDS,
  toBatchRow,
  recordToIssue,
  parseCsv,
  guessMapping,
  buildRows,
} from "@/lib/api/resources/imports";

// Entidades migráveis — a chave é o escopo do front (`pessoas`); a API faz o
// alias interno para `proprietarios`.
const ENTITIES = {
  sepulturas: { label: "Sepulturas", tone: "navy", desc: "Jazigos, quadras e localizações" },
  sepultados: { label: "Sepultados", tone: "info", desc: "Registros de sepultamento e óbito" },
  pessoas: { label: "Pessoas", tone: "neutral", desc: "Concessionários, responsáveis e contatos" },
  concessoes: { label: "Concessões", tone: "success", desc: "Contratos e vínculos com jazigos" },
  cobrancas: { label: "Cobranças históricas", tone: "warning", desc: "Débitos e pagamentos do sistema antigo" },
};
const entityMeta = (key) => ENTITIES[key] || { label: key, tone: "neutral", desc: "" };

// Status reais do ImportBatch (imports.service.js) → apresentação.
const BATCH_STATUS = {
  pendente: { label: "Aguardando validação", tone: "neutral" },
  validado: { label: "Aguardando confirmação", tone: "warning" },
  processando: { label: "Efetivando", tone: "info" },
  importado: { label: "Importado", tone: "success" },
  erro: { label: "Com erro", tone: "danger" },
  cancelado: { label: "Descartado", tone: "danger" },
};
const statusMeta = (s) => BATCH_STATUS[s] || { label: s || "—", tone: "neutral" };

const STEPS = ["Arquivo", "Mapeamento", "Validação", "Confirmação"];

const fmt = (n) => Number(n || 0).toLocaleString("pt-BR");

export default function ImportsPage() {
  const [detailId, setDetailId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tone, message }

  // assistente de nova importação
  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [entity, setEntity] = useState("sepultados");
  const [fileName, setFileName] = useState("");
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [dragOver, setDragOver] = useState(false);
  const [mapping, setMapping] = useState([]);
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [valResult, setValResult] = useState(null); // toBatchRow(validado)
  const [valError, setValError] = useState(null);
  const [wizardBatchId, setWizardBatchId] = useState(null);
  const [committed, setCommitted] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);

  /* ---------- listagem (histórico) ---------- */
  const {
    data: listData,
    loading,
    error,
    refetch,
  } = useResource(({ signal }) => listBatches({ perPage: 100 }, { signal }), []);

  const rows = useMemo(() => (listData?.data ?? []).map(toBatchRow), [listData]);

  const stats = useMemo(() => {
    const imported = rows.filter((b) => b.status === "importado");
    return {
      lotes: imported.length,
      migrated: imported.reduce((sum, b) => sum + b.ok, 0),
      waiting: rows.filter((b) => b.status === "validado").length,
      errorLines: rows.reduce((sum, b) => sum + b.errors, 0),
    };
  }, [rows]);

  /* ---------- detalhe do lote ---------- */
  const {
    data: detailData,
    loading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useResource(
    ({ signal }) => (detailId ? getBatch(detailId, { signal }) : Promise.resolve(null)),
    [detailId]
  );
  const { data: recordsData } = useResource(
    ({ signal }) =>
      detailId
        ? listBatchRecords(detailId, { status: "invalido", perPage: 100 }, { signal })
        : Promise.resolve(null),
    [detailId]
  );

  const detail = useMemo(() => (detailData ? toBatchRow(detailData) : null), [detailData]);
  const detailIssues = useMemo(
    () => (recordsData?.data ?? []).map(recordToIssue),
    [recordsData]
  );

  /* ---------- mutações ---------- */
  const { mutate: doCreate } = useMutation(createBatch);
  const { mutate: doValidate } = useMutation(validateBatch);
  const { mutate: doCommit } = useMutation(commitBatch);
  const { mutate: doCancel } = useMutation(cancelBatch);

  function flash(message, tone = "success") {
    setFeedback({ tone, message });
    setTimeout(() => setFeedback(null), 4500);
  }

  async function run(fn, okMsg) {
    setSaving(true);
    try {
      await fn();
      if (okMsg) flash(okMsg, "success");
      return true;
    } catch (e) {
      flash(e?.message || "Não foi possível concluir a ação.", "danger");
      return false;
    } finally {
      setSaving(false);
    }
  }

  /* ---------- assistente ---------- */

  function resetWizard() {
    setStep(1);
    setEntity("sepultados");
    setFileName("");
    setParsed(null);
    setDragOver(false);
    setMapping([]);
    setValidating(false);
    setValidated(false);
    setValResult(null);
    setValError(null);
    setWizardBatchId(null);
    setCommitted(false);
    setConfirmChecked(false);
  }

  function openWizard() {
    resetWizard();
    setWizardOpen(true);
  }

  // Descarta o lote pendente/validado criado pelo assistente se o operador
  // desiste antes de efetivar — não deixa lote órfão (preserva a auditoria).
  async function discardWizardBatch() {
    if (wizardBatchId && !committed) {
      await doCancel(wizardBatchId).catch(() => {});
    }
  }

  async function closeWizard() {
    await discardWizardBatch();
    setWizardOpen(false);
    resetWizard();
  }

  function selectEntity(key) {
    setEntity(key);
    if (parsed) setMapping(guessMapping(parsed.headers, ENTITY_FIELDS[key] || []));
  }

  async function handleFile(file) {
    if (!file) return;
    setFileName(file.name);
    setDragOver(false);
    try {
      const text = await file.text();
      const p = parseCsv(text);
      setParsed(p);
      setMapping(guessMapping(p.headers, ENTITY_FIELDS[entity] || []));
    } catch {
      flash("Não foi possível ler o arquivo. Envie um CSV válido.", "danger");
    }
  }

  function clearFile() {
    setFileName("");
    setParsed(null);
    setMapping([]);
  }

  // Baixa um modelo CSV com exatamente as colunas que o importador reconhece.
  function downloadTemplate(key) {
    const fields = ENTITY_FIELDS[key] || [];
    const header = fields.map((f) => f.value).join(",");
    const blob = new Blob([`${header}\n`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `modelo_${key}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Modelo baixado: modelo_${key}.csv`);
  }

  const entityFields = ENTITY_FIELDS[entity] || [];
  const requiredValues = entityFields.filter((f) => f.required).map((f) => f.value);
  const mappedTargets = useMemo(
    () => new Set(mapping.filter((m) => m.target).map((m) => m.target)),
    [mapping]
  );
  const missingRequired = requiredValues.filter((v) => !mappedTargets.has(v));
  const mappedCount = mapping.filter((m) => m.target).length;

  async function runValidation() {
    setValidating(true);
    setValidated(false);
    setValError(null);
    try {
      const dataRows = buildRows(parsed.rows, mapping);
      const batch = await doCreate({ entityScope: entity, fileName, rows: dataRows });
      const result = await doValidate(batch.id);
      setWizardBatchId(batch.id);
      setValResult(toBatchRow(result));
      setValidated(true);
    } catch (e) {
      setValError(e?.message || "Falha na validação do lote.");
    } finally {
      setValidating(false);
    }
  }

  async function goNext() {
    if (step === 1) setStep(2);
    else if (step === 2) {
      // Refaz a validação: descarta um lote anterior deste assistente, se houver.
      await discardWizardBatch();
      setWizardBatchId(null);
      setStep(3);
      runValidation();
    } else if (step === 3) setStep(4);
  }

  async function goBack() {
    if (step === 3) {
      // Voltar ao mapeamento invalida o lote já criado.
      await discardWizardBatch();
      setWizardBatchId(null);
      setValidated(false);
      setValResult(null);
      setValError(null);
    }
    setStep((s) => Math.max(1, s - 1));
  }

  const nextDisabled =
    (step === 1 && !parsed) ||
    (step === 2 && missingRequired.length > 0) ||
    (step === 3 && (validating || !validated));

  async function confirmImport() {
    const ok = await run(async () => {
      await doCommit(wizardBatchId);
      setCommitted(true);
    }, `Lote enviado para efetivação — ${fmt(valResult?.ok)} registros válidos entram em produção; ${fmt(valResult?.errors)} linhas rejeitadas ficam no relatório do lote.`);
    if (ok) {
      setWizardOpen(false);
      resetWizard();
      refetch();
    }
  }

  /* ---------- ações do lote (detalhe) ---------- */

  async function confirmBatch(batch) {
    const ok = await run(
      () => doCommit(batch.id),
      `Lote ${batch.code} enviado para efetivação — ${fmt(batch.ok)} registros válidos entram em produção.`
    );
    if (ok) {
      setDetailId(null);
      refetch();
    }
  }

  async function discardBatch(batch) {
    const ok = await run(
      () => doCancel(batch.id),
      `Lote ${batch.code} descartado — nenhum registro entrou em produção.`
    );
    if (ok) {
      setDetailId(null);
      refetch();
    }
  }

  function downloadReport(batch, issues) {
    const head = "linha,erro";
    const lines = issues.map(
      (i) => `${i.line},"${String(i.message || "").replace(/"/g, '""')}"`
    );
    const blob = new Blob([`${head}\n${lines.join("\n")}\n`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_${batch.code}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Relatório do lote ${batch.code} baixado.`);
  }

  /* ---------- tabela ---------- */

  const columns = [
    {
      key: "batch",
      label: "Lote",
      render: (b) => (
        <div className={styles.docCell}>
          <span className={styles.docNumberStatic}>{b.code}</span>
          <span className={styles.docType}>{b.file}</span>
        </div>
      ),
    },
    {
      key: "entity",
      label: "Entidade",
      render: (b) => <Badge tone={entityMeta(b.entity).tone}>{entityMeta(b.entity).label}</Badge>,
    },
    {
      key: "records",
      label: "Registros",
      render: (b) => (
        <span className={styles.recordsCell}>
          {fmt(b.ok)} ok
          {" · "}
          <span className={b.errors > 0 ? styles.recordsErr : undefined}>{fmt(b.errors)} erros</span>
        </span>
      ),
    },
    {
      key: "sent",
      label: "Enviado",
      render: (b) => (
        <div className={styles.dates}>
          <span>{b.sentAt}</span>
          <span className={styles.datesSub}>{b.sentBy}</span>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (b) => (
        <Badge
          tone={statusMeta(b.status).tone}
          dot={b.status === "validado" || b.status === "processando"}
        >
          {statusMeta(b.status).label}
        </Badge>
      ),
    },
    {
      key: "action",
      label: "",
      render: (b) => (
        <button className={styles.detailLink} onClick={() => setDetailId(b.id)}>
          Detalhes
        </button>
      ),
    },
  ];

  /* ---------- blocos reutilizados ---------- */

  function renderSummary(ok, warnings, errors) {
    return (
      <div className={styles.valSummary}>
        <div className={`${styles.valBox} ${styles.valBoxOk}`}>
          <span className={styles.valNum}>{fmt(ok)}</span>
          <span className={styles.valLabel}>válidos</span>
        </div>
        <div className={`${styles.valBox} ${styles.valBoxWarn}`}>
          <span className={styles.valNum}>{fmt(warnings)}</span>
          <span className={styles.valLabel}>avisos</span>
        </div>
        <div className={`${styles.valBox} ${styles.valBoxErr}`}>
          <span className={styles.valNum}>{fmt(errors)}</span>
          <span className={styles.valLabel}>erros</span>
        </div>
      </div>
    );
  }

  function renderIssues(issues) {
    return (
      <div className={styles.issueList}>
        {issues.map((issue) => (
          <div key={`${issue.line}-${issue.message}`} className={styles.issueItem}>
            <Badge tone={issue.level === "erro" ? "danger" : "warning"}>
              {issue.level === "erro" ? "Erro" : "Aviso"}
            </Badge>
            <span className={styles.issueLine}>Linha {issue.line}</span>
            <span className={styles.issueMsg}>{issue.message}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <h1 className={styles.title}>Importar dados</h1>
          <p className={styles.subtitle}>Migração de legado com validação antes da produção</p>
        </div>
        <div className={styles.actions}>
          <Button
            onClick={openWizard}
            iconLeft={
              <svg viewBox="0 0 16 16" fill="none">
                <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            }
          >
            Nova importação
          </Button>
        </div>
      </header>

      <div className={styles.stats}>
        <StatCard label="Lotes importados" value={String(stats.lotes)} caption="concluídos em produção" />
        <StatCard label="Registros migrados" value={fmt(stats.migrated)} caption="já em produção" />
        <StatCard label="Aguardando confirmação" value={String(stats.waiting)} caption="validados, fora da produção" />
        <StatCard label="Linhas com erro" value={fmt(stats.errorLines)} caption="rejeitadas nos lotes" />
      </div>

      {feedback && <Alert tone={feedback.tone}>{feedback.message}</Alert>}

      <Alert tone="info" title="Nada entra em produção sem validação e confirmação humana">
        Fluxo de migração: <strong>arquivo</strong> → <strong>validação automática</strong> →{" "}
        <strong>revisão dos erros</strong> → <strong>confirmação</strong> → <strong>produção</strong>.
        Cada linha do arquivo vira um registro do lote: erros bloqueiam as linhas afetadas e nada é
        gravado antes do seu aval. Exporte cada entidade do sistema antigo em CSV e use o modelo de
        colunas para garantir o de-para correto.
      </Alert>

      <section className={styles.historySection}>
        <div className={styles.historyHead}>
          <h2 className={styles.historyTitleLg}>Histórico de lotes</h2>
          <span className={styles.historyCount}>{rows.length} lote(s)</span>
        </div>

        {loading ? (
          <div className={styles.desktopTable}>
            <Skeleton variant="row" count={6} />
          </div>
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : !rows.length ? (
          <EmptyState
            title="Nenhuma importação realizada"
            message="Migre os dados do sistema antigo enviando o primeiro arquivo para validação."
            action={<Button onClick={openWizard}>Nova importação</Button>}
          />
        ) : (
          <>
            <div className={styles.desktopTable}>
              <DataTable columns={columns} rows={rows} rowKey={(b) => b.id} emptyMessage="Nenhuma importação realizada." />
            </div>

            <div className={styles.mobileList}>
              <span className={styles.mobileCount}>{rows.length} lote(s)</span>
              {rows.map((b) => (
                <button key={b.id} className={styles.mobileCard} onClick={() => setDetailId(b.id)}>
                  <div className={styles.mobileCardTop}>
                    <span className={styles.docNumberStatic}>{b.code}</span>
                    <Badge tone={statusMeta(b.status).tone} dot={b.status === "validado"}>
                      {statusMeta(b.status).label}
                    </Badge>
                  </div>
                  <div className={styles.mobileCardBody}>
                    <span className={styles.mobileCardName}>{entityMeta(b.entity).label} · {b.file}</span>
                    <span className={styles.mobileCardMeta}>{fmt(b.ok)} ok · {fmt(b.errors)} erros · {b.sentAt}</span>
                  </div>
                  <span className={styles.mobileCardChevron}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ---------- nova importação (assistente) ---------- */}
      <Modal
        open={wizardOpen}
        onClose={closeWizard}
        title="Nova importação"
        subtitle="Nada entra em produção sem validação e confirmação humana"
        width={720}
        footer={
          <>
            <Button variant="ghost" onClick={closeWizard} disabled={saving}>Cancelar</Button>
            {step > 1 && (
              <Button variant="secondary" onClick={goBack} disabled={saving || validating}>
                Voltar
              </Button>
            )}
            {step < 4 ? (
              <Button onClick={goNext} disabled={nextDisabled}>Avançar</Button>
            ) : (
              <Button loading={saving} disabled={!confirmChecked} onClick={confirmImport}>
                Importar para produção
              </Button>
            )}
          </>
        }
      >
        <div className={styles.form}>
          <div className={styles.stepper}>
            {STEPS.map((label, i) => {
              const n = i + 1;
              const stateClass = n === step ? styles.stepActive : n < step ? styles.stepDone : "";
              return (
                <Fragment key={label}>
                  {i > 0 && (
                    <span className={`${styles.stepConnector} ${n <= step ? styles.stepConnectorDone : ""}`} />
                  )}
                  <div className={`${styles.step} ${stateClass}`}>
                    <span className={styles.stepCircle}>
                      {n < step ? (
                        <svg viewBox="0 0 16 16" fill="none">
                          <path d="m3.5 8.5 3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        n
                      )}
                    </span>
                    <span className={styles.stepLabel}>{label}</span>
                  </div>
                </Fragment>
              );
            })}
          </div>

          {/* ----- passo 1: entidade + arquivo ----- */}
          {step === 1 && (
            <>
              <p className={styles.stepHint}>
                Escolha o que será migrado e envie o arquivo exportado do sistema antigo.
                Use o modelo CSV de cada entidade para garantir as colunas esperadas.
              </p>
              <div className={styles.entityGrid}>
                {Object.entries(ENTITIES).map(([key, meta]) => (
                  <div
                    key={key}
                    role="button"
                    tabIndex={0}
                    className={`${styles.entityCard} ${entity === key ? styles.entityCardActive : ""}`}
                    onClick={() => selectEntity(key)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectEntity(key); } }}
                  >
                    <span className={styles.entityName}>{meta.label}</span>
                    <span className={styles.entityDesc}>{meta.desc}</span>
                    <button
                      type="button"
                      className={styles.templateLink}
                      onClick={(e) => { e.stopPropagation(); downloadTemplate(key); }}
                    >
                      Baixar modelo CSV
                    </button>
                  </div>
                ))}
              </div>

              {parsed ? (
                <div className={styles.filePicked}>
                  <span className={styles.fileIcon}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="m3.5 8.5 3 3 6-6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <div className={styles.fileInfo}>
                    <span className={styles.fileName}>{fileName}</span>
                    <span className={styles.fileMeta}>{fmt(parsed.rows.length)} linhas · pronto para mapeamento</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={clearFile}>
                    Remover
                  </Button>
                </div>
              ) : (
                <label
                  className={`${styles.dropzone} ${dragOver ? styles.dropzoneDrag : ""}`}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                >
                  <input
                    type="file"
                    accept=".csv"
                    className={styles.dropzoneInput}
                    onChange={(e) => handleFile(e.target.files?.[0])}
                  />
                  <span className={styles.dropzoneIcon}>
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M8 10V3m0 0L5 6m3-3 3 3M3 12v1a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <span className={styles.dropzoneTitle}>Clique para escolher ou arraste o arquivo aqui</span>
                  <span className={styles.dropzoneHint}>CSV exportado do sistema antigo · até 50.000 linhas por lote</span>
                </label>
              )}
            </>
          )}

          {/* ----- passo 2: mapeamento de colunas ----- */}
          {step === 2 && (
            <>
              <p className={styles.stepHint}>
                Confira o de-para entre as colunas de <strong>{fileName}</strong> e os campos do
                sistema. Sugestões automáticas aparecem com o selo <Badge tone="navy">auto</Badge> —
                colunas sem campo do sistema são ignoradas.
              </p>
              <div className={styles.mapTable}>
                {mapping.map((m, i) => (
                  <div key={m.source} className={styles.mapRow}>
                    <div className={styles.mapSource}>
                      <span className={styles.mapCol}>{m.source}</span>
                      {m.auto && m.target && <Badge tone="navy">auto</Badge>}
                    </div>
                    <svg className={styles.mapArrow} viewBox="0 0 16 16" fill="none">
                      <path d="M2.5 8h11m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <Select
                      value={m.target}
                      onChange={(e) =>
                        setMapping((prev) =>
                          prev.map((row, idx) => (idx === i ? { ...row, target: e.target.value, auto: false } : row))
                        )
                      }
                    >
                      <option value="">— Não importar —</option>
                      {entityFields.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}{f.required ? " *" : ""}</option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
              {missingRequired.length > 0 && (
                <p className={styles.valNote}>
                  Campos obrigatórios ainda não mapeados:{" "}
                  <strong>
                    {missingRequired
                      .map((v) => entityFields.find((f) => f.value === v)?.label || v)
                      .join(", ")}
                  </strong>
                  . Ajuste o de-para para avançar.
                </p>
              )}
              <p className={styles.valNote}>
                {mappedCount} de {mapping.length} colunas mapeadas — ajuste manualmente se o
                de-para automático não estiver correto.
              </p>
            </>
          )}

          {/* ----- passo 3: validação ----- */}
          {step === 3 && (
            validating ? (
              <div className={styles.validatingBox}>
                <span className={styles.spinnerLg} />
                <span className={styles.validatingText}>Validando {fmt(parsed?.rows.length)} registros…</span>
              </div>
            ) : valError ? (
              <ErrorState title="Falha na validação" message={valError} onRetry={runValidation} />
            ) : valResult ? (
              <>
                {renderSummary(valResult.ok, 0, valResult.errors)}
                {valResult.issues.length > 0 && renderIssues(valResult.issues)}
                <p className={styles.valNote}>
                  Erros bloqueiam a importação das linhas afetadas. Nenhum registro foi gravado em
                  produção até aqui.
                </p>
              </>
            ) : null
          )}

          {/* ----- passo 4: confirmação ----- */}
          {step === 4 && valResult && (
            <>
              <div className={styles.valueBox}>
                <div className={styles.valueRow}>
                  <span>Arquivo</span>
                  <strong>{fileName} · {fmt(parsed?.rows.length)} linhas</strong>
                </div>
                <div className={styles.valueRow}>
                  <span>Entidade</span>
                  <strong>{entityMeta(entity).label}</strong>
                </div>
                <div className={styles.valueRow}>
                  <span>Linhas rejeitadas (ficam no relatório do lote)</span>
                  <strong>{fmt(valResult.errors)} linhas</strong>
                </div>
                <div className={`${styles.valueRow} ${styles.valueTotal}`}>
                  <span>Entram em produção</span>
                  <strong>{fmt(valResult.ok)} registros</strong>
                </div>
              </div>
              <label className={`${styles.checkRow} ${confirmChecked ? styles.checkRowChecked : ""}`}>
                <input
                  type="checkbox"
                  checked={confirmChecked}
                  onChange={(e) => setConfirmChecked(e.target.checked)}
                />
                <span>
                  Revisei os erros da validação e autorizo a importação destes registros para
                  produção.
                </span>
              </label>
            </>
          )}
        </div>
      </Modal>

      {/* ---------- detalhe do lote ---------- */}
      <Modal
        open={Boolean(detailId)}
        onClose={() => setDetailId(null)}
        title={detail?.code || "Carregando…"}
        subtitle={detail ? `${entityMeta(detail.entity).label} · ${detail.file}` : ""}
        width={640}
        footer={
          detail && (
            <>
              {detail.status === "validado" && (
                <>
                  <Button variant="danger" loading={saving} onClick={() => discardBatch(detail)}>
                    Descartar lote
                  </Button>
                  <Button loading={saving} onClick={() => confirmBatch(detail)}>
                    Confirmar importação
                  </Button>
                </>
              )}
              {(detail.status === "pendente" || detail.status === "erro") && (
                <Button variant="danger" loading={saving} onClick={() => discardBatch(detail)}>
                  Descartar lote
                </Button>
              )}
              {detail.status === "importado" && (
                <Button variant="secondary" onClick={() => downloadReport(detail, detailIssues)}>
                  Baixar relatório do lote
                </Button>
              )}
              <Button variant="ghost" onClick={() => setDetailId(null)}>Fechar</Button>
            </>
          )
        }
      >
        {detailLoading && <Skeleton variant="row" count={5} />}
        {detailError && <ErrorState onRetry={refetchDetail} />}
        {!detailLoading && !detailError && detail && (
          <div className={styles.detailBody}>
            <div className={styles.docHero}>
              <span className={styles.docHeroIcon}>
                <svg viewBox="0 0 20 20" fill="none">
                  <path d="M10 12.5V3m0 0L6.5 6.5M10 3l3.5 3.5M3.5 14.5V16a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div className={styles.docHeroInfo}>
                <Badge tone={statusMeta(detail.status).tone} dot={detail.status === "validado"}>
                  {statusMeta(detail.status).label}
                </Badge>
                <span className={styles.docHeroMeta}>
                  Enviado em {detail.sentAt} por {detail.sentBy} · {fmt(detail.total)} linhas no arquivo
                </span>
              </div>
            </div>

            {detail.status === "validado" && (
              <Alert tone="warning" title="Este lote ainda não entrou em produção">
                A validação terminou, mas nenhum registro foi gravado. Confirme a importação
                ou descarte o lote.
              </Alert>
            )}
            {detail.status === "processando" && (
              <Alert tone="info" title="Efetivação em andamento">
                Os registros válidos estão sendo gravados em produção. Atualize em instantes para
                ver o resultado final.
              </Alert>
            )}
            {detail.status === "cancelado" && (
              <Alert tone="danger" title="Lote descartado">
                Nenhum registro deste lote entrou em produção. Corrija o arquivo de origem e
                envie uma nova importação.
              </Alert>
            )}
            {detail.status === "erro" && (
              <Alert tone="danger" title="Lote com erro">
                Ocorreu um erro no processamento deste lote. Descarte-o e envie uma nova importação.
              </Alert>
            )}

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Resultado da validação</span>
              {renderSummary(detail.ok, 0, detail.errors)}
            </section>

            <section className={styles.detailSection}>
              <span className={styles.sectionLabel}>Inconsistências por linha</span>
              {detailIssues.length > 0 ? (
                <>
                  {renderIssues(detailIssues)}
                  <p className={styles.valNote}>
                    Erros bloqueiam a importação das linhas afetadas — corrija-as no arquivo de
                    origem para reimportá-las.
                  </p>
                </>
              ) : (
                <p className={styles.noSigText}>Nenhuma inconsistência encontrada neste lote.</p>
              )}
            </section>
          </div>
        )}
      </Modal>
    </div>
  );
}
