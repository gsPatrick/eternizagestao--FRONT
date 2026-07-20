import styles from "./AuthVisual.module.css";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";

export default function AuthVisual({
  eyebrow = "Plataforma de gestão de cemitérios",
  title = "Cada memória merece um lugar eterno.",
  subtitle = "Sepulturas, concessões, sepultamentos e cobranças — em uma única plataforma, clara para quem administra e respeitosa para quem visita.",
  intro = true,
}) {
  return (
    <div className={`${styles.visual} ${intro ? styles.withIntro : ""}`}>
      <div className={styles.rings} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        <BrandMark tone="light" />
      </header>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <footer className={styles.footer}>
        <span>Cemitério Municipal · São Paulo</span>
        <span>© 2026 Eterniza Gestão</span>
      </footer>
    </div>
  );
}
