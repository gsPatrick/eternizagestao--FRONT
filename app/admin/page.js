"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import styles from "./page.module.css";

import Button from "@/components/atoms/Button/Button";
import Badge from "@/components/atoms/Badge/Badge";
import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import StatCard from "@/components/molecules/StatCard/StatCard";
import EmptyState from "@/components/molecules/EmptyState/EmptyState";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";

import { useResource } from "@/lib/api/useResource";
import { listTenants, adaptTenants } from "@/lib/api/resources/platform";

const PlusIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
  </svg>
);

const ArrowIcon = (
  <svg viewBox="0 0 16 16" fill="none">
    <path d="M4 8h8M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function OverviewPage() {
  const router = useRouter();
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => listTenants(undefined, { signal }),
    []
  );
  const cities = useMemo(() => adaptTenants(data?.data ?? []), [data]);

  const stats = useMemo(() => {
    const total = cities.length;
    const active = cities.filter((c) => c.active).length;
    const pending = cities.filter((c) => c.onboardingStatus === "pendente").length;
    return { total, active, pending };
  }, [cities]);

  // as ~5 mais recentes (a lista já vem ordenada pela API; as últimas cadastradas
  // costumam vir no fim — mostramos as 5 do topo do conjunto atual).
  const recent = useMemo(() => cities.slice(0, 5), [cities]);

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <div>
          <span className={styles.eyebrow}>Console da plataforma</span>
          <h1 className={styles.title}>Início</h1>
          <p className={styles.subtitle}>
            Visão geral das cidades atendidas pelo Eterniza Gestão.
          </p>
        </div>
        <div className={styles.actions}>
          <Button onClick={() => router.push("/admin/cidades")} iconLeft={PlusIcon}>
            Nova cidade
          </Button>
        </div>
      </header>

      {loading ? (
        <>
          <div className={styles.stats}>
            <Skeleton variant="card" />
            <Skeleton variant="card" />
            <Skeleton variant="card" />
          </div>
          <section className={styles.panel}>
            <div className={styles.loading}>
              <Skeleton variant="row" count={5} />
            </div>
          </section>
        </>
      ) : error ? (
        <section className={styles.panel}>
          <ErrorState onRetry={refetch} />
        </section>
      ) : cities.length === 0 ? (
        <section className={styles.panel}>
          <EmptyState
            title="Nenhuma cidade cadastrada"
            message="Cadastre a primeira cidade para provisionar o acesso e convidar o administrador responsável."
            action={
              <Button onClick={() => router.push("/admin/cidades")} iconLeft={PlusIcon}>
                Cadastrar cidade
              </Button>
            }
          />
        </section>
      ) : (
        <>
          <div className={styles.stats}>
            <StatCard label="Cidades" value={String(stats.total)} caption="no total da plataforma" />
            <StatCard label="Ativas" value={String(stats.active)} caption="com acesso liberado" />
            <StatCard label="Onboarding pendente" value={String(stats.pending)} caption="aguardando configuração da cidade" />
          </div>

          <section className={styles.panel}>
            <div className={styles.panelHead}>
              <h2 className={styles.panelTitle}>Cidades recentes</h2>
              <Link href="/admin/cidades" className={styles.panelLink}>
                Ver todas
                <span className={styles.panelLinkIcon}>{ArrowIcon}</span>
              </Link>
            </div>

            <ul className={styles.list}>
              {recent.map((c) => (
                <li key={c.id}>
                  <Link href="/admin/cidades" className={styles.row}>
                    <span className={styles.cityDot} style={{ background: c.primaryColor || "var(--color-navy)" }} />
                    <span className={styles.cityInfo}>
                      <span className={styles.cityName}>{c.name}</span>
                      <span className={styles.citySub}>{c.domain}</span>
                    </span>
                    <span className={styles.rowBadges}>
                      {c.onboardingStatus === "concluido" ? (
                        <Badge tone="success" dot>Concluído</Badge>
                      ) : (
                        <Badge tone="warning" dot>Pendente</Badge>
                      )}
                      {c.active ? (
                        <Badge tone="success">Ativa</Badge>
                      ) : (
                        <Badge tone="neutral">Inativa</Badge>
                      )}
                    </span>
                    <span className={styles.rowChevron} aria-hidden="true">
                      <svg viewBox="0 0 16 16" fill="none">
                        <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
