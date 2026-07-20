"use client";

import { useEffect, useState } from "react";
import styles from "./ExportModal.module.css";
import Modal from "@/components/molecules/Modal/Modal";
import Button from "@/components/atoms/Button/Button";
import Checkbox from "@/components/atoms/Checkbox/Checkbox";

const FORMATS = [
  { id: "pdf", label: "PDF", desc: "Relatório formatado para impressão" },
  { id: "xlsx", label: "Excel", desc: "Planilha .xlsx com colunas tipadas" },
  { id: "csv", label: "CSV", desc: "Compatível com qualquer sistema" },
  { id: "xml", label: "XML", desc: "Padrão para cartórios e órgãos" },
  { id: "json", label: "JSON", desc: "Integrações e APIs" },
];

const FORMAT_ICONS = {
  pdf: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 2.5h8l4 4V21H6V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V7h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8.5 15.5v-4h1.4a1.3 1.3 0 010 2.6H8.5M13 15.5v-4h1a1.6 1.6 0 011.6 1.6v.8a1.6 1.6 0 01-1.6 1.6h-1z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  xlsx: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 2.5h8l4 4V21H6V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V7h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 11.5l4 5M13 11.5l-4 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  csv: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 2.5h8l4 4V21H6V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V7h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9 12h6M9 15h6M9 18h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  ),
  xml: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 2.5h8l4 4V21H6V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V7h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 12.5l-2 2.2 2 2.2M14 12.5l2 2.2-2 2.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  json: (
    <svg viewBox="0 0 24 24" fill="none">
      <path d="M6 2.5h8l4 4V21H6V2.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14 2.5V7h4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 12c-1 0-1 .8-1 1.5s.2 1.5-1 1.5c1.2 0 1 .8 1 1.5s0 1.5 1 1.5M14.5 12c1 0 1 .8 1 1.5s-.2 1.5 1 1.5c-1.2 0-1 .8-1 1.5s0 1.5-1 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  ),
};

/**
 * Modal global de exportação — usar em TODAS as listagens/relatórios.
 * Formatos alinhados com a API (/v1/data-exports): pdf, xlsx, csv, xml, json.
 */
export default function ExportModal({
  open,
  onClose,
  entity = "registros",
  totalCount = 0,
  filteredCount = null,
}) {
  const [format, setFormat] = useState("pdf");
  const [scope, setScope] = useState("filtered");
  const [withAttachments, setWithAttachments] = useState(false);
  const [withHistory, setWithHistory] = useState(false);
  const [stage, setStage] = useState("form"); // form | generating | done

  const hasFilter = filteredCount !== null && filteredCount !== totalCount;

  useEffect(() => {
    if (open) {
      setStage("form");
      setScope(hasFilter ? "filtered" : "all");
    }
  }, [open, hasFilter]);

  function generate() {
    setStage("generating");
    setTimeout(() => setStage("done"), 1400);
  }

  const formatMeta = FORMATS.find((f) => f.id === format);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Exportar ${entity}`}
      subtitle="Escolha o formato, o alcance e o que incluir no arquivo"
      width={640}
      footer={
        stage === "done" ? (
          <Button full onClick={onClose}>Concluído</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button loading={stage === "generating"} onClick={generate}>
              Exportar {formatMeta.label}
            </Button>
          </>
        )
      }
    >
      {stage === "done" ? (
        <div className={styles.done}>
          <span className={styles.doneIcon}>
            <svg viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
              <path d="M8 12.4l2.6 2.6 5.4-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <h3 className={styles.doneTitle}>Exportação gerada</h3>
          <p className={styles.doneText}>
            {entity}.{format} · {scope === "all" ? `${totalCount} registros` : `${filteredCount ?? totalCount} registros filtrados`} —
            o download inicia automaticamente e o arquivo também fica disponível em Relatórios.
          </p>
        </div>
      ) : (
        <div className={styles.body}>
          <span className={styles.sectionLabel}>Formato</span>
          <div className={styles.formats}>
            {FORMATS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`${styles.format} ${format === f.id ? styles.formatActive : ""}`}
                onClick={() => setFormat(f.id)}
              >
                <span className={styles.formatIcon}>{FORMAT_ICONS[f.id]}</span>
                <span className={styles.formatLabel}>{f.label}</span>
                <span className={styles.formatDesc}>{f.desc}</span>
              </button>
            ))}
          </div>

          <span className={styles.sectionLabel}>Alcance</span>
          <div className={styles.scopes}>
            {hasFilter && (
              <button
                type="button"
                className={`${styles.scope} ${scope === "filtered" ? styles.scopeActive : ""}`}
                onClick={() => setScope("filtered")}
              >
                <span className={styles.scopeRadio} />
                Resultados do filtro atual
                <span className={styles.scopeCount}>{filteredCount}</span>
              </button>
            )}
            <button
              type="button"
              className={`${styles.scope} ${scope === "all" ? styles.scopeActive : ""}`}
              onClick={() => setScope("all")}
            >
              <span className={styles.scopeRadio} />
              Todos os {entity}
              <span className={styles.scopeCount}>{totalCount.toLocaleString("pt-BR")}</span>
            </button>
          </div>

          <span className={styles.sectionLabel}>Incluir no arquivo</span>
          <div className={styles.options}>
            <Checkbox
              label="Links dos anexos (fotos e documentos)"
              checked={withAttachments}
              onChange={(e) => setWithAttachments(e.target.checked)}
            />
            <Checkbox
              label="Histórico de movimentações de cada registro"
              checked={withHistory}
              onChange={(e) => setWithHistory(e.target.checked)}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
