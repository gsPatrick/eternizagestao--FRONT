"use client";

import { useState } from "react";
import styles from "./EntrancePicker.module.css";

import Button from "@/components/atoms/Button/Button";
import Modal from "@/components/molecules/Modal/Modal";
import MapCanvas from "@/components/organisms/MapCanvas/MapCanvas";

// Converte o ponto do mundo da ortofoto (800×500) em coordenadas geográficas.
// Quando a ortofoto real for importada, o georreferenciamento dela substitui esta base.
export function worldToGps(point, base = [-23.5505, -46.6333]) {
  if (!point) return null;
  const lat = base[0] - ((point[1] - 250) / 500) * 0.006;
  const lng = base[1] + ((point[0] - 400) / 800) * 0.009;
  return [lat, lng];
}

export function formatGps(gps) {
  if (!gps) return "";
  return `${gps[0].toFixed(6)}, ${gps[1].toFixed(6)}`;
}

export default function EntrancePicker({ value = null, onChange, cemeteryName = "" }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const gps = worldToGps(value);
  const draftGps = worldToGps(draft);

  function openPicker() {
    setDraft(value);
    setOpen(true);
  }

  function confirm() {
    onChange?.(draft);
    setOpen(false);
  }

  return (
    <>
      {value ? (
        <div className={styles.selected}>
          <span className={styles.pinIcon}>
            <svg viewBox="0 0 16 16" fill="none">
              <path d="M8 14.5s4.8-4.4 4.8-8A4.8 4.8 0 0 0 3.2 6.5c0 3.6 4.8 8 4.8 8Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
              <circle cx="8" cy="6.5" r="1.7" stroke="currentColor" strokeWidth="1.4" />
            </svg>
          </span>
          <div className={styles.selectedInfo}>
            <span className={styles.selectedTitle}>Entrada demarcada</span>
            <span className={styles.selectedCoords}>{formatGps(gps)}</span>
          </div>
          <button type="button" className={styles.changeBtn} onClick={openPicker}>
            Ajustar
          </button>
        </div>
      ) : (
        <button type="button" className={styles.empty} onClick={openPicker}>
          <svg viewBox="0 0 20 20" fill="none">
            <path d="M10 17.5s5.6-5.1 5.6-9.3A5.6 5.6 0 0 0 4.4 8.2c0 4.2 5.6 9.3 5.6 9.3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="10" cy="8.2" r="2" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <span>
            <strong>Selecionar entrada no mapa</strong>
            <em>toque no ponto onde fica o portão principal</em>
          </span>
        </button>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Entrada do cemitério"
        subtitle={cemeteryName ? `${cemeteryName} — toque no mapa para posicionar` : "Toque no mapa para posicionar o portão principal"}
        width={760}
        footer={
          <>
            {draft && (
              <Button variant="secondary" onClick={() => setDraft(null)}>Limpar ponto</Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!draft} onClick={confirm}>Confirmar entrada</Button>
          </>
        }
      >
        <div className={styles.pickerBody}>
          <MapCanvas mode="view" height={380} marker={draft} onPick={(point) => setDraft(point)} />
          <div className={styles.coordsBar}>
            {draft ? (
              <>
                <span className={styles.coordsLabel}>Coordenadas</span>
                <span className={styles.coordsValue}>{formatGps(draftGps)}</span>
                <span className={styles.coordsHint}>arraste para navegar · toque para reposicionar</span>
              </>
            ) : (
              <span className={styles.coordsHint}>
                Navegue com arrasto/zoom e <strong>toque no ponto da entrada</strong> — as rotas GPS
                dos visitantes partem daqui.
              </span>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
