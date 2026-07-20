"use client";

import styles from "./page.module.css";

import { useResource } from "@/lib/api/useResource";
import { getDashboard } from "@/lib/api/resources/dashboard";

import Skeleton from "@/components/atoms/Skeleton/Skeleton";
import ErrorState from "@/components/molecules/ErrorState/ErrorState";
import { DashboardView } from "./DashboardView";

export default function PanelHomePage() {
  const { data, loading, error, refetch } = useResource(
    ({ signal }) => getDashboard(undefined, { signal }),
    []
  );

  // ---- loading: esqueleto no formato do layout (cards, nunca spinner solto) ----
  if (loading) {
    return (
      <div className={styles.page}>
        <header className={styles.top}>
          <div>
            <Skeleton variant="line" width={180} height={26} />
            <Skeleton variant="line" width={230} />
          </div>
        </header>
        <section className={styles.stats}>
          <Skeleton variant="card" count={4} />
        </section>
        <section className={styles.mainGrid}>
          <Skeleton variant="card" />
          <Skeleton variant="card" />
        </section>
        <section className={styles.bottomGrid}>
          <Skeleton variant="card" count={3} />
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  return <DashboardView data={data} />;
}
