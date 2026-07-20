"use client";

import { useState } from "react";
import styles from "./Avatar.module.css";

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

/**
 * Avatar circular. Exibe a FOTO (`src`) quando houver — para ficar bonito —
 * e cai nas iniciais do nome (placeholder) quando não houver foto ou quando a
 * imagem falhar ao carregar. Nunca mostra um link/URL cru.
 */
export default function Avatar({ name = "", size = "md", src = null }) {
  const [broken, setBroken] = useState(false);
  const showImage = src && !broken;

  return (
    <span className={`${styles.avatar} ${styles[size]}`} title={name}>
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.image}
          src={src}
          alt={name}
          onError={() => setBroken(true)}
        />
      ) : (
        initials(name) || "•"
      )}
    </span>
  );
}
