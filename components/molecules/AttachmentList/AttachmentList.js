"use client";

import { useState } from "react";
import styles from "./AttachmentList.module.css";
import Button from "@/components/atoms/Button/Button";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import FileViewer, { fileKind } from "@/components/organisms/FileViewer/FileViewer";

const KIND_META = {
  image: { label: "IMG", tone: "image" },
  pdf: { label: "PDF", tone: "pdf" },
  office: { label: "DOC", tone: "office" },
  other: { label: "ARQ", tone: "other" },
};

// Lista padrão de anexos do sistema: Visualizar (inline) + Baixar (+ Remover).
// Usar em TODO lugar que exibir anexos — sepulturas, sepultados, exumações…
// Estados opcionais (loading/error/vazio) para ligar direto ao useResource:
//   loading  → Skeleton   | error+onRetry → ErrorState  | vazio → EmptyState
//   onDelete(file) → habilita o botão "Remover" (pode ser async; recarregue a lista)
export default function AttachmentList({
  files = [],
  loading = false,
  error = null,
  onRetry,
  onDelete,
  emptyLabel = "Nenhum anexo por aqui ainda.",
}) {
  const [preview, setPreview] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function handleDelete(file) {
    if (!onDelete) return;
    setDeletingId(file.id ?? file.name);
    try {
      await onDelete(file);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) return <Skeleton variant="block" height={56} count={2} />;
  if (error) {
    return (
      <ErrorState
        title="Não foi possível carregar os anexos"
        onRetry={onRetry}
      />
    );
  }
  if (!files.length) {
    return <EmptyState title="Sem anexos" message={emptyLabel} />;
  }

  return (
    <>
      <ul className={styles.list}>
        {files.map((file) => {
          const kind = fileKind(file.name);
          const meta = KIND_META[kind];
          const key = file.id ?? file.name;
          return (
            <li key={key} className={styles.item}>
              <button className={styles.main} onClick={() => setPreview(file)} title="Visualizar">
                <span className={`${styles.icon} ${styles[meta.tone]}`}>{meta.label}</span>
                <span className={styles.body}>
                  <span className={styles.name}>{file.name}</span>
                  <span className={styles.meta}>{[file.category, file.size].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
              <div className={styles.actions}>
                <Button variant="ghost" size="sm" onClick={() => setPreview(file)}>
                  Visualizar
                </Button>
                <a href={file.url} download={file.name} className={styles.download}>
                  <Button variant="ghost" size="sm">Baixar</Button>
                </a>
                {onDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={deletingId === key}
                    onClick={() => handleDelete(file)}
                  >
                    Remover
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <FileViewer open={Boolean(preview)} file={preview} onClose={() => setPreview(null)} />
    </>
  );
}
