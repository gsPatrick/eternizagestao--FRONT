"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./AttachmentUploadModal.module.css";
import Modal from "@/components/molecules/Modal/Modal";
import Button from "@/components/atoms/Button/Button";
import Select from "@/components/atoms/Select/Select";
import Alert from "@/components/molecules/Alert/Alert";
import { fileKind } from "@/components/organisms/FileViewer/FileViewer";

const CATEGORIES = [
  "Foto",
  "Certidão de óbito",
  "Contrato",
  "Autorização",
  "Comprovante",
  "Documento pessoal",
  "Outro",
];

const KIND_BADGE = {
  image: { label: "IMG", tone: "image" },
  pdf: { label: "PDF", tone: "pdf" },
  office: { label: "DOC", tone: "office" },
  other: { label: "ARQ", tone: "other" },
};

function guessCategory(name) {
  const kind = fileKind(name);
  if (kind === "image") return "Foto";
  const lower = name.toLowerCase();
  if (lower.includes("certidao") || lower.includes("obito")) return "Certidão de óbito";
  if (lower.includes("contrato")) return "Contrato";
  if (lower.includes("autoriza")) return "Autorização";
  if (lower.includes("comprovante") || lower.includes("recibo")) return "Comprovante";
  return "Outro";
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

// Modal padrão de upload de anexos: clique ou arraste, renomeie e categorize.
// Usar em todo lugar que aceitar anexos. onUpload recebe os itens escolhidos
// [{ file, name, category, size }] e DEVE persistir de verdade — pode ser async:
// o modal aguarda a Promise, mantém o "Anexando…" e só fecha no sucesso (erro →
// Alert dentro do modal, sem fechar). Quem chama faz o upload real + refetch.
export default function AttachmentUploadModal({ open, onClose, onUpload, title = "Adicionar anexos" }) {
  const [items, setItems] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) { setItems([]); setError(null); }
  }, [open]);

  function addFiles(fileList) {
    const next = [...fileList].map((file) => {
      const dot = file.name.lastIndexOf(".");
      return {
        id: crypto.randomUUID(),
        file,
        baseName: dot > 0 ? file.name.slice(0, dot) : file.name,
        ext: dot > 0 ? file.name.slice(dot) : "",
        category: guessCategory(file.name),
      };
    });
    setItems((list) => [...list, ...next]);
  }

  function updateItem(id, patch) {
    setItems((list) => list.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function removeItem(id) {
    setItems((list) => list.filter((item) => item.id !== id));
  }

  async function confirm() {
    setSaving(true);
    setError(null);
    try {
      await onUpload(
        items.map((item) => ({
          file: item.file,
          name: `${item.baseName.trim() || "arquivo"}${item.ext}`,
          category: item.category,
          size: formatSize(item.file.size),
        }))
      );
      setSaving(false);
      onClose();
    } catch (err) {
      setSaving(false);
      setError(err?.message || "Não foi possível enviar os anexos. Tente novamente.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      subtitle="Fotos, certidões, contratos e comprovantes — PDF, imagens e documentos"
      width={640}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button loading={saving} disabled={!items.length} onClick={confirm}>
            Anexar {items.length > 0 ? `${items.length} arquivo${items.length > 1 ? "s" : ""}` : ""}
          </Button>
        </>
      }
    >
      <div className={styles.body}>
        {error && <Alert tone="danger">{error}</Alert>}
        <div
          className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ""}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer.files);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className={styles.input}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <span className={styles.dropIcon}>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 16V6M12 6l-4 4M12 6l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </span>
          <strong className={styles.dropTitle}>
            {dragOver ? "Solte os arquivos aqui" : "Arraste os arquivos ou clique para selecionar"}
          </strong>
          <span className={styles.dropHint}>PDF, JPG, PNG, DOCX · até 25 MB por arquivo</span>
        </div>

        {items.length > 0 && (
          <ul className={styles.fileList}>
            {items.map((item) => {
              const badge = KIND_BADGE[fileKind(item.baseName + item.ext)];
              return (
                <li key={item.id} className={styles.fileRow}>
                  <span className={`${styles.fileBadge} ${styles[badge.tone]}`}>{badge.label}</span>
                  <div className={styles.fileFields}>
                    <div className={styles.nameWrap}>
                      <input
                        className={styles.nameInput}
                        value={item.baseName}
                        onChange={(e) => updateItem(item.id, { baseName: e.target.value })}
                        placeholder="Nome do arquivo"
                        aria-label="Renomear arquivo"
                      />
                      <span className={styles.ext}>{item.ext}</span>
                    </div>
                    <div className={styles.metaRow}>
                      <Select
                        value={item.category}
                        onChange={(e) => updateItem(item.id, { category: e.target.value })}
                        className={styles.categorySelect}
                      >
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </Select>
                      <span className={styles.size}>{formatSize(item.file.size)}</span>
                    </div>
                  </div>
                  <button className={styles.remove} onClick={() => removeItem(item.id)} aria-label="Remover arquivo">
                    <svg viewBox="0 0 16 16" fill="none">
                      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
