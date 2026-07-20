import styles from "./AuthVisual.module.css";
import BrandMark from "@/components/atoms/BrandMark/BrandMark";

export default function AuthVisual({
  eyebrow = "Plataforma de gestão de cemitérios",
  title = "Cada memória merece um lugar eterno.",
  subtitle = "Sepulturas, concessões, sepultamentos e cobranças — em uma única plataforma, clara para quem administra e respeitosa para quem visita.",
  intro = true,
  // Rótulo do rodapé: nome da cidade/tenant (dinâmico). Sem tenant resolvido,
  // cai num rótulo neutro da plataforma (nunca uma cidade fixa).
  footerLabel = "Plataforma de Cemitérios",
}) {
  return (
    <div className={`${styles.visual} ${intro ? styles.withIntro : ""}`}>
      <div className={styles.rings} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />
      <header className={styles.header}>
        {/* logo → landing do domínio/subdomínio atual (cidade ou plataforma) */}
        <BrandMark tone="light" href="/" />
      </header>
      <div className={styles.content}>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.subtitle}>{subtitle}</p>
      </div>
      <footer className={styles.footer}>
        <span>{footerLabel}</span>
        <span>© 2026 Eterniza Gestão</span>
      </footer>
    </div>
  );
}
