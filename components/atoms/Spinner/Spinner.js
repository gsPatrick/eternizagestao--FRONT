import styles from "./Spinner.module.css";

export default function Spinner({ size = 16, tone = "navy" }) {
  return (
    <span
      className={`${styles.spinner} ${tone === "light" ? styles.light : ""}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Carregando"
    />
  );
}
