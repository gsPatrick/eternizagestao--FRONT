"use client";

/**
 * Componentes de UI compartilhados pelos tópicos do hub de Configurações.
 * Cartões de largura cheia (padrão do sistema), barra de ações sticky, campo de
 * cor e pílulas de status — todos com a identidade premium navy do sistema.
 */
import Button from "@/components/atoms/Button/Button";
import Input from "@/components/atoms/Input/Input";
import FormField from "@/components/molecules/FormField/FormField";
import { isHex, safeColor } from "./helpers";
import styles from "./ui.module.css";

// Cabeçalho do tópico (título + descrição) no topo da área de conteúdo.
export function TopicHeader({ title, desc, aside }) {
  return (
    <header className={styles.topicHead}>
      <div>
        <h1 className={styles.topicTitle}>{title}</h1>
        {desc && <p className={styles.topicDesc}>{desc}</p>}
      </div>
      {aside && <div className={styles.topicAside}>{aside}</div>}
    </header>
  );
}

// Cartão de seção de largura cheia (cabeçalho + corpo).
export function SectionCard({ title, desc, children, footer }) {
  return (
    <section className={styles.card}>
      {(title || desc) && (
        <div className={styles.cardHead}>
          {title && <h2 className={styles.cardTitle}>{title}</h2>}
          {desc && <p className={styles.cardDesc}>{desc}</p>}
        </div>
      )}
      <div className={styles.cardBody}>{children}</div>
      {footer && <div className={styles.cardFooter}>{footer}</div>}
    </section>
  );
}

// Barra de ações sticky no rodapé da área de conteúdo.
export function SaveBar({ hint, children }) {
  return (
    <div className={styles.saveBar}>
      {hint && <div className={styles.saveHint}>{hint}</div>}
      <div className={styles.saveButtons}>{children}</div>
    </div>
  );
}

export { Button };

// Campo de cor com seletor nativo + input hex.
export function ColorField({ label, hint, value, onChange, disabled }) {
  const hex = safeColor(value, "#032e59");
  return (
    <FormField label={label} hint={hint}>
      <div className={styles.colorRow}>
        <label className={styles.swatchInput} style={{ background: hex }}>
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            aria-label={`${label} — seletor de cor`}
          />
        </label>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          maxLength={7}
          invalid={Boolean(value) && !isHex(value)}
          disabled={disabled}
        />
      </div>
    </FormField>
  );
}

export function Swatch({ label, hex }) {
  return (
    <span className={styles.swatchChip}>
      <span className={styles.swatchDot} style={{ background: hex }} />
      <span className={styles.swatchText}>
        <strong>{label}</strong>
        {String(hex).toUpperCase()}
      </span>
    </span>
  );
}

// Pílula de status "conectado / não configurado / conectando".
export function StatusPill({ tone = "neutral", children }) {
  return (
    <span className={`${styles.pill} ${styles[`pill_${tone}`] || ""}`}>
      <span className={styles.pillDot} />
      {children}
    </span>
  );
}

// Aviso "Fase 2" — placeholder honesto, sem botão morto.
export function PhaseTwoNote({ children }) {
  return (
    <div className={styles.phaseTwo}>
      <span className={styles.phaseTwoTag}>Em breve · Fase 2</span>
      <p>{children}</p>
    </div>
  );
}
