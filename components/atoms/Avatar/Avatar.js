import styles from "./Avatar.module.css";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

export default function Avatar({ name = "", size = "md" }) {
  return (
    <span className={`${styles.avatar} ${styles[size]}`} title={name}>
      {initials(name) || "•"}
    </span>
  );
}
