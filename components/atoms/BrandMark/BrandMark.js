"use client";

import { useTenant } from "@/components/providers/TenantTheme/TenantTheme";
import styles from "./BrandMark.module.css";

export default function BrandMark({ tone = "dark", size = "md", brand }) {
  const tenant = useTenant();
  // fora do sistema (landing/auth sem provider) cai no default Eterniza;
  // dentro do sistema, mostra a marca do tenant. `brand` força um valor.
  const lead = brand?.lead ?? tenant.brandLead;
  const tail = brand?.tail ?? tenant.brandTail;

  return (
    <span className={`${styles.brand} ${styles[tone]} ${styles[size]}`}>
      <span className={styles.symbol} aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9.2" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="4.6" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="12" cy="12" r="1.4" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.word}>
        {lead}
        <em>{tail}</em>
      </span>
    </span>
  );
}
