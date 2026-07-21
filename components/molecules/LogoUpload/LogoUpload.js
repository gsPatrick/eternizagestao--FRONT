"use client";

import { useRef, useState } from "react";
import styles from "./LogoUpload.module.css";
import Spinner from "@/components/atoms/Spinner/Spinner";
import { useMutation } from "@/lib/api/useResource";
import { uploadTenantLogo, uploadTenantPublicImage } from "@/lib/api/resources/tenant";

// Presets por tipo de imagem — mesmo controle serve para a LOGO e para as
// imagens da PÁGINA PÚBLICA da cidade (topo/hero e rodapé).
const PRESETS = {
  logo: {
    accept: "image/png,image/jpeg,image/svg+xml",
    allowed: ["image/png", "image/jpeg", "image/svg+xml"],
    maxBytes: 3 * 1024 * 1024,
    typesLabel: "PNG, JPEG ou SVG",
    sizeLabel: "3 MB",
    currentLabel: "Logo atual",
    alt: "Logo da cidade",
    emptyTitle: "Arraste a logo ou clique para enviar",
    busyTitle: "Enviando logo…",
    upload: async (file) => (await uploadTenantLogo(file)).logoUrl,
  },
  hero: {
    accept: "image/png,image/jpeg,image/webp",
    allowed: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 12 * 1024 * 1024,
    typesLabel: "PNG, JPEG ou WEBP",
    sizeLabel: "12 MB",
    currentLabel: "Imagem do topo",
    alt: "Imagem do topo da página pública",
    emptyTitle: "Arraste a imagem do topo ou clique para enviar",
    busyTitle: "Enviando imagem…",
    upload: async (file) => (await uploadTenantPublicImage("hero", file)).heroImageUrl,
  },
  footer: {
    accept: "image/png,image/jpeg,image/webp",
    allowed: ["image/png", "image/jpeg", "image/webp"],
    maxBytes: 12 * 1024 * 1024,
    typesLabel: "PNG, JPEG ou WEBP",
    sizeLabel: "12 MB",
    currentLabel: "Imagem do rodapé",
    alt: "Imagem do rodapé da página pública",
    emptyTitle: "Arraste a imagem do rodapé ou clique para enviar",
    busyTitle: "Enviando imagem…",
    upload: async (file) => (await uploadTenantPublicImage("footer", file)).footerImageUrl,
  },
};

/**
 * Controle de upload de imagem da cidade — clique ou arraste-e-solte.
 * Mostra o preview da imagem atual (value), com "Trocar" e "Remover", estado de
 * envio (spinner) e erro amigável. Ao selecionar → sobe o arquivo e devolve a
 * URL via onChange(url). "Remover" → onChange("").
 *
 * @param {string}  value       URL atual (arquivo já enviado)
 * @param {(url:string)=>void} onChange
 * @param {(uploading:boolean)=>void} [onUploading]
 * @param {boolean} [disabled]
 * @param {'logo'|'hero'|'footer'} [kind='logo']  o que está sendo enviado
 */
export default function LogoUpload({ value, onChange, onUploading, disabled = false, kind = "logo" }) {
  const preset = PRESETS[kind] || PRESETS.logo;
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState(null);
  const { mutate, loading, error } = useMutation(preset.upload);

  const busy = loading;
  const message = localError || (error ? error.message : null);

  function openPicker() {
    if (disabled || busy) return;
    inputRef.current?.click();
  }

  async function handleFile(file) {
    if (!file || disabled) return;
    setLocalError(null);

    if (!preset.allowed.includes(file.type)) {
      setLocalError(`Formato inválido. Envie uma imagem ${preset.typesLabel}.`);
      return;
    }
    if (file.size > preset.maxBytes) {
      setLocalError(`Imagem muito grande. O limite é ${preset.sizeLabel}.`);
      return;
    }

    onUploading?.(true);
    try {
      const url = await mutate(file);
      onChange?.(url);
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
        accept={preset.accept}
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
              <img src={value} alt={preset.alt} />
            )}
          </div>
          <div className={styles.info}>
            <span className={styles.infoLabel}>{preset.currentLabel}</span>
            <span className={styles.infoHint}>
              {busy ? "Enviando…" : `${preset.typesLabel} · até ${preset.sizeLabel}`}
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
              ? preset.busyTitle
              : dragOver
                ? "Solte a imagem aqui"
                : preset.emptyTitle}
          </strong>
          <span className={styles.hint}>{preset.typesLabel} · até {preset.sizeLabel}</span>
        </button>
      )}

      {message && <span className={styles.error}>{message}</span>}
    </div>
  );
}
