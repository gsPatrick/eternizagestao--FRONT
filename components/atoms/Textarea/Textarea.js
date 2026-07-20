import styles from "./Textarea.module.css";

export default function Textarea({ invalid = false, rows = 4, ...rest }) {
  return (
    <textarea
      className={`${styles.textarea} ${invalid ? styles.invalid : ""}`}
      rows={rows}
      {...rest}
    />
  );
}
