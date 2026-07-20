"use client";

import { useRef, useState } from "react";
import styles from "./LogoUpload.module.css";
import Spinner from "@/components/atoms/Spinner/Spinner";
import { useMutation } from "@/lib/api/useResource";
import { uploadTenantLogo } from "@/lib/api/resources/tenant";

const ACCEPT = "image/png,image/jpeg,image/svg+xml";
const ALLOWED = ["image/png", "image/jpeg", "image/svg+xml"];
const MAX_BYTES = 3 * 1024 * 1024; // 3 MB — espelha o limite da API

/**
 * Controle de upload da logo da cidade — clique ou arraste-e-solte.
 * Mostra o preview da logo atual (value), com "Trocar" e "Remover", estado de
 * envio (spinner) e erro amigável. Ao selecionar → sobe o arquivo e devolve a
 * URL via onChange(url). "Remover" → onChange("").
 *
 * @param {string}  value       logoUrl atual (URL do arquivo já enviado)
 * @param {(url:string)=>void} onChange
 * @param {(uploading:boolean)=>void} [onUploading]
 * @param {boolean} [disabled]
 */
export default function LogoUpload({ value, onChange, onUploading, disabled = false }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const { mutate, loading, error } = useMutation(uploadTenantLogo);

  const busy = loading;
  const message = localError || (error ? error.message : null);

  function openPicker() {
    if (disabled || busy) return;
    inputRef.current?.click();
  }

  async function handleFile(file) {
    if (!file || disabled) return;
    setLocalError(null);

    if (!ALLOWED.includes(file.type)) {
      setLocalError("Formato inválido. Envie uma imagem PNG, JPEG ou SVG.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError("Imagem muito grande. O limite é 3 MB.");
      return;
    }

    onUploading?.(true);
    try {
      const { logoUrl } = await mutate(file);
      onChange?.(logoUrl);
    } catch {
      // erro tipado exposto via `error` (message) — nada a fazer aqui.
    } finally {
      onUploading?.(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || busy) return;
    handleFile(e.dataTransfer.files?.[0]);
  }

  const dragProps = disabled
    ? {}
    : {
        onDragOver: (e) => {
          e.preventDefault();
          setDragOver(true);
        },
        onDragLeave: () => setDragOver(false),
        onDrop,
      };

  return (
    <div className={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className={styles.input}
        disabled={disabled}
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {value ? (
        <div
          className={`${styles.preview} ${dragOver ? styles.dragOver : ""} ${disabled ? styles.disabled : ""}`}
          {...dragProps}
        >
          <div className={styles.thumb}>
            {busy ? (
              <Spinner size={22} />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={value} alt="Logo da cidade" />
            )}
          </div>
          <div className={styles.info}>
            <span className={styles.infoLabel}>Logo atual</span>
            <span className={styles.infoHint}>
              {busy ? "Enviando…" : "PNG, JPEG ou SVG · até 3 MB"}
            </span>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.action}
                onClick={openPicker}
                disabled={disabled || busy}
              >
                Trocar
              </button>
              <button
                type="button"
                className={styles.actionGhost}
                onClick={() => {
                  if (disabled || busy) return;
                  setLocalError(null);
                  onChange?.("");
                }}
                disabled={disabled || busy}
              >
                Remover
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={`${styles.dropzone} ${dragOver ? styles.dragOver : ""}`}
          onClick={openPicker}
          disabled={disabled}
          {...dragProps}
        >
          <span className={styles.icon}>
            {busy ? (
              <Spinner size={22} />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 16V6M12 6l-4 4M12 6l4 4"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 17v2.5A1.5 1.5 0 005.5 21h13a1.5 1.5 0 001.5-1.5V17"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </span>
          <strong className={styles.title}>
            {busy
              ? "Enviando logo…"
              : dragOver
                ? "Solte a imagem aqui"
                : "Arraste a logo ou clique para enviar"}
          </strong>
          <span className={styles.hint}>PNG, JPEG ou SVG · até 3 MB</span>
        </button>
      )}

      {message && <span className={styles.error}>{message}</span>}
    </div>
  );
}
