"use client";

import Link from "next/link";
import styles from "./page.module.css";

import PortalShell from "@/components/organisms/PortalShell/PortalShell";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import { useTenant } from "@/components/providers/TenantTheme/TenantTheme";
import { useResource } from "@/lib/api/useResource";
import { getGraves } from "@/lib/api/resources/portal";

export default function PortalJazigosPage() {
  const tenant = useTenant();
  const sub = (tenant?.subdomain || "").split(".")[0];

  const { data, loading, error, refetch } = useResource(
    ({ signal }) => getGraves({ signal, tenant: sub }),
    [sub]
  );
  const graves = data ?? [];

  return (
    <PortalShell active="jazigos">
      <div className={styles.page}>
        <header className={styles.hero}>
          <span className={styles.eyebrow}>Portal da Família</span>
          <h1 className={styles.title}>Meus jazigos</h1>
          <p className={styles.subtitle}>
            Os jazigos sob sua responsabilidade, com a situação de cada um e quem descansa neles.
          </p>
        </header>

        {loading ? (
          <div className={styles.grid}>
            <Skeleton variant="card" count={2} height={240} />
          </div>
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : graves.length === 0 ? (
          <EmptyState
            title="Você ainda não tem jazigos vinculados"
            message="Assim que uma concessão estiver registrada em seu nome, ela aparecerá aqui."
          />
        ) : (
          <div className={styles.grid}>
            {graves.map((grave) => (
              <Link
                key={grave.id}
                href={`/portal/jazigos/${grave.id}`}
                className={styles.card}
              >
                <div className={styles.cardTop}>
                  <span className={styles.icon}>
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M7 20V9a5 5 0 0 1 10 0v11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      <path d="M4.5 20h15M10 11h4M12 8.5v5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                  {grave.status === "em_dia" ? (
                    <Badge tone="success" dot>Em dia</Badge>
                  ) : (
                    <Badge tone="warning" dot>Pendência</Badge>
                  )}
                </div>

                <span className={styles.label}>{grave.label}</span>
                <span className={styles.trail}>{grave.trail}</span>
                <span className={styles.meta}>
                  {grave.type} · {grave.deceased.length} sepultado(s)
                </span>

                <ul className={styles.people}>
                  {grave.deceased.map((person) => (
                    <li key={person.name} className={styles.person}>
                      <span className={styles.personDot} aria-hidden="true" />
                      <span className={styles.personName}>{person.name}</span>
                      <span className={styles.personRole}>{person.role}</span>
                    </li>
                  ))}
                </ul>

                <dl className={styles.facts}>
                  <div className={styles.fact}>
                    <dt>Desde</dt>
                    <dd>{grave.since}</dd>
                  </div>
                  <div className={styles.fact}>
                    <dt>Contrato</dt>
                    <dd>{grave.contract}</dd>
                  </div>
                </dl>

                <span className={styles.go}>
                  Ver detalhes
                  <svg viewBox="0 0 16 16" fill="none">
                    <path d="m6 4 4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </PortalShell>
  );
}
