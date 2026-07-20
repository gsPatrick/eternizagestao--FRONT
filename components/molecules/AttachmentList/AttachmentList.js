"use client";

import { useState } from "react";
import styles from "./AttachmentList.module.css";
import Button from "@/components/atoms/Button/Button";
import FileViewer, { fileKind } from "@/components/organisms/FileViewer/FileViewer";

const KIND_META = {
  image: { label: "IMG", tone: "image" },
  pdf: { label: "PDF", tone: "pdf" },
  office: { label: "DOC", tone: "office" },
  other: { label: "ARQ", tone: "other" },
};

// Lista padrão de anexos do sistema: Visualizar (inline) + Baixar.
// Usar em TODO lugar que exibir anexos — sepulturas, sepultados, exumações, pagamentos…
export default function AttachmentList({ files = [] }) {
  const [preview, setPreview] = useState(null);

  return (
    <>
      <ul className={styles.list}>
        {files.map((file) => {
          const kind = fileKind(file.name);
          const meta = KIND_META[kind];
          return (
            <li key={file.name} className={styles.item}>
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
              </div>
            </li>
          );
        })}
      </ul>

      <FileViewer open={Boolean(preview)} file={preview} onClose={() => setPreview(null)} />
    </>
  );
}
